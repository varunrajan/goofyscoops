# Pet events foundation — test plan (Step 0)

**Status:** Phase 1, awaiting review. No implementation in this change.
**Covers:** `specs/data-model.md` migration order steps 1–3 only.
**Does not cover:** Potty Tracking steps 1–6 (`specs/potty-tracking.md`).

This plan states cases the spec already decides, and stops where it does not. Findings in [Review findings](#review-findings) are unresolved. Phase 2 must not pick them silently. Cases marked **blocked** are not to be implemented as assertions until the finding is resolved.

This amendment adds LD-7, CI-1, the multi-timezone out-of-scope decision, and F14. It does not resolve F2, F3, F4, or F6.

---

## Scope under test

Feature-agnostic infrastructure only:

1. `pet_events` table, the two indexes in the spec, and RLS policies that scope through `pet_id → pets.household_id` the way `settings` and `daily_logs` do.
2. A `PetEvent` discriminated union on `event_type`, parsed and validated on read and on write.
3. `PetStoreContext` list primitives: `events`, `addEvent`, `updateEvent`, `removeEvent`, using the same optimistic-update-then-fire-and-forget pattern as `persistLog` and `persistSettings`.
4. `updateEvent` is the only context path that changes `occurred_at`, and that write recomputes `local_date` in the same update.

## Out of scope

- Any potty UI, scale, slider, settings toggle, or `pets.size_class`.
- A `potty_events` table.
- `pet_schedules` and `completeSchedule` (data-model migration order step 5).
- Changes to the `daily_logs` table or to kibble / supplement / med behavior.
- The cross-midnight acknowledgement UI. The context list dropping a row whose `local_date` no longer matches `viewDate` is in scope; announcing that move in the UI is not.
- Soft delete. The written schema has no `deleted_at`. The open question in the data model is non-blocking and is not resolved here.

## Oracle for `local_date`

`daily_logs` keys the current day with the private helper in `src/context/PetStore.tsx`:

```ts
function today(): string {
  return new Date().toLocaleDateString("en-CA");
}
```

The dashboard compares `viewDate` to `new Date().toLocaleDateString("en-CA")` the same way. There is no stored user timezone. "The user's local timezone" means the runtime default timezone that `toLocaleDateString` already uses.

For an arbitrary instant the spec does not have a helper — `today()` only formats `new Date()`. The agreement oracle for an instant is the same locale call:

```ts
new Date(occurredAt).toLocaleDateString("en-CA")
```

A UTC date slice (`toISOString().slice(0, 10)`) is the wrong oracle. Cases below use instants where the local civil date and the UTC date differ, so that mistake fails.

Frozen zone for the civil-date cases: `TZ=America/Los_Angeles` (PDT, UTC−7, on 2026-09-21/22). The test process must be started with that `TZ`. Setting `process.env.TZ` after startup is not reliable.

| Instant (UTC) | Local time (PDT) | en-CA local date | UTC date |
|---|---|---|---|
| `2026-09-22T06:50:00.000Z` | 2026-09-21 23:50 | `2026-09-21` | `2026-09-22` |
| `2026-09-22T07:10:00.000Z` | 2026-09-22 00:10 | `2026-09-22` | `2026-09-22` |

See [F1](#f1-today-does-not-format-an-arbitrary-instant) before exporting or renaming a helper to satisfy this.

## Layers

The repo has no test runner (`package.json` scripts are `dev`, `build`, `start`, `lint` only). This plan does not choose one. See [F10](#f10-no-test-runner). The cases split into three layers:

| Layer | What it locks | Examples |
|---|---|---|
| Pure | Date oracle and payload parse, no React, no network | LD-*, RD-* |
| Context | Optimistic state versus a deferred Supabase mock, including the destination-day read | OP-*, UE-*, LD-7 |
| Database | Schema, indexes, RLS, and concurrent inserts with two authenticated clients plus anon | SC-*, RLS-*, CI-1 |

RLS cases are not unit tests. A mock of the client would not exercise Postgres policies.

---

## Required cases

### `local_date` is recomputed on every write that touches `occurred_at`

**LD-1. Insert stores the en-CA local date of the event instant, not the UTC date.**

With `TZ=America/Los_Angeles` and the event instant `2026-09-22T06:50:00.000Z`:

- Persisted `local_date` is `2026-09-21`.
- That string equals `new Date("2026-09-22T06:50:00.000Z").toLocaleDateString("en-CA")`.
- It does not equal `2026-09-22`.

`local_date` is `NOT NULL` and has no database default, so the insert payload itself must include it. The client computes it. Postgres does not.

Which clock supplies the *initial* `occurred_at` is [F2](#f2-who-writes-the-initial-occurred_at). LD-1 asserts the stored pair agrees. It does not assert whether `addEvent`'s insert body contains `occurred_at` until F2 is resolved.

**LD-2. An edit across local midnight recomputes `local_date` in the same write.**

Start from the LD-1 row (`local_date = 2026-09-21`). Call `updateEvent` with `occurred_at` set to `2026-09-22T07:10:00.000Z` (00:10 PDT on Sep 22).

- The single update payload contains both the new `occurred_at` and `local_date = 2026-09-22`.
- `local_date` is not left at `2026-09-21`.
- `local_date` is not written in a follow-up update.
- Optimistic state shows `2026-09-22` before the mocked update resolves.
- While `viewDate` is `2026-09-21`, the row leaves `events` as part of that same optimistic update. That is the specified context behavior. No UI copy is asserted.

LD-2 stops once the row has left the old day. LD-7 is the other half.

**LD-7. The destination day shows the moved row.**

Continue from LD-2. `viewDate` is `2026-09-21` and the row is no longer in `events`. Set `viewDate` to `2026-09-22`, the new `local_date`. After the viewDate-scoped read for that day completes:

- The same row is in `events`.
- `occurred_at` is `2026-09-22T07:10:00.000Z`.
- `local_date` is `2026-09-22`.

LD-2 can pass while this fails: the event leaves one day and never arrives on the other. Both halves are required.

This does not resolve [F6](#f6-fetch-gating-with-no-feature-flag). F6 is whether a household with nothing enabled pays for a query on mount. LD-7 is the read of the destination day after a move.

**LD-3. A write that touches `occurred_at` recomputes `local_date` even when the instant is unchanged.**

Given a row whose stored `local_date` is wrong for its `occurred_at` (the stranded-row bug the spec describes), `updateEvent(id, { occurred_at: <the same instant> })` persists `local_date` equal to the en-CA date of that instant.

This is the "every write that touches `occurred_at`" rule, not only writes that change the instant.

**LD-4. A data-only update does not move `local_date`.**

`updateEvent` with a patch that does not include `occurred_at` leaves `local_date` as it was. The update sent to the server does not substitute a different day.

What else a patch may contain is [F7](#f7-updateevent-patch-allowlist). LD-4 only requires that omitting `occurred_at` preserves the existing day.

**LD-5. "Now" agrees with `today()`.**

With the clock frozen at `2026-09-22T06:50:00.000Z` and `TZ=America/Los_Angeles`:

- `new Date().toLocaleDateString("en-CA")` is `2026-09-21`.
- An event inserted at that instant has `local_date === "2026-09-21"`.

Same locale string `daily_logs` already uses. Not a UTC date, and not `toLocaleDateString("en-US")`.

**LD-6. `updateEvent` is the only context method that can change `occurred_at`.**

- The public `addEvent` arguments are `(type, data)`. Callers cannot pass `occurred_at`.
- `removeEvent` deletes. It does not update `occurred_at`.
- No other `PetStoreContext` method issues an update of `pet_events.occurred_at`.
- There is no second helper that accepts an `occurred_at` and writes it without recomputing `local_date`.

This is an API-boundary test. It is not a database trigger. The spec puts the rule in one helper, and [F12](#f12-no-database-trigger-is-specified) says not to invent one.

Whether the insert path may set the *initial* `occurred_at` inside `addEvent` is [F2](#f2-who-writes-the-initial-occurred_at). LD-6 forbids callers, and forbids any update path other than `updateEvent`. It does not, until F2 is resolved, forbid `addEvent` from putting the insert-time instant into the insert payload.

### Optimistic insert keys the row before the server responds

**OP-1. The row is in `events` with a client id before the insert resolves.**

Defer the mocked `insert` so it does not resolve. Call `addEvent`.

- `addEvent` returns `void` and returns before the insert resolves. Callers do not await it. Same shape as `toggleKibble` calling `persistLog` inside the state updater (`src/context/PetStore.tsx`).
- `events` already contains the new row.
- `row.id` is a UUID.
- The `insert` payload uses that same `id`. The id is not taken from a server response, and the code does not rely on `gen_random_uuid()` for the optimistic key.
- The column default may still exist (schema test SC-2). The client overrides it.

**OP-2. A failed insert does not roll the optimistic row back.**

`persistLog` and `persistSettings` do not read the Supabase error and do not restore the previous state. `addEvent` matches that. If the deferred insert rejects, the row with the client id remains in `events`.

That assertion stays. [F14](#f14-a-failed-event-insert-is-a-worse-lie-than-a-failed-counter-write) records why matching the counter pattern is a worse failure for an event log. This amendment does not change the behavior.

**OP-3. The optimistic row carries the computed `local_date` before the server responds.**

Under the LD-5 clock, the row in state has `local_date === "2026-09-21"` before the insert resolves. The key and the day are both local; neither waits on the response.

### RLS: household members can read and write; non-members cannot

The policy *behavior* is specified. The policy *SQL* is not in the repo. See [F3](#f3-existing-rls-sql-is-not-in-the-repo). These cases assert behavior. They do not assert that the `CREATE POLICY` text matches `settings` / `daily_logs` until those definitions are retrieved.

Actors:

- **Member A** and **Member B**: two authenticated users whose `profiles.household_id` is household H, which owns pet P.
- **Outsider**: an authenticated user whose profile is a different household.
- **Unaffiliated**: an authenticated user with no household.
- **Anon**: the anon key, no session.

Pet Q belongs to a different household.

| Id | Actor | Operation | Expected |
|---|---|---|---|
| RLS-1 | Member A | `SELECT` events for pet P | The row is returned |
| RLS-2 | Member A | `INSERT` an event for pet P | Insert succeeds |
| RLS-3 | Member A | `UPDATE` that event | Update succeeds |
| RLS-4 | Member A | `DELETE` that event | Delete succeeds |
| RLS-5 | Member B | `SELECT`, `UPDATE`, and `DELETE` an event Member A inserted | All succeed. No per-member privacy |
| RLS-6 | Outsider | `SELECT` events for pet P | Zero rows |
| RLS-7 | Outsider | `INSERT` for pet P | Fails or inserts zero rows. No row is visible to Member A afterward |
| RLS-8 | Outsider | `UPDATE` an event on pet P | Zero rows changed. Member A still sees the original values |
| RLS-9 | Outsider | `DELETE` an event on pet P | Zero rows deleted. The event still exists for Member A |
| RLS-10 | Unaffiliated | `SELECT` / `INSERT` for pet P | Same denials as the outsider |
| RLS-11 | Anon | `SELECT` / `INSERT` / `UPDATE` / `DELETE` | Denied. No rows visible or changed |
| RLS-12 | Member A | `INSERT` for pet Q | Denied. A member cannot write another household's pet |

RLS-5 is the "shared by design" rule for sequential access: Member B acts after Member A's insert has committed. It does not cover two inserts in flight at once. That case is CI-1.

RLS-6 through RLS-12 are the non-member rule, split by actor so a policy that only filters `SELECT` cannot pass.

**Blocked on F3:** a member `UPDATE` that sets `pet_id` from P to Q. That is the usual `WITH CHECK` companion to these policies, but it is not stated separately from "match the existing shape," and the existing shape is not in the repo.

### Concurrent inserts

**CI-1. Concurrent inserts from two household members.**

Database layer. Two authenticated clients, Member A and Member B, both in household H.

Both insert an event for pet P at the same time: the two inserts are in flight together, not one after the other. After both commits:

- Both rows exist.
- The ids are distinct.
- Member A and Member B each see both rows.

This is the lost-update race the data model cites. A per-day jsonb blob is one shared row, so two household members logging at once can overwrite each other and drop an event. `pet_events` gives each insert its own row. RLS-5 does not lock this: a policy can allow sequential reads and writes and still lose one of two overlapping inserts if the write path collapses them onto one row.

### A malformed `data` payload does not crash the client

**RD-1. The read path does not throw.**

Pass each of these rows through the read parser and through the context fetch that copies rows into `events`. None of them throw. The provider still renders. `events` is still an array.

| Row | Why it is unexpected |
|---|---|
| `data: {}` | Valid jsonb default, not a valid typed payload for any registry type that requires fields |
| `data: { size: 99 }` | Out of the documented 1..5 range |
| `data: { size: "3" }` | Right key, wrong JSON type |
| `data: { size: null }` | Explicit null |
| `data: []` | Array instead of object |
| `data: { unexpected: true }` | Unknown keys only |
| `event_type: "not_a_registered_type"` with `data: {}` | Type the union does not list |
| `event_type: "potty_pee"` with `data: {}` | Known name, missing required fields, including if that type is not part of the step 0 union |

**RD-2. A write of a payload the parser rejects does not throw out of the provider.**

Call `addEvent` with a payload the read parser would reject. The call does not throw, because the existing mutation methods do not throw on bad persist input either — they return `void`.

What the function does *instead* of throwing (no-op, drop, persist anyway) is [F5](#f5-validation-failure-mode-is-unspecified) and [F4](#f4-which-types-exist-in-step-0). RD-2 asserts only the absence of a crash.

**RD-3. Do not assert the fate of the bad row.**

Blocked by [F5](#f5-validation-failure-mode-is-unspecified). Presence in `events`, omission, or an error field are all unspecified. RD-1 and RD-2 are satisfied as long as the client does not crash.

---

## Cases the spec already decides

These are in scope for step 0 and do not depend on a finding, except where noted.

**SC-1. Columns match the data-model `CREATE TABLE`.**

`id uuid primary key default gen_random_uuid()`, `pet_id uuid not null references pets(id) on delete cascade`, `event_type text not null`, `occurred_at timestamptz not null default now()`, `local_date date not null`, `data jsonb not null default '{}'::jsonb`, `logged_by uuid references profiles(id)` (nullable), `created_at timestamptz not null default now()`, `updated_at timestamptz` (nullable, no default).

`event_type` is `text`, not a Postgres enum. That matches the SQL block. The open question about an enum is already leaned away from, and is non-blocking.

**SC-2. Indexes.**

- `pet_events_pet_date_idx` on `(pet_id, local_date)`
- `pet_events_pet_type_time_idx` on `(pet_id, event_type, occurred_at desc)`

**SC-3. No check constraint on `data`.**

The spec says Postgres cannot enforce per-type payload rules and that validation lives in TypeScript. The migration does not add a check on `data->>'size'` or any other payload key.

**SC-4. Foreign key `pet_id` is `ON DELETE CASCADE`.**

Assert the constraint. Do not assert a pet-delete RLS flow; pet deletion is not part of this spec.

**SC-5. Scope guards.**

The step 0 migration and client change do not:

- create `potty_events` or `pet_schedules`
- add `settings.potty_tracking_enabled` or `pets.size_class`
- alter `daily_logs`
- add a partial index, check, or policy that treats events as rare or optional (for example, excluding an event type, or enabling the table only when a flag is set)

**SC-6. `removeEvent` deletes the row optimistically.**

Defer the mocked delete. After `removeEvent(id)` returns, `events` no longer contains that id. The delete is issued with that id. The row is not soft-deleted. On rejection, it stays gone, matching OP-2 and `persistLog`.

**SC-7. `created_at` is not part of the update payload.**

The spec marks `created_at` system-owned and immutable. `updateEvent` does not send `created_at`.

**SC-8. The fetch for a view, when it runs, filters columns rather than `data`.**

Filters are `pet_id` and `local_date` (the `viewDate`). It does not filter on `data->>...`. The spec forbids correctness-critical logic on the jsonb payload.

When that query is allowed to run at all is [F6](#f6-fetch-gating-with-no-feature-flag). SC-8 applies to the query the primitive builds. It does not require the query to run on mount.

**UE-1. Optimistic `updateEvent` applies the patch before the update resolves.**

Defer the mock. A data patch is visible on the row in `events` before the promise resolves, and `updateEvent` returns `void` immediately.

---

## Review findings

These are underspecified. They are not resolved by this plan.

### F1. `today()` does not format an arbitrary instant

The spec says to compute `local_date` with "the same helper as `daily_logs`" and names `PetStoreContext.today()`. In the code, `today` is a private function, it is not on the context value, and it only formats the current time.

LD-1 and LD-5 can still be written against `toLocaleDateString("en-CA")`. Phase 2 has to decide whether to export one function that both call sites use. This plan does not choose the function's name, file, or whether `today()` becomes `localDate(instant = new Date())`.

### F2. Who writes the initial `occurred_at`

Three instructions conflict:

1. `occurred_at` defaults to insert time (`default now()`, and the potty spec's "defaults to insert time").
2. `local_date` is computed on the client from that instant, with the same clock as `today()`, and is `NOT NULL` with no database default.
3. The task says `updateEvent` must be the **only** path that writes `occurred_at`.

If `addEvent` omits `occurred_at`, Postgres fills it from the database clock. The client must still send `local_date` from the browser clock. Across local midnight those two clocks land on different days, which is the bug the spec exists to prevent.

If `addEvent` sends `occurred_at` itself, then a path other than `updateEvent` writes the column. That can be read as violating instruction 3, or as "callers cannot pass `occurred_at`; only `updateEvent` changes it after insert." The spec does not say which reading is intended.

**Not chosen.** LD-6 tests the public boundary only. LD-1 asserts the stored `local_date` matches the stored `occurred_at` under the en-CA oracle. The insert payload's inclusion of `occurred_at` stays unasserted until this is decided.

### F3. Existing RLS SQL is not in the repo

`settings` and `daily_logs` policies were applied in the Supabase dashboard (PRD). There is no migration in git, and the Supabase MCP server is not authenticated, so the `USING` / `WITH CHECK` text and the grants were not copied.

RLS-1 through RLS-12 test the behavior the data model states. They do not lock:

- `FOR ALL` versus four policies
- whether `UPDATE` `WITH CHECK` rejects moving `pet_id` to another household
- `GRANT`s to `authenticated` versus `anon`
- the exact helper expression (`profiles.household_id` compared through `pets`)

Phase 2 cannot claim "matching the existing policy shape" until those definitions are pasted into this plan or checked into the repo. Do not invent a predicate.

### F4. Which types exist in the step 0 union

The data-model registry lists `potty_pee`, `potty_poop`, `reactivity`, `schedule_completed`, `weight`, and `incident`, and says every type in use has a union member.

Potty Tracking's own order puts "register the two potty event types" at step 2, after this foundation. The task says step 0 is feature-agnostic and not potty UI. `kibble_scoop` is described as a payload that must fit later (`data: {}`) and is not in the registry.

**Not chosen:** empty union until a feature registers types, all six registry types now, or the six plus `kibble_scoop`.

Consequences that stay unasserted:

- A valid round-trip of any particular payload.
- Per-type required fields on write (`consistency` on `potty_poop`, `schedule_id` on `schedule_completed`, `unit` on `weight`, and the rest).
- Numeric ranges 1..5, except as *unexpected* input in RD-1, which only asserts that the client does not crash.

RD-1 does not depend on this finding.

### F5. Validation failure mode is unspecified

The spec requires parse-and-validate on read and on write, and this task requires that a bad payload does not crash the client. It does not say whether a bad row is dropped, kept as an unknown variant, or reported.

RD-1 and RD-2 stop at "does not throw." Any assertion about the resulting `events` contents is blocked.

### F6. Fetch gating with no feature flag

The data model says the events fetch is gated on whichever feature flag is relevant, so a household with nothing enabled pays no query. Step 0 forbids adding `settings.potty_tracking_enabled`, and no other flag exists.

**Not chosen:** always fetch, never fetch, or a gate with nothing to read.

Blocked until then:

- Whether mount / `visibilitychange` calls `from("pet_events")`.
- The initial contents of `events` for a household with no feature enabled.

SC-8 still applies to the query builder. OP-* and UE-1 still apply once a row is being written. LD-7 still applies to the destination-day read after a move. None of those choose the gate.

### F7. `updateEvent` patch allowlist

The signature is `updateEvent(id, patch)`. The spec says the helper recomputes `local_date` when `occurred_at` changes. It does not say whether `patch` may include `event_type`, `pet_id`, `local_date`, `logged_by`, `created_at`, or `id`.

Unblocked: if `occurred_at` is in the patch, the persisted `local_date` equals the en-CA date of that instant. A caller-supplied `local_date`, if the type even allows it, does not win.

Blocked: assertions that the helper rejects `event_type` or `pet_id` changes.

### F8. Nothing writes `updated_at`

The column is nullable, with no default and no trigger in the schema block. Do not assert that `updateEvent` sets it, and do not add a trigger in order to have something to test.

### F9. Sort direction of `events`

The prose says the list sorts by `occurred_at` for correct chronology. The index is `occurred_at desc`. Ascending versus descending for the context array is not stated. No order assertion.

### F10. No test runner

This plan does not add Vitest, Jest, Playwright, or pgTAP. Choosing one is a review decision before these cases are committed as code. Phase 2 of the task is the foundation implementation, not a harness.

### F11. `logged_by` on insert

The column is a nullable FK to `profiles`. An open, non-blocking question asks whether automation may leave it null. `addEvent(type, data)` has no actor argument. Do not require the insert to set `logged_by`, and do not require it to equal `auth.uid()`.

### F12. No database trigger is specified

"Do not let callers write `occurred_at` directly" is a helper rule. A trigger that recomputes `local_date` or rejects `occurred_at` updates would be a new mechanism. Do not add one to satisfy LD-6, and do not write a test that expects one.

### F13. Direct clock source for the optimistic row

LD-5 and OP-3 assume the client instant and `today()` share a clock. They do not assume `crypto.randomUUID` specifically, only a UUID the client chose before the response. UUID version is unspecified.

### F14. A failed event insert is a worse lie than a failed counter write

OP-2 stands. A failed `addEvent` leaves the optimistic row in place, matching `persistLog` and `persistSettings`, which ignore the Supabase error and do not restore the previous state.

The failure is worse for an event log than for a counter. A failed counter write is an off-by-one the user will notice on the scoop or pill row. A failed event insert shows a logged event that was never stored. The next fetch drops it, with no indication that the log was lost.

This is an open finding for the spec. This amendment does not change OP-2 and does not add rollback, an error surface, or a retry.

---

## Explicitly not tested

- Potty defaults (`size` 3, `consistency` 3, optional `duration_secs`). Those belong to potty step 2.
- Settings toggle, size class, dashboard section, scales, slider.
- Copy that acknowledges a cross-midnight move.
- `pet_schedules`, `next_due_at`, `completeSchedule`.
- Sorting, `updated_at` maintenance, soft delete, and `logged_by` attribution, until the findings above are resolved.
- Multi-timezone households. `local_date` is written from the logging client's timezone, so a household split across timezones can disagree about which day an event belongs to. Accepted and deliberately not handled: two people in different timezones sharing one dog is rare, and navigating to the adjacent day is an adequate workaround. Do not re-raise this as a finding.
