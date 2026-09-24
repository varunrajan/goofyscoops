# GoofyScoops Data Model

**Status:** Proposed
**Author:** Rooney
**Date:** 2026-09-22
**Applies to:** all features from Potty Tracking onward

---

## Why this document exists

Potty tracking was the first feature that didn't fit `daily_logs`, and the first instinct was to give it its own table. That instinct is how an app ends up with fifteen single-purpose tables and no coherent model.

The better move is to name the *shapes* of data this app actually has, build a primitive for each, and let features compose them. This document does that. It should be read before any new feature spec is written, and updated when a new shape genuinely appears.

---

## The shapes

Looking across the current build and the README roadmap, there are four distinct shapes — not one.

| # | Shape | Question it answers | Example |
|---|---|---|---|
| 1 | **Daily counter** | "How many of today's N are done?" | 3 of 4 kibble scoops; allergy pill 1 of 2 |
| 2 | **Event** | "What happened, and when?" | Pee at 6:42am; reactivity spike at the bike |
| 3 | **Schedule** | "When is this next due?" | Flea & tick every 30 days; rabies booster |
| 4 | **Span** | "What state are we in, and how far through?" | Food transition: Kibble A → B over 14 days |

Shape 1 exists today as `daily_logs`. Shapes 2 and 3 are what this document adds. Shape 4 is deliberately left unsolved — see below.

---

## Shape 2: `pet_events`

Anything that happens at a moment in time, is individually addressable, and can be deleted or corrected.

```sql
create table pet_events (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references pets(id) on delete cascade,
  event_type   text not null,
  occurred_at  timestamptz not null default now(),
  local_date   date not null,
  data         jsonb not null default '{}'::jsonb,
  logged_by    uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

create index pet_events_pet_date_idx on pet_events (pet_id, local_date);
create index pet_events_pet_type_time_idx on pet_events (pet_id, event_type, occurred_at desc);
```

### The event type registry

`event_type` discriminates; `data` carries the type-specific payload. Every type in use must be registered here and given a TypeScript member in the discriminated union.

| `event_type` | `data` payload | Introduced by |
|---|---|---|
| `potty_pee` | `{ size: 1..5, duration_secs?: number }` | Potty Tracking |
| `potty_poop` | `{ size: 1..5, consistency: 1..5 }` | Potty Tracking |
| `reactivity` | `{ level: 1..5, trigger?: string, note?: string }` | Reactivity Log (roadmap) |
| `schedule_completed` | `{ schedule_id: uuid, note?: string }` | Schedules (below) |
| `weight` | `{ value: number, unit: 'lb' \| 'kg' }` | future |
| `incident` | `{ kind: string, note?: string }` | future |

### Why jsonb, and what it costs

**What it buys.** One table, one set of RLS policies, one fetch primitive, one context pattern, one set of optimistic-update helpers. A new event type is a TypeScript change and a row in the table above — not a migration, not new policies, not a new code path. Given that the roadmap has at least three more event-shaped features in it, this is the difference between adding a feature and adding infrastructure.

**What it costs.** Postgres cannot constrain `data->>'size'` to 1–5 per type. Type safety lives in TypeScript, at the boundary, and nowhere else. That means:

- Parse and validate on read as well as write. Do not trust a `data` blob just because your own code wrote it — an older client version may have written a different shape.
- Version the payloads implicitly by never removing a field, only adding optional ones. If a payload must change incompatibly, introduce a new `event_type` rather than mutating the old one in place.
- Keep `data` small and flat. It is a payload, not a document.

**When this stops being right.** At the point where a single event type has enough rows and enough analytical querying that jsonb extraction becomes the bottleneck, promote that type to its own table. For a household app measured in thousands of rows, that point is far away and may never arrive. Revisit if any single `event_type` passes ~1M rows.

### Rules

- **`data` is never queried for correctness-critical logic.** Anything the app must filter, sort, or index on belongs in a real column. That is why `pet_id`, `event_type`, `occurred_at`, and `local_date` are columns and everything else is not.
- **Inserts are client-id'd.** Optimistic UI needs a key before the server responds, so generate the `uuid` client-side and pass it in the insert rather than relying on the column default.
- **Events are the record; they are not config.** Nothing derives future behavior from an event row. Config lives in `settings` or `pet_schedules`.

---

## Shape 3: `pet_schedules`

Anything that comes due on an interval.

```sql
create table pet_schedules (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references pets(id) on delete cascade,
  name          text not null,
  interval_days integer not null,
  last_done_at  timestamptz,
  next_due_at   date,
  remind        boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index pet_schedules_due_idx on pet_schedules (pet_id, active, next_due_at);
```

### How it links to events

Completing a schedule does two things:

1. Writes a `pet_events` row of type `schedule_completed` with `{ schedule_id }` in `data`
2. Updates the schedule's `last_done_at` and recomputes `next_due_at`

