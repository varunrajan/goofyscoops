-- Potty tracking: per-pet opt-in flag and the dog's size class.
-- See specs/potty-tracking.md ("Settings").

alter table public.settings
  add column potty_tracking_enabled boolean not null default false;

alter table public.pets
  add column size_class text
  check (size_class in ('toy', 'small', 'medium', 'large', 'giant'));

-- No UPDATE policy is added here: pets already has
-- "Users can update household pets" (USING household match) in the live
-- project, so size_class saves are covered. Applied 2026-10-16.
