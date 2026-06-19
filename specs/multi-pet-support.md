# Multi-Pet Support

**Status:** Draft  
**Author:** Rooney  
**Date:** 2026-06-17

---

## Problem Statement

GoofyScoops currently supports only one pet per household. Users who own multiple dogs must create separate accounts to track each pet — or simply don't track the others at all. This limits the app's usefulness for multi-dog households and creates unnecessary friction. The data model already supports multiple pets per household (`pets.household_id`); this feature exposes that capability in the UI.

---

## Goals

1. Users with multiple pets can track each pet independently without creating separate accounts.
2. Switching between pets takes fewer than 2 taps from anywhere in the app.
3. Adding a second (or third) pet reuses the existing onboarding flow with zero new screens required.
4. Each pet retains its own independent settings, supplement config, med config, and daily logs.
5. The active pet is remembered across sessions so returning users land on the last-used pet.

---

## Non-Goals

- **Pet profiles/avatars per pet** — custom images or breeds per pet are out of scope for v1. The generic dog avatar is fine.
- **Shared settings across pets** — each pet is fully independent. No "copy settings from another pet" in v1.
- **Pet deletion** — removing a pet and its historical data is a separate, higher-risk feature.
- **Cross-pet summary views** — a "household overview" showing all pets at once is future scope.
- **Cat/other animal support** — the app is dog-centric; multi-species is a separate initiative.

---

## User Stories

**As a multi-dog owner,** I want to switch between my pets on the dashboard so that I can track each dog's meals and meds without logging out and back in.

**As a multi-dog owner,** I want to add a second pet after completing initial setup so that I don't have to redo onboarding from scratch.

**As a multi-dog owner,** I want each pet's settings (scoop size, supplements, meds) to be independent so that I can configure each dog correctly.

**As a returning user,** I want the app to remember which pet I was last tracking so that I don't have to re-select on every visit.

**As a single-dog owner,** I want the app to look and behave exactly as it does today so that multi-pet support is invisible to me unless I add a second pet.

---

## Requirements

### Must-Have (P0)

- **Pet switcher on dashboard** — A persistent UI element (e.g., pill/tab strip or dropdown near the top of the main screen) showing all pets in the household. Tapping a pet switches the active pet and reloads dashboard data for that pet.
  - Acceptance: Switching pets updates kibble, supplement, and med state to reflect the selected pet's data for today.

- **Active pet state in PetStoreContext** — `PetStoreContext` must expose `activePetId`, `pets` (all pets in household), and `setActivePet(id)`. All data fetching scopes to `activePetId` instead of `limit(1).single()`.
  - Acceptance: Selecting a different pet from the switcher causes the context to re-fetch settings and today's log for that pet without a full page reload.

- **Add a pet post-onboarding** — A way to add a new pet from the Settings page. Reuse the existing 2-step onboarding flow (name → meal setup), calling `create_household_with_pet` (or a new `add_pet_to_household` RPC that skips household creation).
  - Acceptance: After adding a pet, it appears in the switcher and becomes the active pet.

- **Persist last-selected pet** — Store `activePetId` in `localStorage` so returning users land on the last-used pet.
  - Acceptance: Closing and reopening the app restores the last active pet.

- **Settings scoped to active pet** — The settings page reads and writes to the active pet's `pet_id`. The page header shows the active pet's name.
  - Acceptance: Changing scoop size for Pet A does not affect Pet B's settings.

### Nice-to-Have (P1)

- **Pet name displayed on dashboard** — Show the active pet's name near the switcher or greeting so users have visual confirmation of which pet they're viewing.

- **Switcher hidden for single-pet households** — If a user has only one pet, the switcher UI is not shown. This keeps the single-pet experience unchanged.

- **Inline pet rename** — Allow renaming a pet from the Settings page.

### Future Considerations (P2)

- Custom avatar / photo per pet
- Pet deletion with data archive
- Cross-pet household summary
- Per-pet notification schedules

---

## Technical Notes

The Supabase schema is already multi-pet–ready:
- `pets` table has `household_id` — multiple rows per household are valid.
- `settings` and `daily_logs` are both keyed by `pet_id`.
- The only blocking constraint is in `PetStoreContext`: `.limit(1).single()` must be replaced with a full fetch of all pets in the household, plus active-pet selection logic.

A new `add_pet_to_household` Supabase RPC is needed (vs. `create_household_with_pet`) that creates a pet row and default settings row without creating a new household.

---

## Success Metrics

**Leading (1–2 weeks post-launch)**
- % of sessions where the pet switcher is used ≥ 1x (target: meaningful engagement among multi-pet users)
- Zero regression in single-pet user task completion rate (kibble/supplement/med toggles)

**Lagging (1 month post-launch)**
- # of households with 2+ pets created
- Retention parity: multi-pet users retain at same rate as single-pet users

---

## Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| Does `create_household_with_pet` RPC need modification or should we write a separate `add_pet_to_household`? | Engineering | Yes |
| Where should the pet switcher live — above the greeting, or as a tab strip below the date pill? | Design | Yes |
| Should switching pets reset the greeting randomly or persist per-pet? | Design | No |
| What happens if `activePetId` in localStorage refers to a pet that was deleted? | Engineering | No |

---

## Timeline Considerations

- No hard deadlines; designed for a live build demo.
- Recommend implementing in this order: (1) context refactor, (2) switcher UI, (3) add-pet flow, (4) localStorage persistence.
- The context refactor (P0) is the critical path — all other work depends on it.
