create table public.pet_events (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  event_type  text not null,
  occurred_at timestamptz not null default now(),
  local_date  date not null,
  data        jsonb not null default '{}'::jsonb,
  logged_by   uuid not null default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create index pet_events_pet_date_idx on public.pet_events (pet_id, local_date);
create index pet_events_pet_type_time_idx on public.pet_events (pet_id, event_type, occurred_at desc);

alter table public.pet_events enable row level security;

create policy "Users can read household pet events"
  on public.pet_events
  for select
  to authenticated
  using (
    (pet_id IN ( SELECT pets.id
       FROM pets
      WHERE (pets.household_id = ( SELECT profiles.household_id
               FROM profiles
              WHERE (profiles.id = auth.uid())))))
  );

create policy "Users can create household pet events"
  on public.pet_events
  for insert
  to authenticated
  with check (
    (pet_id IN ( SELECT pets.id
       FROM pets
      WHERE (pets.household_id = ( SELECT profiles.household_id
               FROM profiles
              WHERE (profiles.id = auth.uid())))))
  );

create policy "Users can update household pet events"
  on public.pet_events
  for update
  to authenticated
  using (
    (pet_id IN ( SELECT pets.id
       FROM pets
      WHERE (pets.household_id = ( SELECT profiles.household_id
               FROM profiles
              WHERE (profiles.id = auth.uid())))))
  );

create policy "Users can delete household pet events"
  on public.pet_events
  for delete
  to authenticated
  using (
    (pet_id IN ( SELECT pets.id
       FROM pets
      WHERE (pets.household_id = ( SELECT profiles.household_id
               FROM profiles
              WHERE (profiles.id = auth.uid())))))
  );

-- Same privileges as settings and daily_logs. Policies are TO authenticated,
-- so anon still cannot read or write through row level security.
grant delete, insert, references, select, trigger, truncate, update
  on table public.pet_events
  to anon, authenticated;