This is the clean seam: **the schedule holds config and derived due-state; the event stream holds the immutable history.** "When did we last do flea and tick?" is answerable two ways — cheaply off `last_done_at`, or completely off the event history — and they can't disagree, because one is derived from the other.

### Why `next_due_at` is stored, not computed

It could be derived from `last_done_at + interval_days`. Storing it means "what's overdue?" is a single indexed range scan rather than a computed predicate across every row, which matters for the notification job that will eventually run this query for every pet on a schedule. Recompute it in the same write that sets `last_done_at`; never let them drift.

### What this serves

Directly implements two roadmap items — "Medication overdue alerts" and "Vaccination & shot records with renewal reminders" — and the app already has `src/lib/notifications.ts` plus PWA push, so the delivery half exists.

---

## Shape 1: `daily_logs` stays as-is

No change. `daily_logs` remains one row per pet per day holding aggregate counters for kibble, supplements, and meds.

### The known future consolidation

"Kibble scoop given at 7:02am" is genuinely an event, and folding `daily_logs` into `pet_events` would unify the model and give feeding timestamps for free — which is a prerequisite for the "twice-daily feeding with per-meal tracking" roadmap item.

**This is not being done now.** It touches live household data and would rewrite the optimistic-update logic that `KibbleTracker` and `ItemTracker` are built on, for zero benefit to potty tracking. The right time is when per-meal tracking is actually being built.

**What to preserve so it stays possible:** `pet_events` must be able to represent a kibble scoop without contortion — `{ event_type: 'kibble_scoop', occurred_at, data: {} }` should require no schema change whatsoever. It does today. Don't add anything to `pet_events` that assumes events are rare or optional.

**Accept two logging patterns in the meantime.** A daily checklist and an event stream are different shapes and it is not incoherent to have both. The cost of the split is one extra pattern in `PetStoreContext`; the cost of a premature migration is a broken dashboard for a live household.

---

## Shape 4: spans — deliberately unsolved

A food transition is not an event and not a schedule. It is a **span with an interpolated value**: "Kibble A → Kibble B, started Sept 1, 14 days, currently 50/50." It has a start, an end, and a state that is a function of where today falls inside it.

Neither `pet_events` nor `pet_schedules` fits this, and forcing it into either would be worse than leaving it out. Some plausible shapes when it's time:

- A `pet_transitions` table with `from_config`, `to_config`, `started_on`, `days`, and a ramp function evaluated client-side
- A more general `pet_periods` table if a second span-shaped feature appears (medication courses, recovery periods, heat cycles)

**Don't build either until there are two span-shaped features.** One instance is a feature; two is a pattern. Until then, note that the shape exists so nobody tries to cram a transition into the event stream.

---

## Timestamps

This is the part most likely to produce a subtle bug, so it is specified explicitly.

### Two timestamps, not one

| Column | Meaning | Mutable? |
|---|---|---|
| `occurred_at` | When the thing actually happened | **Yes** — user-editable |
| `created_at` | When the row was written | No — system-owned |

A single timestamp cannot distinguish an event logged live from one backfilled an hour later. With both, the list sorts by `occurred_at` (correct chronology) while `created_at` remains available to show "logged later" on a backfilled row — which matters in a two-person household where a partner's backfill would otherwise look like something you missed.

**Split these columns in the first migration even if the edit UI ships later.** Retrofitting the split onto live data is a migration you do not want to run twice. The cost today is one column.

### `local_date` must be recomputed on every `occurred_at` write

`local_date` is denormalized from `occurred_at` so that "today's events" is an indexed equality match, and so that day boundaries agree with `daily_logs` — which the app already keys on `new Date().toLocaleDateString("en-CA")` via `PetStoreContext.today()`. Deriving the local date in Postgres would require timezone handling the app does not do anywhere else.

Because it is denormalized, it goes stale:

- **Compute `local_date` client-side, using the same helper as `daily_logs`.** Never let the two disagree about where a day ends.
- **Recompute it on every update that touches `occurred_at`.** An 11:50pm entry corrected to 12:10am belongs to a different day. If `local_date` is only computed on insert, that row is silently stranded on the wrong date forever and will never appear in any view.
- Callers cannot pass `occurred_at`. `addEvent` writes the initial `occurred_at` and `local_date` from one reading of the clock. `updateEvent` is the only path that changes `occurred_at` after insert, and it recomputes `local_date` in that same write. The column `default now()` stays as a safety net and is not relied on. Case-level detail is in [`specs/pet-events-foundation-test-plan.md`](./pet-events-foundation-test-plan.md).

### Editing across a day boundary

When an edit moves an event to a different `local_date`, it disappears from the current view. That is correct behavior and bad UX if unannounced — the UI must acknowledge the move rather than letting the row silently vanish.

