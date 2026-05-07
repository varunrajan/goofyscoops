# GoofyScoops

A shared dog care tracker that keeps your whole household in sync — so "did you feed her?" becomes a thing of the past.

Built for households with one dog, two dogs, strong opinions about kibble portions, and at least one person who will absolutely forget the flea and tick meds.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4) ![Supabase](https://img.shields.io/badge/Supabase-auth%20%2B%20db-3ECF8E) ![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-purple)

---

## Features

- **Daily kibble tracking** — tap to log each scoop, undo if you overcounted
- **Supplements & medications** — track daily items per pet with per-dose logging
- **Household sync** — invite anyone in your household; everyone sees the same state in real time
- **Onboarding flow** — set up your pet's name, scoop size, and daily portions in under a minute

---

## Roadmap

### Now
- PWA support — install on your home screen, works offline, enables push notifications
- Reactivity log with voice capture — log your dog's threshold level and notes mid-walk without fumbling with your phone
- Medication overdue alerts — interval-based reminders ("it's been 40 days since flea & tick")

### Next
- Potty tracking — useful for illness monitoring, puppies, and the occasional hormonal surprise
- Twice-daily feeding with per-meal tracking
- Wet food & additive tracking (yes, including pumpkin portion limits)
- Expanded scoop sizes beyond 1 cup

### Later
- Health history & calendar view — know exactly when the last ear infection was before the vet asks
- Vaccination & shot records with renewal reminders
- House sitter report — a shareable summary of your dog's full routine
- Multi-pet support

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
