# Potty Tracking — decision record

**Status:** Record of decisions made during the spec phase
**Author:** Rooney
**Spec phase:** 2026-09-21 → 2026-09-24
**Merged as:** PR #13

Companion to [`data-model.md`](./data-model.md), [`potty-tracking.md`](./potty-tracking.md) and [`pet-events-foundation-test-plan.md`](./pet-events-foundation-test-plan.md). Those three say *what* was decided. This says *why*, and what was deliberately not decided.

---

## What we set out to do

| | |
|---|---|
| **The feature** | Log every time the dog pees or poops, with a size, and for poops how loose or firm |
| **Why** | The same coordination problem the app already solves for food — "did she already go out?" Useful for puppies, senior dogs, and food transitions |
| **Hard requirement** | Off by default. It's a gross feature; people who don't want it should never see it |
| **Tone** | Playful, not crude. Usable in a dog park without embarrassment |
| **The tricky bit** | "Small" for a Chihuahua isn't "small" for a Great Dane, so sizes had to mean something relative to the individual dog |
| **Process question** | Hand it to Claude Design first, or spec it first? |
| **Chosen** | Spec first, but deliberately leave the novel controls unspecified and hand *those* to design |

---

## Decisions and their trade-offs

| Decision | Chosen | Given up |
|---|---|---|
| A general event table vs. a potty-specific one | **General** (`pet_events`) | Less validation enforced by Postgres; type safety moves into TypeScript |
| Fold `daily_logs` in at the same time? | **Later, not now, not never** | Two logging patterns coexist. Avoided touching live household data for zero benefit to this feature |
| Size scale | **Normalized per dog** via `pets.size_class` | Requires capturing the dog's size — but only from people who opt in |
| Health analysis | **None. Logging only** | No pattern flags or warnings. Deliberate: that edges toward medical advice |
| Test approach | **Automated, Vitest** | Setup cost. Necessary: the riskiest bug only manifests between 11:50pm and 12:10am and cannot be tested by hand |
| Failed saves | **Visible failed state + retry** (F14, option 3) | More work than ignoring the error. The app claims offline support but has no write queue, and this is the one feature used on a walk |
| RLS roles on `pet_events` | **`TO authenticated`** | Inconsistent with the older tables, which are `TO public`. Fails closed at the role rather than only inside the household expression |
| `DELETE` policy on `pet_events` | **Present** | Diverges from `settings` and `daily_logs`, which have none. Required because `removeEvent` would otherwise silently change zero rows |
| Who writes the implementation | **Cursor, not the spec author** | Slower round-trips. Buys a reviewer who didn't write the code |

---

## Deliberately not decided

These are open by choice. Each has a reason, and reopening one should start from the reason rather than from scratch.

| Punted | Why it's fine for now |
|---|---|
| **Food transitions** | A *span* with a changing ratio, not an event. Genuinely a different shape from `pet_events` and `pet_schedules`. Named and left alone rather than forced into the wrong model. Build a model for it when a second span-shaped feature appears — one instance is a feature, two is a pattern |
| **Offline write queue** | Needs a local queue (IndexedDB) that survives app close, plus a drain trigger. Background Sync doesn't exist in Safari, so on iPhone the realistic trigger is "next app open." An event log is the easy case; `daily_logs` counters are the hard one. The failed-state-and-retry covers the common case |
| **Day boundary at midnight** (F15) | An event logged at 00:30 counts for the new day, so a late-night walk lands on a day the user thinks of as tomorrow. `daily_logs` already has this — kibble resets at midnight — so events make a pre-existing property visible rather than introducing a bug. Eventual fix: a configurable day-start offset (e.g. 4am) applied to `daily_logs` and `pet_events` together |
| **Multi-timezone households** | `local_date` is written from the logging client's timezone, so a household split across zones can disagree about which day an event belongs to. Accepted: rare, and navigating to the adjacent day is an adequate workaround. Recorded in the test plan as not-to-be-re-raised |
| **`daily_logs` consolidation** | The right long-term model — "kibble scoop at 7:02am" is genuinely an event, and per-meal tracking needs it. Wrong moment: it touches live data and rewrites the optimistic-update logic `KibbleTracker` and `ItemTracker` are built on. Constraint to preserve: `pet_events` must represent a kibble scoop with no schema change |
| **Vet export, trends, health flags** | Explicitly out of scope for v1. The data model doesn't block any of them |
| **Broad Supabase grants** | `anon` holds `TRUNCATE` on the public tables — the stock `GRANT ALL` default. Not reachable through PostgREST and `anon` has no raw SQL access, so not a live hole. Separate cleanup, not part of this feature |
| **A cluster of small unknowns** | F1 (helper name), F5 (malformed payload handling), F7 (patch allowlist), F8 (`updated_at`), F9 (sort order), F11 (`logged_by`), F13 (clock source). All non-blocking, all written down in the test plan |