### Why this is easier here than in `daily_logs`

In a jsonb blob keyed by day, a cross-midnight correction means moving data between two rows, and two household members editing concurrently means a lost update on a shared blob. In `pet_events` it is an `UPDATE` of two columns on one row, and concurrent edits touch different rows.

---

## Access control

Household membership is the expression retrieved from the live `settings` and `daily_logs` policies. Quoted from [`specs/pet-events-foundation-test-plan.md`](./pet-events-foundation-test-plan.md) (F3):

```sql
(pet_id IN ( SELECT pets.id
   FROM pets
  WHERE (pets.household_id = ( SELECT profiles.household_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))
```

Everyone in a household can read, insert, update, and delete events for their pets. There is no per-member privacy within a household.

`pet_events` policies are `TO authenticated` for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. This diverges from the live `settings` and `daily_logs` tables, which are `TO public` on `SELECT` and `UPDATE`. Their `INSERT` policies are already `TO authenticated`.

`pet_events` has a `DELETE` policy. The live tables do not. This document requires household members to delete, and the live shape would have made `removeEvent` silently change zero rows.

`pet_schedules`, when it is built, follows the `pet_events` shape (`TO authenticated`, `DELETE` policy present), not the live `settings` / `daily_logs` shape.

Case-level detail is in the test plan.

---

## Context layer

`PetStoreContext` currently exposes a single `log: DailyLog | null`. Both new shapes are lists.

`updateEvent` and `removeEvent` follow the optimistic-update-then-fire-and-forget pattern used by `persistLog` and `persistSettings`. `addEvent` does not. It appends the row optimistically, issues the insert outside the state updater, and sets `saveState` when the insert settles.

Each row in `events` carries a client-only `saveState`: `'pending' | 'saved' | 'failed'`. It is never a column, and it is never sent to or read from the database.

The viewDate read merges into `events`. It does not replace the list. A wholesale replace would drop `'failed'` rows on the next refresh.

```ts
events: PetEvent[]                                  // for (pet_id, viewDate); each row has client-only saveState
addEvent(type, data): void                          // optimistic append, insert outside the updater, saveState on settle
updateEvent(id, patch): void                        // only later change to occurred_at; recomputes local_date in that write
removeEvent(id): void
retryEvent(id): void                                 // re-issues the insert with the same client id

schedules: PetSchedule[]
completeSchedule(id, note?): void                   // writes event + bumps schedule
```

Step 0 always fetches, because no flag exists yet. A feature that adds a flag adds the gate at the same time. The original sentence — fetch gated on whichever feature flag is relevant, so households with nothing enabled pay no query cost — is what F6 in the test plan was.

Case-level detail is in [`specs/pet-events-foundation-test-plan.md`](./pet-events-foundation-test-plan.md).

---

## Roadmap coverage

| Roadmap item | Served by |
|---|---|
| Potty tracking | `pet_events` (`potty_pee`, `potty_poop`) |
| Reactivity log with voice capture | `pet_events` (`reactivity`) |
| Medication overdue alerts | `pet_schedules` |
| Vaccination & shot records | `pet_schedules` |
| Twice-daily per-meal tracking | `pet_events` — needs the `daily_logs` consolidation first |
| Health history & calendar view | read view over `pet_events` + `pet_schedules` |
| House sitter report | read view over everything |
| Wet food & additive tracking | `settings` + `daily_logs` (existing shapes) |
| Food transitions | span — no model yet, by design |

Two new tables cover seven of nine.

---

## Migration order

1. `pet_events` + indexes + RLS policies
2. `pet_events` TypeScript types and the discriminated union
3. Context primitives (`events`, `addEvent`, `updateEvent`, `removeEvent`, `retryEvent`)
4. First consumer: Potty Tracking (see `specs/potty-tracking.md`)
5. `pet_schedules` + `completeSchedule`, when the first schedule feature is built

Steps 1–3 are feature-agnostic infrastructure and are worth doing cleanly, because three more features inherit them.

---

## Open questions

| Question | Owner | Blocking? |
|---|---|---|
| Should `event_type` be a Postgres enum rather than `text`? Enum gives DB-level validation but every new type becomes a migration — which defeats much of the point. Leaning `text` + a TS union + the registry table above. | Engineering | No |
| Does `pet_events` need soft delete (`deleted_at`) rather than hard delete, for eventual undo or audit? | Engineering | No |
| Should `logged_by` be nullable for events created by a future automation, or always attributed to a person? | Engineering | No |
| When per-meal tracking is built, does `daily_logs` migrate or run in parallel during a transition period? | Engineering | No — revisit then |
| Do schedules need arbitrary recurrence (rrule) or is `interval_days` sufficient? Everything on the roadmap is interval-based. | Product | No |
