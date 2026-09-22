# Potty Tracking

**Status:** Draft — pending design
**Author:** Rooney
**Date:** 2026-09-21
**Roadmap slot:** "Potty tracking" (README → Next)
**Depends on:** [`specs/data-model.md`](./data-model.md) — `pet_events`

---

## Problem Statement

GoofyScoops tracks what goes into the dog. It tracks nothing about what comes out. For puppies in house-training, senior dogs, dogs on new food, and dogs recovering from illness, output is the single most useful daily signal a household has — and it's the thing two people sharing a dog are least likely to have communicated about. "Did she go?" is exactly the same coordination problem as "did you feed her?", which is the problem this app exists to solve.

It is also, unavoidably, a gross feature. Some households will want it; many won't. It must be invisible until deliberately turned on, and once on it must be fast, fun, and non-clinical enough that someone will actually tap it while standing in the yard at 6am.

---

## Goals

1. A household can log every urination and defecation event for a pet, with a per-event size and (for solids) consistency reading.
2. The feature is **off by default** and leaves the dashboard completely unchanged until a user enables it in Settings.
3. Logging a single event takes one tap from the dashboard. Adding detail is optional and never blocks the log.
4. Size ratings are meaningful **relative to the individual dog** — "small" for a Chihuahua is not "small" for a Great Dane.
5. Consistency is captured on a single continuous control with a neutral center, so the common case ("normal") requires no adjustment.
6. The feature reads as playful, not clinical and not juvenile.

---

## Non-Goals

- **Health alerts, pattern detection, or anything resembling medical advice.** No "3 loose stools detected." v1 logs; it does not interpret.
- **Vet export / shareable reports.** Deliberately deferred — see Future Considerations. The data model must not preclude it.
- **Trend charts, streaks, or weekly summaries.** v1 shows today only, consistent with the rest of the dashboard.
- **Location / GPS tagging.**
- **Photo attachment.** No.
- **Accident vs. outside distinction.** House-training is a real use case but adds a dimension; hold for v2.
- **Notifications or reminders** tied to potty events.
- **Retrofitting historical data.** The feature starts logging from the moment it's enabled.

---

## User Stories

**As a puppy owner,** I want to log each time my dog pees or poops so that my partner and I can see whether she's been out recently without texting each other.

**As an owner of a dog on new food,** I want to record how loose or firm each stool was so that I can tell whether the transition is going badly.

**As a household member,** I want to log an event in one tap while I'm outside holding a leash and a bag, so that logging doesn't require standing still and fiddling.

**As a Chihuahua owner,** I want "large" to mean large *for my dog*, so that the rating scale is actually informative.

**As someone who finds this feature gross,** I want to never see it unless I turn it on, so that the app stays pleasant for me.

**As someone who made a mis-tap,** I want to remove the event I just logged, so that a fat-finger doesn't permanently pollute the day's record.

---

## Requirements

### Must-Have (P0)

- **Settings toggle, default off** — A "Potty Tracking" section on `/settings` with a single toggle. When off, no potty UI appears anywhere in the app. When on, the dashboard gains a Potty section.
  - Acceptance: A fresh account sees no trace of potty tracking anywhere until the toggle is flipped.
  - Acceptance: Turning the toggle off hides the dashboard section but **does not delete** existing events. Re-enabling restores them.

- **Dog size capture at enable time** — The first time potty tracking is enabled for a pet, prompt once for the dog's size class (Toy / Small / Medium / Large / Giant). Store on the pet. This is the only new user input the feature requires, and it is collected only from users who opt in — onboarding is untouched.
  - Acceptance: Enabling the toggle on a pet with no size set presents the size picker before the dashboard section appears.
  - Acceptance: Size is editable afterward from the same Settings section.

- **Dashboard Potty section** — A new section card on `/`, following existing dashboard card conventions (`bg-white rounded-3xl p-5 shadow-sm border border-[#E8DCC8]`, section label `text-xs font-extrabold tracking-widest uppercase text-[#00A896] mb-3`). Contains two add actions (pee / poop) and the list of today's logged events.
  - Acceptance: The section respects `viewDate` — navigating to a previous date shows that date's events.

- **One-tap pee logging** — Tapping the pee add-action immediately creates an event with a default size and appends a new row. No modal, no confirmation.
  - Acceptance: Tap → row appears optimistically → persists in background, matching the existing optimistic-update pattern in `PetStoreContext`.

- **Pee size scale (5 points, droplet)** — Each pee row carries a 5-point scale rendered as droplets, small → large, adjustable inline after logging. Defaults to the middle value.
  - Acceptance: Adjusting a row's size updates and persists without a page reload.

- **Pee duration (optional)** — Duration in seconds may be captured on a pee event. Optional, nullable, never required to log. See Open Questions for the proposed capture interaction.

- **One-tap poop logging** — Same as pee: tap → new row, no modal.

