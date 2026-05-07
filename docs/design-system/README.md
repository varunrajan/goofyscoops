# GoofyScoops Design System

## Vibe

**Goofy, rounded, high-contrast.** The UI is warm and playful — like a pet owner who takes their dog seriously but doesn't take themselves too seriously. Everything is pill-shaped or heavily rounded, the palette is creamy with loud pops of teal and yellow, and interactions have a springy physical feel.

---

## Color Palette

| Token | Variable | Hex | Usage |
|-------|----------|-----|-------|
| `bg-background` | `--background` | `#F5D6C0` | Page background (warm peach) |
| `text-foreground` | `--foreground` | `#3D3D3D` | Body text (near-black) |
| `bg-goofy-yellow` | `--yellow` | `#FFD166` | Checked/filled circles, selected buttons, stepper controls, invite CTA |
| `bg-goofy-teal` | `--teal` | `#00A896` | Primary CTAs, section labels, date pill, back button, active inputs |
| `bg-goofy-cream` | `--cream` | `#FCF6EC` | List item backgrounds, inline display fields |

### Extended / Inline Values

These appear as hardcoded Tailwind arbitrary values in component JSX:

| Value | Usage |
|-------|-------|
| `#E8DCC8` | Card / section border (`border border-[#E8DCC8]`) |
| `#009183` | Teal hover state (`hover:bg-[#009183]`) |
| `#FFD166/15` | Empty-state section background tint |
| `#00A896/10` | Teal tint for daily total summary background |
| `#00A896/25` | Inactive (locked) circle border |
| `#00A896/30` | Ring around the next-to-check circle |
| `red-50` / `red-600` | Error message background / text |

---

## Typography

**Font families** are loaded via `next/font/google` and injected as CSS variables:

| Variable | Font | Class |
|----------|------|-------|
| `--font-geist-sans` | Geist Sans | `font-sans` |
| `--font-geist-mono` | Geist Mono | `font-mono` |
| Body fallback | `Arial, Helvetica, sans-serif` | (set in `globals.css body`) |

### Sizes in use

`text-xs` · `text-sm` · `text-base` · `text-lg` · `text-xl` · `text-2xl` · `text-3xl` · `text-4xl`

### Weights in use

`font-medium` · `font-semibold` · `font-bold` · `font-extrabold`

### Letter-spacing

- `tracking-tight` — large headings
- `tracking-widest` — section labels (uppercase caps)

---

## Spacing

Tailwind defaults. Notable specific values:

| Context | Classes |
|---------|---------|
| Page container | `max-w-md mx-auto px-4` |
| Page vertical padding | `pt-6 pb-8` (dashboard) · `py-8` (settings) |
| Section gap | `gap-5` (dashboard) · `gap-8` (settings) |
| Card padding | `p-5` (dashboard cards) · `p-6` (settings cards) |
| Section label margin | `mb-3` · `mb-4` · `mb-5` |
| Item row gap | `gap-1` · `gap-1.5` (circles in ItemTracker) |

---

## Border Radius

| Radius | Usage |
|--------|-------|
| `rounded-full` | Buttons (pill CTAs), avatar, tracker circles, date pill, back button, stepper buttons |
| `rounded-3xl` | Section cards, form cards |
| `rounded-2xl` | Empty state boxes, daily total summary |
| `rounded-xl` | Inputs, list items, error banners, inline display fields |

---

## Shadows

| Value | Usage |
|-------|-------|
| `shadow-sm` | Section cards, date pill |
| `shadow-md` | Primary CTAs |

---

## Animation Approach

All interactive circle elements (KibbleTracker, ItemTracker) use **Framer Motion** spring animations:

```ts
transition={{ type: "spring", stiffness: 400, damping: 17 }}
```

- **KibbleTracker circles:** `whileTap={{ scale: 0.8 }}`, `whileHover={{ scale: 1.08 }}`
- **ItemTracker circles:** `whileTap={{ scale: 0.75 }}`
- **Buttons (non-circle):** CSS `active:scale-[0.98] transition-all` — no Framer Motion

The spring feel mimics a physical "squish" — pressing a kibble circle squashes it down, releasing snaps it back. Only the **next-to-check** and **last-checked** (undo) circles are interactive; the rest are `disabled` and skip animation props entirely.

---

## Components

### `KibbleTracker`

**File:** `src/components/KibbleTracker.tsx`

Displays a grid of circles tracking how many kibble scoops have been given.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `checked` | `number` | How many scoops have been checked off |
| `total` | `number` | Total scoops for the day |
| `onToggle` | `(index: number) => void` | Called when a circle is tapped |

#### Layout

`grid grid-cols-3 gap-3 justify-items-center`

#### Circle states

| State | Condition | Visual |
|-------|-----------|--------|
| **Filled** | `i < checked` (not last) | `bg-[#FFD166] border-[#FFD166] text-[#3D3D3D]`, shows `✓`, `cursor-default` |
| **Filled (undo)** | `i === checked - 1` | Same yellow fill but `cursor-pointer`, spring animation enabled |
| **Next to check** | `i === checked` | `bg-transparent border-[#00A896] text-[#00A896] cursor-pointer ring-2 ring-[#00A896]/30 ring-offset-2`, shows number |
| **Locked** | `i > checked` | `bg-transparent border-[#00A896]/25 text-[#00A896]/25 cursor-default`, shows number |

