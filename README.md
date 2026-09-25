# GoofyScoops

A shared dog care tracker that keeps your whole household in sync — so "did you feed her?" becomes a thing of the past.

Built for households with one dog, two dogs, strong opinions about kibble portions, and at least one person who will absolutely forget the flea and tick meds.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4) ![Supabase](https://img.shields.io/badge/Supabase-auth%20%2B%20db-3ECF8E) ![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-purple)

---

## Features

- **Daily kibble tracking** — tap to log each scoop (size up to 2 cups), undo if you overcounted
- **Supplements & medications** — track daily items per pet with per-dose logging
- **Household sync** — invite anyone in your household; everyone sees the same state in real time
- **Onboarding flow** — set up your pet's name, scoop size, and daily portions in under a minute
- **PWA support** — install on your home screen, works offline, enables push notifications
- **Toggle dates** - go back day-by-day to check past date feedings and usage

---

## Roadmap

### Now
- [Potty tracking](./specs/potty-tracking.md) — useful for illness monitoring for senior dogs, potty training for pups
- [Multi-pet support](./specs/multi-pet-support.md)

### Next
- Medication overdue alerts — interval-based reminders ("it's been 40 days since flea & tick")
- Twice-daily feeding with per-meal tracking
- Wet food & additive tracking (yes, including pumpkin portion limits)

### Later
- Reactivity log with voice capture — log your dog's threshold level and notes mid-walk without fumbling with your phone
  - Likely with gradual voice feature enhancement:
    1. *Simple Voice*: Prove voice → structured data where errors are trivial (scoops, supplements, meds), mapping into schema that already exists
    2. *Reactivity Tracker*: Build data stores for trigger presence, intensity, threshold, reaction, cooldown, and unstructured notes
       - extend the same extraction to reactivity training high-dimensional data captured while the owner is scanning for threats and interrupting behavior in real time; post-hoc recall is expensive to log in a structured manner
    3. *Trends:* surface trends over accumulated log of entries (what worked, which triggers, which actions preceded which outcomes
    4. *Decision Intelligence:* Proactively guide the next outing and make suggestions instead of making users read charts
- Health history & calendar view: know exactly when the last ear infection was before the vet asks
- Vaccination & shot records with renewal reminders
- House sitter report: a shareable summary of your dog's full routine

---

## Tech stack

| Layer | Package | Version |
|---|---|---|
| Framework | Next.js | 16 |
| Styling | Tailwind CSS | v4 |
| Animation | Framer Motion | 12 |
| Icons | Lucide React | latest |
| Auth + DB | Supabase | latest |

Tailwind v4 — no `tailwind.config.js`. All design tokens live in `src/app/globals.css` via `@theme inline`. Design system documented in [`docs/design-system/`](./docs/design-system/).

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You'll need a Supabase project with auth enabled. Copy `.env.local.example` to `.env.local` and add your keys.

---

## Design system

Tokens, component specs, and page layout documentation live in [`docs/design-system/README.md`](./docs/design-system/README.md).

Vibe: goofy, rounded, high-contrast. Cream background, teal and yellow as the two accent colors, spring animations on every interactive circle.

---

*Not currently accepting contributions, but feedback is very welcome.*
