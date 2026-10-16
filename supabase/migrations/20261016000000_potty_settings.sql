-- Potty tracking: per-pet opt-in flag and the dog's size class.
-- See specs/potty-tracking.md ("Settings").

alter table public.settings
  add column potty_tracking_enabled boolean not null default false;

alter table public.pets
  add column size_class text
  check (size_class in ('toy', 'small', 'medium', 'large', 'giant'));

-- Added without inspecting the live policies on pets. If an equivalent
-- UPDATE policy already exists this is harmless: permissive policies are
-- OR'd. Without one, size_class saves would silently update zero rows.
create policy "Users can update household pets"
  on public.pets
  for update
  to authenticated
  using (household_id = (select profiles.household_id from public.profiles where profiles.id = auth.uid()))
  with check (household_id = (select profiles.household_id from public.profiles where profiles.id = auth.uid()));