---

## How the spec got reviewed

Worth recording because the process caught things that one pass would not have. Two agents with separate jobs: one wrote and reviewed the spec, the other built against it. Neither had a clean run.

| What happened | Caught by | Why it mattered |
|---|---|---|
| **The two-clocks bug** | Cursor, against the spec author's error | The spec had `occurred_at` default to the database clock while `local_date` was computed from the browser clock. Near midnight they disagree — producing exactly the stranded row the design existed to prevent. Fixed: `addEvent` writes both from one clock reading |
| **A test that could not fail** | The spec author, own error | A test asserting "two people can log at once, both rows exist" passes regardless of implementation — two inserts with distinct primary keys always both succeed. Replaced with CI-1a/CI-1b: assert `.insert()` not `.upsert()`, and no unique constraint on a per-day key. That catches the actual likely mistake, which is copying `persistLog`'s upsert |
| **Failed saves still vanished** | The spec author, a gap neither party had specified | F14 added a "not saved" state, but the refresh replaced state wholesale, so the failed row was discarded anyway. The feature would have shipped looking complete while still losing the event. Fixed by the merge rule in SC-8 and RF-1 through RF-4 |
| **The missing DELETE policy** | Cursor, disagreeing with an instruction | Told to copy the existing tables' RLS, it read them, found no `DELETE` policy at all, and refused — copying would have made `removeEvent` silently do nothing. Flagged at the top of the document rather than buried |
| **What must leave the list** | Cursor, completing an incomplete rule | The merge rule said which rows to keep on refresh but not which to drop. Without the addition, an event deleted by another household member would persist locally forever |
| **The architecture doc went stale** | The spec author | After all the decisions landed in the test plan, `data-model.md` still described the old plan — including the sentence that became F6. Left unfixed, the next four features would have inherited the same contradictions |

Two process notes:

**Cursor's misreadings were treated as signal, not friction.** A misread instruction is evidence the spec was ambiguous at a point the author believed was clear. That signal only exists because the author didn't also write the code.

**The spec author's known blind spot:** sharp at catching deviations *from* the spec, dull at catching places where the spec itself is wrong. Cursor pushing back is the main correction for that, which is why "flag ambiguity rather than resolving it silently" was in every prompt.

---

## Where this leaves the roadmap

`pet_events` and `pet_schedules` between them cover seven of the nine roadmap items:

| Roadmap item | Served by |
|---|---|
| Potty tracking | `pet_events` (`potty_pee`, `potty_poop`) |
| Reactivity log with voice capture | `pet_events` (`reactivity`) |
| Medication overdue alerts | `pet_schedules` |
| Vaccination & shot records | `pet_schedules` |
| Twice-daily per-meal tracking | `pet_events` — needs the `daily_logs` consolidation first |
| Health history & calendar view | read view over both |
| House sitter report | read view over everything |
| Wet food & additive tracking | `settings` + `daily_logs` (existing shapes) |
| Food transitions | span — no model yet, by design |

The cost of this spec phase was mostly not potty tracking. It was the foundation those other features inherit.