Circle size: `w-[60px] h-[60px]`, minimum touch target: `min-w-[44px] min-h-[44px]`

Each circle has an `aria-label` describing its state for screen readers.

---

### `ItemTracker`

**File:** `src/components/ItemTracker.tsx`

A single row showing a label and a compact row of circles — used for supplements and medications.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Name of the supplement or medication |
| `checked` | `number` | How many doses have been given |
| `total` | `number` | Total doses for the day |
| `onToggle` | `(index: number) => void` | Called when a circle is tapped |

#### Layout

`flex items-center justify-between py-1`

Label on the left; circles on the right with `gap-1.5`.

When `checked >= total`, the label gets `line-through opacity-50`.

#### Circle states

Same filled/next/locked logic as KibbleTracker, same colors. Smaller size: `w-[32px] h-[32px]`, min `min-w-[28px] min-h-[28px]`. Uses `border-[2.5px]` instead of `border-[3px]`.

Animation: `whileTap={{ scale: 0.75 }}` (no whileHover).

---

### `DogAvatar`

**File:** `src/components/DogAvatar.tsx`

Circular dog avatar image, used across multiple pages at varying sizes.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `number` | `56` | Width and height in pixels |

#### Implementation

`next/image` rendering `/dog-avatar.png` with `rounded-full object-cover priority`.

Sizes used across the app: `52` (dashboard greeting), `80` (login/signup/join), `100` (onboarding step 1, join done state).

---

## Pages

### Dashboard (`/`)

Container: `max-w-md mx-auto px-4 pt-6 pb-8 flex flex-col gap-5`

- **Date pill** — `bg-[#00A896] text-white text-sm font-semibold px-5 py-2 rounded-full shadow-sm`
- **Greeting row** — DogAvatar (52px) + `text-lg font-bold text-[#3D3D3D]`, random greeting string
- **Section cards** — `bg-white rounded-3xl p-5 shadow-sm border border-[#E8DCC8]`
- **Section label** — `text-xs font-extrabold tracking-widest uppercase text-[#00A896] mb-3`
- **Kibble count display** — `text-4xl font-extrabold` / `text-xl font-bold text-[#3D3D3D]/40`
- **Empty states** — `bg-[#FFD166]/15 rounded-2xl py-4 px-3 text-center`
- **Settings button** — `bg-[#00A896] text-white font-bold text-base py-3.5 rounded-full shadow-md hover:bg-[#009183]`

### Login (`/login`) and Signup (`/signup`)

Centered layout: `min-h-dvh flex items-center justify-center px-4`

Container: `w-full max-w-sm flex flex-col items-center gap-6`

- DogAvatar at 80px
- Heading: `text-3xl font-extrabold tracking-tight`
- Form card: `bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-4`
- Inputs: `border-2 border-goofy-teal/20 rounded-xl px-4 py-3 text-sm focus:border-goofy-teal`
- Submit CTA: `bg-goofy-teal text-white font-bold text-base py-3.5 rounded-full shadow-md`
- Error banner: `bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl`

### Onboarding (`/onboarding`)

2-step flow with progress dots: `w-2.5 h-2.5 rounded-full` — active `bg-goofy-teal`, inactive `bg-goofy-teal/20`

- **Step 1:** Pet name input, DogAvatar at 100px
- **Step 2:** Scoop size grid (2 cols), daily scoops stepper with yellow +/− buttons, daily total summary card (`bg-goofy-teal/10 rounded-2xl`)
- Selected scoop size: `bg-goofy-yellow text-foreground border-goofy-yellow`

### Settings (`/settings`)

Container: `max-w-md mx-auto px-4 py-8 flex flex-col gap-8`

- Back button: `w-11 h-11 rounded-full bg-goofy-teal/10`
- Cards: `bg-white rounded-3xl p-6 shadow-sm`
- Daily total summary: `bg-goofy-yellow/20 rounded-2xl p-4 text-center`
- List items: `bg-goofy-cream rounded-xl px-4 py-3`
- Invite link box: `bg-goofy-cream rounded-xl px-3 py-2.5`
- Invite CTA: `bg-goofy-yellow text-foreground font-bold`
- Scoop size selector: teal active pill `bg-goofy-teal text-white border-goofy-teal`

### Join (`/join`)

Same centered layout as login/signup. Handles 4 states: `form`, `joining`, `done`, `error`. Uses `Suspense` wrapper to read `?token` from URL search params.

---

## Tech Stack

| Layer | Package | Version |
|-------|---------|---------|
| Framework | Next.js | 16.1.6 |
| React | react / react-dom | 19.2.3 |
| Styling | Tailwind CSS v4 | ^4 |
| Animation | framer-motion | ^12.35.0 |
| Icons | lucide-react | ^0.577.0 |
| Auth / DB | @supabase/ssr + @supabase/supabase-js | ^0.9.0 / ^2.98.0 |
| PostCSS | @tailwindcss/postcss | ^4 |

Tailwind v4 requires no `tailwind.config.js` — all tokens live in `globals.css` via `@theme inline`.