- **Poop size scale (5 points)** — Five graduated 💩-style marks, small → large, with an explicit indication that the scale is **relative to this dog**. Defaults to the middle value.
  - Acceptance: The scale's labels or accessory copy reference the dog's size class (e.g. for a Toy dog, the scale is anchored to what's large *for a Toy dog*).

- **Poop consistency slider (5 points, centered)** — A single slider per poop row.
  - **Center (3) = "just right"** and is the default position.
  - **Slid left = looser**, toward diarrhea.
  - **Slid right = firmer**, toward constipated.
  - Acceptance: A newly logged poop sits at center with no interaction required.
  - Acceptance: The endpoints are labeled in plain, non-clinical language.

- **Delete an event** — Any event logged on the current `viewDate` can be removed.
  - Acceptance: Removing a row deletes the underlying event and the row disappears optimistically.

- **Household sync** — Events are visible to everyone in the household, consistent with the rest of the app's data (fetch on mount + on `visibilitychange`, as `PetStoreContext` already does).

- **Per-pet scoping** — Potty tracking is enabled and logged per pet, matching how `settings` and `daily_logs` are already keyed.

### Nice-to-Have (P1)

- **Time-of-day stamp on each row** — Each event row shows the local time it was logged (e.g. "6:42 AM"). Cheap, and the single most useful thing on the row for "has she been out recently?"
- **Daily count summary** — "3 pees · 1 poop" at the top of the section, following the existing daily-total summary treatment (`bg-goofy-teal/10 rounded-2xl`).
- **Goofy empty state** — Matching the existing supplement/med empty-state pattern (`bg-[#FFD166]/15 rounded-2xl py-4 px-3 text-center`) with copy in the app's voice.
- **Who logged it** — Small attribution on each row, useful in a two-person household.

### Future Considerations (P2)

- Vet export for a date range
- Trend view / history calendar
- Accident (indoors) vs. outside flag — pairs naturally with house-training
- Pattern flags with careful non-medical framing
- Correlation with the existing food log ("new kibble started Tuesday")

---

## Technical Notes

### This is not a potty table

`daily_logs` is **one row per pet per day** holding aggregate counters (`kibble_checked: int`, `supplements_status: jsonb` as id→count). It has no per-event timestamps and no per-event attributes. Potty tracking needs individually timestamped events, each carrying its own size, duration, and consistency, and each individually deletable and correctable. Forcing this into `daily_logs.jsonb` would produce a growing unbounded blob rewritten on every tap, with lost-update races between two household members logging at the same time.

But the answer is **not** a `potty_events` table. Potty tracking is the first of at least three event-shaped features on the roadmap (reactivity log, per-meal feeding, health incidents), and a table per feature is how this app ends up with fifteen tables and no coherent model.

**Potty tracking is the first consumer of the generalized `pet_events` table** specified in [`specs/data-model.md`](./data-model.md). That document owns the schema, the timestamp rules, and the access policies. This spec owns only the two event types.

### Event types introduced by this feature

```ts
type PottyPeeEvent = {
  event_type: 'potty_pee'
  data: { size: 1 | 2 | 3 | 4 | 5; duration_secs?: number }
}

type PottyPoopEvent = {
  event_type: 'potty_poop'
  data: { size: 1 | 2 | 3 | 4 | 5; consistency: 1 | 2 | 3 | 4 | 5 }
}
```

Both default `size` to `3`. `consistency` defaults to `3` ("just right"). `duration_secs` is nullable and never required to log.

Register both in the event type table in `specs/data-model.md`.

**Consistency scale direction.** 1 = loosest, 5 = firmest, 3 = normal. Note that the veterinary standard (Purina Fecal Scoring System) runs 1 = hard through 7 = liquid — the opposite direction and a different resolution. Keep the internal values as documented; record the mapping so a future vet export translates rather than migrates.

### Timestamps

Governed by `specs/data-model.md`, but two consequences are specific enough to this feature to restate:

- An event's `occurred_at` defaults to insert time, which is correct for the one-tap live-logging path this feature is designed around.
- It must still be **editable**, because "she went an hour ago and I forgot to log it" is the normal case, not the edge case. The schema supports this from the first migration; whether the edit UI ships in v1 is an open question below.
- Correcting a time across midnight moves the event to a different day and it leaves today's list. The UI must acknowledge this rather than letting the row vanish silently.

### Settings

Add to the `settings` table:

```
potty_tracking_enabled  boolean  not null default false
```

Per-pet, matching the existing per-pet settings model. **Note the household implication:** settings are shared within a household, so one member enabling potty tracking turns it on for everyone sharing that pet. This is consistent with how every other setting in the app behaves, and is the right call — but it's worth being deliberate about, given the feature's nature.

Add to the `pets` table:

```
size_class  text  null   -- 'toy' | 'small' | 'medium' | 'large' | 'giant'
```

Nullable so existing pets are unaffected. Only populated when a user opts into potty tracking.

### Context changes

Potty tracking consumes the generic event primitives added to `PetStoreContext` per `specs/data-model.md` — `events`, `addEvent`, `updateEvent`, `removeEvent` — rather than adding potty-specific methods. The dashboard section filters `events` to the two potty types.

Fetch is gated on `settings.potty_tracking_enabled`, so households that never enable the feature pay no query cost.

One wrinkle the existing counter mutations don't have: optimistic **inserts** need a client-generated id to key the row before the server responds. Generate the UUID client-side and pass it in the insert rather than relying on the DB default. This belongs in the shared `addEvent` helper, not here.

### New to the design system

Both primary controls are net-new. The design system documents no slider of any kind, and no multi-stop graduated scale — every existing tracker control is a row of binary-state circles (`KibbleTracker`, `ItemTracker`). This feature introduces:

1. A **graduated 5-point scale** (droplets and 💩), where marks are ordinal rather than countable
2. A **centered 5-point slider** with semantic endpoints

These need design before implementation, and whatever they become should be documented back into `docs/design-system/README.md` as reusable components — the reactivity log on the roadmap ("threshold level") will want the same scale primitive.

### Accessibility

- Every scale mark and slider needs an `aria-label` and keyboard operability; the existing circle trackers already set this precedent.
- Touch targets: minimum `44px` per the existing `KibbleTracker` standard. Five marks in a row at 44px each is 220px minimum — tight inside a `max-w-md` card with padding. **This is a real layout constraint for design to solve**, not an afterthought.
- Do not encode consistency by color alone.

---

## Design Brief

Four things need design before this is buildable:

1. **The pee droplet scale** — 5 ordinal marks, small → large. How does a mark read as "unfilled"? Does the whole row fill up to the selected point (like a rating) or does one mark highlight?
2. **The poop size scale** — same structure, plus the dog-relative framing. Where does the "relative to your dog" acknowledgment live — persistent label, first-use tooltip, or in the mark labels themselves?
3. **The consistency slider** — centered default, semantic endpoints, no medical vocabulary. This is the hardest one: it must be legible at a glance, funny without being crude, and operable one-handed outdoors.
4. **The section + empty state + settings toggle** — how the Potty section sits alongside Kibble / Supplements / Meds without dominating the dashboard.

**Tone guardrail:** playful, not crude. The bar is that someone would be comfortable using this in a dog park with a stranger glancing at their screen. Goofy is the brand; juvenile is not.

**Constraints for design:** `max-w-md` container, `44px` minimum touch targets, existing palette (`#F5D6C0` peach bg, `#FCF6EC` cream, `#00A896` teal, `#FFD166` yellow, `#3D3D3D` foreground), Framer Motion springs at `stiffness: 400, damping: 17`, one-handed operation.

---

## Success Metrics

**Leading (1–2 weeks post-launch)**
- % of households that enable potty tracking (adoption of an opt-in gross feature is itself the signal)
- Among enabled households: median events logged per day — sustained daily logging is the bar; a single day of logging followed by silence means the interaction failed
- % of poop events where consistency is left at the default center (high = the neutral default is correctly placed; near-100% = the slider isn't being discovered)

**Lagging (1 month post-launch)**
- Retention of enabled vs. non-enabled households
- % of enabled households that later disable it (the honest churn signal for this feature)
- Zero regression in kibble/supplement/med completion rates for non-enabled households

---

## Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| **How is pee duration captured?** Proposal: press-and-hold the add action to time it, release to log — with the resulting droplet size pre-suggested from the duration and adjustable. A plain tap logs without duration. Needs validation: is a stopwatch realistic mid-walk, or is size alone sufficient? | Design | Yes |
| **Are size and duration redundant?** A longer pee is a bigger pee. If duration is the better signal, the droplet scale may be derived rather than user-set. Resolving this could remove a whole control. | Product / Design | Yes |
| How does the 5-mark scale fit inside `max-w-md` at 44px touch targets? | Design | Yes |
| What are the consistency slider's endpoint labels? Needs to avoid both clinical ("diarrhea") and crude. | Design / UX copy | Yes |
| Is the feature called "Potty" in the UI? README roadmap says "Potty tracking"; data model uses `potty_*`. Alternatives: "Business", "Outside", "Bathroom". | UX copy | No |
| Does the dashboard section collapse when empty, or always show the add actions? | Design | No |
| Should size class be captured as a 5-point class, or as a weight in lbs/kg mapped to classes? Weight is more precise but adds a unit choice. | Product | No |
| Does the **edit-time UI** ship in v1? Schema supports it from day one regardless; the question is only whether the control is built now. Backfilling is common enough that v1 is defensible. | Product | No |
| Should disabling the toggle offer to delete existing events, or silently retain them? Spec currently says retain. | Product | No |

---

## Implementation Order

0. **Data model foundation** — `pet_events` table, indexes, RLS, TS types, and the four context primitives, per `specs/data-model.md` steps 1–3. Feature-agnostic; three later features inherit it.
1. **Migration** — `settings.potty_tracking_enabled`, `pets.size_class`
2. **Context** — register the two potty event types; gate the `events` fetch on the flag
3. **Settings** — toggle + size class capture (shippable and testable on its own; the dashboard section simply doesn't render yet)
4. **Design** — the four items in the Design Brief
5. **Dashboard section** — event list + add actions
6. **Scale + slider components** — built from design output, documented back into the design system

Steps 1–3 do not depend on design and can start immediately. Step 4 is the critical path for 5–6.
