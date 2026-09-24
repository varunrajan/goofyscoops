# Pet events foundation — test plan (Step 0)

**Status:** Phase 1 spec. No implementation and no test code in this change.
**Covers:** `specs/data-model.md` migration order steps 1–3 only.
**Does not cover:** Potty Tracking steps 1–6 (`specs/potty-tracking.md`), except the failed-row design question added there for F14.

## This pass

Resolved this pass: F2, F3, F4, F6, F10, F14. CI-1 rewritten. F15 added.

Still open: F1, F5, F7, F8, F9, F11, F13, F15, the environment for the database-layer tests, and the multi-timezone decision (accepted and deferred, not to be re-raised).

F12 remains a standing directive, not an open question.

**Disagreement, recorded rather than applied.** Live `settings` and `daily_logs` have no `DELETE` policy. Copying that onto `pet_events` would make `removeEvent` fail for household members. `specs/data-model.md` requires delete. RLS-4 therefore expects a `DELETE` policy on `pet_events` using the same household expression. That is a deliberate divergence from the live tables. See [F3](#f3-existing-rls-sql-retrieved).

## Phase split

- **Phase 2a** — write the Vitest tests from this plan. No implementation.
- **Phase 2b** — implement until those tests pass.

2a is reviewed before 2b starts. One agent must not write the tests and the implementation together. Tests written against code that already exists get shaped to fit whatever was built and stop being an independent check.

Cases marked **blocked** wait on an open finding. Phase 2a does not invent the missing assertion.

---

## Scope under test

Feature-agnostic infrastructure only:

1. `pet_events` table, the two indexes in the spec, and RLS that uses the household expression retrieved in F3. `pet_events` also has a `DELETE` policy, which the live tables do not. See the disagreement above.
2. A `PetEvent` type with no registered `event_type` members. Potty registers `potty_pee` and `potty_poop` at its own step.
3. `PetStoreContext` primitives: `events`, `addEvent`, `updateEvent`, `removeEvent`, `retryEvent`. `updateEvent` and `removeEvent` stay optimistic-then-fire-and-forget. `addEvent` does not. It appends optimistically, issues the insert outside the state updater, and sets `saveState` when the insert settles. See F14.
4. `addEvent` writes the initial `occurred_at` and `local_date` from one clock reading. `updateEvent` is the only path that changes `occurred_at` after insert, and that write recomputes `local_date` in the same update.

## Out of scope

- Any potty UI, scale, slider, settings toggle, or `pets.size_class`. The failed-row visual treatment is an open design question in `specs/potty-tracking.md`. This plan does not specify it.
- A `potty_events` table.
- `pet_schedules` and `completeSchedule` (data-model migration order step 5).
- Changes to `daily_logs`, or to kibble, supplement, or med behavior, including their fire-and-forget failure handling.
- An offline write queue.
- The cross-midnight acknowledgement UI. The context list dropping a row whose `local_date` no longer matches `viewDate` is in scope. Announcing that move in the UI is not.
- Soft delete. The written schema has no `deleted_at`. The open question in the data model is non-blocking and is not resolved here.
- A configurable day-start offset. See F15.

## Oracle for `local_date`

`daily_logs` keys the current day with the private helper in `src/context/PetStore.tsx`:

```ts
function today(): string {
  return new Date().toLocaleDateString("en-CA");
}
```

The dashboard compares `viewDate` to `new Date().toLocaleDateString("en-CA")` the same way. There is no stored user timezone. "The user's local timezone" means the runtime default timezone that `toLocaleDateString` already uses.

For an arbitrary instant the spec does not have a helper. `today()` only formats `new Date()`. The agreement oracle for an instant is the same locale call:

```ts
new Date(occurredAt).toLocaleDateString("en-CA")
```

A UTC date slice (`toISOString().slice(0, 10)`) is the wrong oracle. Cases below use instants where the local civil date and the UTC date differ, so that mistake fails.

Frozen zone for the civil-date cases: `America/Los_Angeles` (PDT, UTC−7, on 2026-09-21/22). The test script starts the process in that zone. Setting `process.env.TZ` after startup is not reliable, and the date cases are invalid if the process starts in any other timezone. See [F10](#f10-vitest-is-the-runner).

| Instant (UTC) | Local time (PDT) | en-CA local date | UTC date |
|---|---|---|---|
| `2026-09-22T06:50:00.000Z` | 2026-09-21 23:50 | `2026-09-21` | `2026-09-22` |
| `2026-09-22T07:10:00.000Z` | 2026-09-22 00:10 | `2026-09-22` | `2026-09-22` |

See [F1](#f1-today-does-not-format-an-arbitrary-instant) before exporting or renaming a helper to satisfy this.

## Layers

[F10](#f10-vitest-is-the-runner) is resolved: Vitest is the runner. This pass does not install it and does not write tests.

| Layer | Runner | What it locks |
|---|---|---|
| Pure (`LD-*`, `RD-*`) | Vitest, node environment | Date oracle and payload parse. No React, no network |
| Context (`OP-*`, `UE-*`, `LD-7`) | Vitest + jsdom + `@testing-library/react`. Supabase client mocked with deferred promises | Optimistic state and `saveState` |
| Static guards (`CI-1a`, `CI-1b`) | Vitest, against source and the migration SQL | `insert` rather than `upsert`, and no per-day unique constraint |
| Database (`SC-*`, `RLS-*`, `CI-1c`) | Not Vitest-with-mocks. A real Postgres is required. Mocks cannot exercise RLS | Schema, grants, policies, concurrent inserts |

The script that runs the date cases is:

```json
"test": "TZ=America/Los_Angeles vitest run"
```

The database-layer environment is still open: local Supabase, a Supabase branch, or deferred to manual QA. Not decided here.

---

## Required cases

### `local_date` is recomputed on every write that touches `occurred_at`

**LD-1. Insert stores the en-CA local date of one client clock reading, not the UTC date and not `now()`.**

With the process started in `TZ=America/Los_Angeles` and the event instant `2026-09-22T06:50:00.000Z`:

- The insert payload contains `occurred_at` and `local_date`.
- Both come from a single reading of the time. `local_date` is that reading's `toLocaleDateString("en-CA")`, which is `2026-09-21`.
- `local_date` is not `2026-09-22`.
- The insert does not omit `occurred_at` and does not rely on the column's `default now()`. The default stays in the schema as a safety net only.

`local_date` is `NOT NULL` and has no database default, so the insert payload itself must include it. The client computes it. Postgres does not.

[F2](#f2-one-clock-writes-both-fields) is resolved. This case is unblocked.

**LD-2. An edit across local midnight recomputes `local_date` in the same write.**

Start from the LD-1 row (`local_date = 2026-09-21`). Call `updateEvent` with `occurred_at` set to `2026-09-22T07:10:00.000Z` (00:10 PDT on Sep 22).

- The single update payload contains both the new `occurred_at` and `local_date = 2026-09-22`.
- `local_date` is not left at `2026-09-21`.
- `local_date` is not written in a follow-up update.
- Optimistic state shows `2026-09-22` before the mocked update resolves.
- While `viewDate` is `2026-09-21`, the row leaves `events` as part of that same optimistic update. That is the specified context behavior. No UI copy is asserted.

LD-2 stops once the row has left the old day. LD-7 is the other half.

**LD-7. The destination day shows the moved row.**

Continue from LD-2. `viewDate` is `2026-09-21` and the row is no longer in `events`. Set `viewDate` to `2026-09-22`, the new `local_date`. The viewDate-scoped read runs, because [F6](#f6-step-0-always-fetches) is resolved. After that read completes:

- The same row is in `events`.
- `occurred_at` is `2026-09-22T07:10:00.000Z`.
- `local_date` is `2026-09-22`.
- `saveState` is `'saved'`. The read assigns that client-side. It is not a column.

LD-2 can pass while this fails: the event leaves one day and never arrives on the other. Both halves are required.

**LD-3. A write that touches `occurred_at` recomputes `local_date` even when the instant is unchanged.**

Given a row whose stored `local_date` is wrong for its `occurred_at` (the stranded-row bug the spec describes), `updateEvent(id, { occurred_at: <the same instant> })` persists `local_date` equal to the en-CA date of that instant.

This is the "every write that touches `occurred_at`" rule, not only writes that change the instant.

**LD-4. A data-only update does not move `local_date`.**

`updateEvent` with a patch that does not include `occurred_at` leaves `local_date` as it was. The update sent to the server does not substitute a different day.

What else a patch may contain is [F7](#f7-updateevent-patch-allowlist). LD-4 only requires that omitting `occurred_at` preserves the existing day.

**LD-5. "Now" agrees with `today()`.**

With the clock frozen at `2026-09-22T06:50:00.000Z` and the process started in `TZ=America/Los_Angeles`:

- `new Date().toLocaleDateString("en-CA")` is `2026-09-21`.
- An event inserted at that instant has `local_date === "2026-09-21"`.

Same locale string `daily_logs` already uses. Not a UTC date, and not `toLocaleDateString("en-US")`.

**LD-6. `updateEvent` is the only context method that changes `occurred_at` after insert.**

- The public `addEvent` arguments are `(type, data)`. Callers cannot pass `occurred_at`.
- `addEvent` itself writes the initial `occurred_at` on insert, from the same clock reading as `local_date`. That is required. It is not a violation of this rule.
- `updateEvent` is the only path that changes `occurred_at` after insert, and it recomputes `local_date` in that same write.
- `removeEvent` deletes. It does not update `occurred_at`.
- `retryEvent` re-issues the original insert. It does not invent a new `occurred_at`.
- No other `PetStoreContext` method issues an update of `pet_events.occurred_at`.
- There is no second helper that accepts an `occurred_at` and writes it without recomputing `local_date`.

This is an API-boundary test. It is not a database trigger. [F12](#f12-standing-directive-no-database-trigger) stands.

### Optimistic insert

**OP-1. The row is in `events` with a client id before the insert resolves.**

Defer the mocked `insert` so it does not resolve. Call `addEvent`.

- `addEvent` returns `void` and returns before the insert resolves. Callers do not await it.
- The insert is not started from inside a `setEvents` updater. `addEvent` computes the row, calls `setEvents` once to append it, and issues the insert after that call. When the insert settles it calls `setEvents` again to set `saveState`. This is a deliberate divergence from `toggleKibble`, which calls `persistLog` inside the `setLog` updater. See [F14](#f14-failed-inserts-stay-visible-on-events-only).
- Before the insert resolves, `events` contains the new row with `saveState: 'pending'`.
- `row.id` is a UUID.
- The `insert` payload uses that same `id`, plus the `occurred_at` and `local_date` from LD-1. The id is not taken from a server response, and the code does not rely on `gen_random_uuid()` for the optimistic key.
- The column default may still exist (schema test SC-1). The client overrides it.
- The payload does not contain `saveState`. OP-7 locks that for every write.

**OP-2. A failed insert leaves the row and marks it `'failed'`.**

This used to assert that a failed insert matches `persistLog`: the row stays and the error is ignored. That assertion is withdrawn.

`addEvent` catches the Supabase error. The row stays in `events`. `saveState` becomes `'failed'`. The row is not removed.

This deliberately breaks from `persistLog` and `persistSettings`. A failed counter write is an off-by-one the user eventually notices. A failed event insert shows a logged event that was never stored and, on the next fetch, disappears with no indication. `public/sw.js` sends Supabase requests with `fetch(request)` and no cache fallback, and the app has no write queue, so a failed insert is the ordinary outdoor-on-cellular case. Kibble, supplements, and meds are unchanged.

**OP-3. The optimistic row carries the computed `local_date` before the server responds.**

Under the LD-5 clock, the row in state has `local_date === "2026-09-21"` before the insert resolves. The key and the day are both local. Neither waits on the response.

**OP-4. A deferred insert that rejects leaves the row marked `'failed'`.**

Defer the mocked `insert`, call `addEvent`, then reject the insert.

- The row is still in `events`.
- `saveState` is `'failed'`.
- The row is not removed.

**OP-5. `retryEvent` re-issues the insert with the original id.**

Given a row in `'failed'`, call `retryEvent(id)`.

- The new insert uses that same id.
- A new id is not generated.
- The call is `.insert()`, not `.upsert()`, and it has no `onConflict` option.

**OP-6. A duplicate-key error on retry means the original insert succeeded.**

`retryEvent` rejects with a unique-violation, Postgres SQLSTATE `23505` (Supabase `error.code === "23505"`).

- `saveState` becomes `'saved'`.
- It does not become `'failed'`.
- The row is not removed.

Any other error leaves `saveState` as `'failed'`.

**OP-7. `saveState` is client-only.**

No insert payload and no update payload sent to Supabase contains `saveState`. The migration has no `saveState` column. The viewDate read does not select one.

### RLS

Policies were read from the live project `goofyscoops` (`aaxudbdckpqbsmdyxvlf`) on 2026-09-24. The expressions below are `pg_get_expr` output, not a paraphrase. [F3](#f3-existing-rls-sql-retrieved) quotes the policies, the roles, and the grants.

`pet_events` uses this expression wherever the live policies use it. On `UPDATE`, the live `WITH CHECK` is null, so PostgreSQL applies the `USING` expression to the new row as well. A member `UPDATE` that sets `pet_id` from P to Q fails that check.

Actors:

- **Member A** and **Member B**: two `authenticated` users whose `profiles.household_id` is household H, which owns pet P.
- **Outsider**: an `authenticated` user whose profile is a different household.
- **Unaffiliated**: an `authenticated` user with no household.
- **Anon**: the `anon` role, no session. `auth.uid()` is null.

Pet Q belongs to a different household.

| Id | Actor | Operation | Expected |
|---|---|---|---|
| RLS-1 | Member A | `SELECT` events for pet P | The row is returned. `SELECT` is `TO public` and the `USING` expression matches |
| RLS-2 | Member A | `INSERT` an event for pet P | Insert succeeds. `INSERT` is `TO authenticated` and the `WITH CHECK` expression matches |
| RLS-3 | Member A | `UPDATE` that event without changing `pet_id` | Update succeeds. `UPDATE` is `TO public` and the `USING` expression matches |
| RLS-4 | Member A | `DELETE` that event | Delete succeeds. `pet_events` has a `DELETE` policy with the same expression. This is the divergence from the live tables, which have no `DELETE` policy |
| RLS-5 | Member B | `SELECT`, `UPDATE`, and `DELETE` an event Member A inserted | All succeed, after Member A's insert has committed. No per-member privacy. This is sequential. Overlapping inserts are CI-1c |
| RLS-6 | Outsider | `SELECT` events for pet P | Zero rows. The `USING` expression does not match |
| RLS-7 | Outsider | `INSERT` for pet P | Rejected by `WITH CHECK`. No row is visible to Member A afterward |
| RLS-8 | Outsider | `UPDATE` an event on pet P | Zero rows changed. The existing row fails `USING`. Member A still sees the original values |
| RLS-9 | Outsider | `DELETE` an event on pet P | Zero rows deleted. The `DELETE` policy's expression does not match. The event still exists for Member A |
| RLS-10 | Unaffiliated | `SELECT` / `INSERT` for pet P | `SELECT` returns zero rows. `INSERT` fails `WITH CHECK` |
| RLS-11 | Anon | `SELECT` / `INSERT` / `UPDATE` / `DELETE` | `SELECT` and `UPDATE` are `TO public`, and `auth.uid()` is null, so zero rows are visible or changed. `INSERT` is `TO authenticated`, so anon is not permitted. `DELETE` is denied by the expression |
| RLS-12 | Member A | `INSERT` for pet Q | Rejected by `WITH CHECK` |
| RLS-13 | Member A | `UPDATE` `pet_id` from P to Q | Rejected. Zero rows change. The event remains on pet P. The live `UPDATE` policies store `WITH CHECK` as null, and PostgreSQL then uses the `USING` expression as the check on the new row |

RLS-6 through RLS-13 are the non-member and cross-household rules, split by actor and command so a policy that only filters `SELECT` cannot pass.

### Inserts do not collapse to one row per day

`persistLog` calls `.upsert()` with `onConflict: "pet_id,date"` because `daily_logs` is one row per pet per day (`src/context/PetStore.tsx`). Phase 2 is told to follow that pattern. Copying the upsert onto `pet_events` would leave one row per day that overwrites itself and silently drops events, including two logs from a single user. The previous CI-1 ("both rows exist, distinct ids") cannot fail against that bug: two inserts with distinct primary keys both succeed, and an upsert on `(pet_id, local_date)` would not be what that case called.

**CI-1a. `addEvent` calls `.insert()`, not `.upsert()`.**

Static guard against the source. The insert has no `onConflict` option.

**CI-1b. No unique constraint or unique index on a per-day key.**

Static guard against the migration SQL. No unique constraint and no unique index on `(pet_id, local_date)` or on `(pet_id, event_type, local_date)`. The non-unique indexes in SC-2 remain.

**CI-1c. Two overlapping inserts both persist.**

Database layer. Two `authenticated` clients, Member A and Member B, both in household H. Both insert an event for pet P on the same `local_date`, in flight together, not one after the other. After both commits:

- Both rows exist.
- The ids are distinct.
- Member A and Member B each see both rows.

CI-1a and CI-1b fail if phase 2 copies `persistLog`'s upsert. CI-1c is the database consequence, not a substitute for those two guards.

### A malformed `data` payload does not crash the client

**RD-1. The read path does not throw.**

Pass each of these rows through the read parser and through the context fetch that copies rows into `events`. None of them throw. The provider still renders. `events` is still an array.

Step 0 has no registered event types ([F4](#f4-step-0-ships-an-empty-union)), so every `event_type` is unexpected. The rows below are still required.

| Row | Why it is unexpected |
|---|---|
| `data: {}` | Valid jsonb default, not a typed payload |
| `data: { size: 99 }` | Out of the documented 1..5 range |
| `data: { size: "3" }` | Right key, wrong JSON type |
| `data: { size: null }` | Explicit null |
| `data: []` | Array instead of object |
| `data: { unexpected: true }` | Unknown keys only |
| `event_type: "not_a_registered_type"` with `data: {}` | Type the step 0 union does not list |
| `event_type: "potty_pee"` with `data: {}` | A name potty will register later. In step 0 it is not a member, and the payload is missing fields |

**RD-2. A write of a payload the parser rejects does not throw out of the provider.**

Call `addEvent` with a payload the read parser would reject. The call does not throw. `addEvent` returns `void`.

What the function does instead of throwing (no-op, drop, persist anyway, or mark `'failed'`) is [F5](#f5-validation-failure-mode-is-unspecified). RD-2 asserts only the absence of a crash. F4 no longer blocks this. Step 0 has no valid registered payload to round-trip.

**RD-3. Do not assert the fate of the bad row.**

Blocked by F5. Presence in `events`, omission, or an error field are all unspecified. RD-1 and RD-2 are satisfied as long as the client does not crash.

---

## Cases the spec already decides

These are in scope for step 0 and do not depend on an open finding, except where noted.

**SC-1. Columns match the data-model `CREATE TABLE`.**

`id uuid primary key default gen_random_uuid()`, `pet_id uuid not null references pets(id) on delete cascade`, `event_type text not null`, `occurred_at timestamptz not null default now()`, `local_date date not null`, `data jsonb not null default '{}'::jsonb`, `logged_by uuid references profiles(id)` (nullable), `created_at timestamptz not null default now()`, `updated_at timestamptz` (nullable, no default).

`event_type` is `text`, not a Postgres enum. That matches the SQL block. The open question about an enum is already leaned away from, and is non-blocking.

There is no `saveState` column.

`default now()` on `occurred_at` is present and is not the source of the value `addEvent` sends.

**SC-2. Indexes.**

- `pet_events_pet_date_idx` on `(pet_id, local_date)`
- `pet_events_pet_type_time_idx` on `(pet_id, event_type, occurred_at desc)`

Neither index is unique. CI-1b.

**SC-3. No check constraint on `data`.**

The spec says Postgres cannot enforce per-type payload rules and that validation lives in TypeScript. The migration does not add a check on `data->>'size'` or any other payload key.

**SC-4. Foreign key `pet_id` is `ON DELETE CASCADE`.**

Assert the constraint. Do not assert a pet-delete RLS flow. Pet deletion is not part of this spec.

**SC-5. Scope guards.**

The step 0 migration and client change do not:

- create `potty_events` or `pet_schedules`
- add `settings.potty_tracking_enabled` or `pets.size_class`
- alter `daily_logs`
- add a partial index, check, or policy that treats events as rare or optional (for example, excluding an event type, or enabling the table only when a flag is set)
- change kibble, supplement, or med mutations
- add an offline write queue

**SC-6. `removeEvent` deletes the row optimistically.**

Defer the mocked delete. After `removeEvent(id)` returns, `events` no longer contains that id. The delete is issued with that id. The row is not soft-deleted. F14 does not change `removeEvent`. On rejection, the row stays gone. There is no `'failed'` state for a delete.

**SC-7. `created_at` is not part of the update payload.**

The spec marks `created_at` system-owned and immutable. `updateEvent` does not send `created_at`.

**SC-8. The viewDate read filters columns rather than `data`, and it runs.**

Step 0 always runs this read on mount, when `viewDate` changes, and on `visibilitychange`. There is no feature flag. Filters are `pet_id` and `local_date` (the `viewDate`). It does not filter on `data->>...`. The spec forbids correctness-critical logic on the jsonb payload.

Rows loaded by this read are given `saveState: 'saved'` on the client.

**SC-9. Step 0 registers no event types.**

The `PetEvent` union has no members. `potty_pee` and `potty_poop` are not added in step 0. Potty registers them at its own step.

**UE-1. Optimistic `updateEvent` applies the patch before the update resolves.**

Defer the mock. A data patch is visible on the row in `events` before the promise resolves, and `updateEvent` returns `void` immediately. F14 does not add `saveState` transitions to `updateEvent`.

---

## Review findings

### F1. `today()` does not format an arbitrary instant

Open.

The spec says to compute `local_date` with "the same helper as `daily_logs`" and names `PetStoreContext.today()`. In the code, `today` is a private function, it is not on the context value, and it only formats the current time.

LD-1 and LD-5 are written against `toLocaleDateString("en-CA")`. This plan does not choose the function's name, file, or whether `today()` becomes `localDate(instant = new Date())`. F2 requires one clock reading for `occurred_at` and `local_date`. It does not choose the helper's export.

### F2. One clock writes both fields

Resolved.

`addEvent` sends `occurred_at` explicitly from the client, in the same expression that computes `local_date`. Both derive from a single reading of the time. The column `default now()` stays as a schema safety net and is never relied on.

`updateEvent` is the only path that changes `occurred_at` after insert. `addEvent` setting it on insert is correct, not a violation.

LD-1 and LD-6 are unblocked.

### F3. Existing RLS SQL, retrieved

Resolved. Read-only, from project `goofyscoops` (`aaxudbdckpqbsmdyxvlf`) on 2026-09-24. No table, policy, or grant was created or changed.

RLS is enabled and not forced on both `public.settings` and `public.daily_logs` (`relrowsecurity` true, `relforcerowsecurity` false).

These are separate per-command policies. There is no `FOR ALL` policy. There is no `DELETE` policy on either table.

The `USING` or `WITH CHECK` expression, wherever one is stored, is this `pg_get_expr` text:

```sql
(pet_id IN ( SELECT pets.id
   FROM pets
  WHERE (pets.household_id = ( SELECT profiles.household_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))
```

Household membership is that expression: `pet_id` must be a `pets.id` whose `pets.household_id` equals `profiles.household_id` for `profiles.id = auth.uid()`.

| Table | Policy | Command | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `daily_logs` | `Users can create household daily logs` | `INSERT` | `{authenticated}` | null | the expression |
| `daily_logs` | `Users can read household daily logs` | `SELECT` | `{public}` | the expression | null |
| `daily_logs` | `Users can update household daily logs` | `UPDATE` | `{public}` | the expression | null |
| `settings` | `Users can create household pet settings` | `INSERT` | `{authenticated}` | null | the expression |
| `settings` | `Users can read household pet settings` | `SELECT` | `{public}` | the expression | null |
| `settings` | `Users can update household pet settings` | `UPDATE` | `{public}` | the expression | null |

`information_schema.role_table_grants` for `table_schema = 'public'`, grantee `anon` or `authenticated`, on both `settings` and `daily_logs`, lists the same privileges for each grantee on each table:

`DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`.

The grants include `DELETE`. The policies do not. For `anon` and `authenticated`, RLS denies a command that has no policy. A household member's `DELETE` on `settings` or `daily_logs` therefore changes zero rows.

PostgreSQL, when `WITH CHECK` is omitted, uses the `USING` expression as the check on the new row. The live `UPDATE` policies store `WITH CHECK` as null, so an `UPDATE` that sets `pet_id` from P to Q fails that expression. RLS-13 asserts the rejection. Phase 2 matches the live `UPDATE` shape: `USING` is the expression, `WITH CHECK` is omitted.

**Not copied.** `pet_events` gets a `DELETE` policy the live tables do not have. `USING` is the expression above, `WITH CHECK` is omitted, role is `public`, matching the live `UPDATE` policy's shape. Role `public` rather than `authenticated` follows `SELECT` and `UPDATE`, not `INSERT`. `INSERT` on `pet_events` stays `TO authenticated` with the expression as `WITH CHECK` and `USING` null, matching the live `INSERT` policies. `SELECT` matches the live `SELECT` policies. Grants on `pet_events` match the grant list above.

RLS-1 through RLS-13 assert this shape.

### F4. Step 0 ships an empty union

Resolved.

Step 0 ships the `PetEvent` type with no registered event types. Potty registers `potty_pee` and `potty_poop` at its own step. Step 0 stays feature-agnostic. `kibble_scoop` is not added here.

No step 0 case round-trips a potty payload or any other registered payload. RD-1 still requires that an unexpected shape, including `event_type: "potty_pee"`, does not crash. SC-9 locks the empty union.

### F5. Validation failure mode is unspecified

Open.

The spec requires parse-and-validate on read and on write, and a bad payload must not crash the client. It does not say whether a bad row is dropped, kept as an unknown variant, or reported.

RD-1 and RD-2 stop at "does not throw." Any assertion about the resulting `events` contents is blocked. F14's `'failed'` state is for a failed insert request, not for a payload the parser rejects. This finding does not decide that those are the same.

### F6. Step 0 always fetches

Resolved.

Step 0 always runs the viewDate-scoped read. There is no flag to gate on yet. Potty adds `settings.potty_tracking_enabled` and the gate together, at its own step.

The read runs on mount, when `viewDate` changes, and on `visibilitychange`. LD-7 and SC-8 are unblocked.

### F7. `updateEvent` patch allowlist

Open.

The signature is `updateEvent(id, patch)`. The spec says the helper recomputes `local_date` when `occurred_at` changes. It does not say whether `patch` may include `event_type`, `pet_id`, `local_date`, `logged_by`, `created_at`, or `id`.

Unblocked: if `occurred_at` is in the patch, the persisted `local_date` equals the en-CA date of that instant. A caller-supplied `local_date`, if the type even allows it, does not win.

Blocked: assertions that the helper rejects `event_type` or `pet_id` changes. RLS-13 is the database rejecting a `pet_id` move across households. It is not a TypeScript allowlist.

### F8. Nothing writes `updated_at`

Open.

The column is nullable, with no default and no trigger in the schema block. Do not assert that `updateEvent` sets it, and do not add a trigger in order to have something to test.

### F9. Sort direction of `events`

Open.

The prose says the list sorts by `occurred_at` for correct chronology. The index is `occurred_at desc`. Ascending versus descending for the context array is not stated. No order assertion.

### F10. Vitest is the runner

Resolved.

Vitest is the runner. The split and the `TZ=America/Los_Angeles` script are in [Layers](#layers). This pass does not install Vitest and does not add test code.

Open item, not decided here: where the database-layer tests run. Local Supabase, a Supabase branch, or deferred to manual QA. Those tests are not Vitest tests against a mocked client.

### F11. `logged_by` on insert

Open.

The column is a nullable FK to `profiles`. An open, non-blocking question asks whether automation may leave it null. `addEvent(type, data)` has no actor argument. Do not require the insert to set `logged_by`, and do not require it to equal `auth.uid()`.

### F12. Standing directive: no database trigger

Not an open question.

"Do not let callers write `occurred_at` directly" is a helper rule, now read as F2: callers cannot pass `occurred_at`, `addEvent` writes the initial value, and `updateEvent` is the only later change. A trigger that recomputes `local_date` or rejects `occurred_at` updates would be a new mechanism. Do not add one to satisfy LD-6, and do not write a test that expects one.

### F13. Direct clock source for the optimistic row

Open.

LD-5 and OP-3 assume the client instant and `today()` share a clock. They do not assume `crypto.randomUUID` specifically, only a UUID the client chose before the response. UUID version is unspecified.

### F14. Failed inserts stay visible, on events only

Resolved. Option 3: a visible failed state. Events only.

`addEvent` stops being purely fire-and-forget. On a failed insert the row stays in `events`, is marked as not saved, and the user can retry it.

This deliberately breaks from `persistLog` and `persistSettings`. A failed counter write is an off-by-one the user eventually notices. A failed event insert shows a logged event that was never stored and disappears on the next fetch with no indication. `public/sw.js` handles Supabase hosts with `e.respondWith(fetch(request))` and returns without a cache fallback. There is no write queue anywhere in the app. A lost insert is the normal outdoor-on-cellular case, not an exotic one.

Scope limit: events only. Do not change kibble, supplement, or med behavior. Do not build an offline write queue. `updateEvent` and `removeEvent` are unchanged by this resolution. Their failures are not given a `saveState`.

Context surface for step 0:

- Each row in `events` carries a transient `saveState`: `'pending' | 'saved' | 'failed'`.
- `saveState` is client-only. It is not a `pet_events` column, not in the migration, and never sent to or read from the database.
- An optimistic insert starts as `'pending'`. A successful insert sets `'saved'`. A failed insert sets `'failed'`. A row loaded by the viewDate read is `'saved'`.
- `addEvent` catches the Supabase error and sets `saveState` to `'failed'` rather than ignoring it.
- `retryEvent(id)` re-issues the insert using the same client-generated id.
- A retry that fails with a duplicate-key / unique-violation error (`23505`) means the original insert actually succeeded and only the response was lost. Treat that specific error as success and set `saveState` to `'saved'`. Do not surface it as a failure.

Structural consequence. `toggleKibble` calls `persistLog` from inside `setLog`'s updater callback. `addEvent` cannot follow that shape. It must update state a second time when the insert settles, and calling setState from inside an updater is a React anti-pattern. `addEvent` computes the new row, calls `setEvents` once to append it optimistically, and issues the insert outside the updater, then calls `setEvents` again on settle to set `saveState`. This is a deliberate divergence from the existing pattern.

OP-2 is amended: the row stays and is marked `'failed'`. OP-1 no longer requires the persist call to sit inside the updater. OP-4, OP-5, OP-6, and OP-7 lock the rest. The visual treatment of a `'failed'` row is an open design question in `specs/potty-tracking.md`. It is not specified here.

### F15. Day boundary at midnight

Open. Recorded and deferred. Not resolved. Do not implement it. Do not change `local_date` behavior.

An event logged at 00:30 counts for the new day, so a late-night walk lands on a day the user thinks of as tomorrow. This is not F2. F2 is two clocks disagreeing about one instant. This is not the multi-timezone decision. That decision is two clients in different zones. This is where a single zone cuts the day.

`daily_logs` already has this. Kibble resets at midnight. Events make a pre-existing app property visible. They do not introduce a new bug.

The likely eventual fix is a configurable day-start offset (for example 4am) applied the same way to `daily_logs` and `pet_events`. Not in step 0.

---

## Explicitly not tested

- Potty defaults (`size` 3, `consistency` 3, optional `duration_secs`). Those belong to potty step 2.
- Settings toggle, size class, dashboard section, scales, slider, and the visual treatment of a failed event row.
- Copy that acknowledges a cross-midnight move.
- `pet_schedules`, `next_due_at`, `completeSchedule`.
- Sorting, `updated_at` maintenance, soft delete, and `logged_by` attribution, until the findings above are resolved.
- Multi-timezone households. `local_date` is written from the logging client's timezone, so a household split across timezones can disagree about which day an event belongs to. Accepted and deliberately not handled: two people in different timezones sharing one dog is rare, and navigating to the adjacent day is an adequate workaround. Do not re-raise this as a finding.
- Kibble, supplement, and med failure handling, and any offline write queue.
