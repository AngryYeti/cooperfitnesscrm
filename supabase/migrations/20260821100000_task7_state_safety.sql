-- Task 7 state safety: keep unresolved paid cases occupied, seed the disabled
-- campaign, pin reservation holds, and prevent stale email-worker reclaim.

-- An unresolved paid/manual-review position continues to consume capacity.
drop index if exists public.founding_reservations_active_position_idx;
create unique index if not exists founding_reservations_active_position_idx
  on public.founding_reservations (cohort_id, position_number)
  where state in ('PENDING_CHECKOUT', 'PURCHASED', 'MANUAL_REVIEW');

-- Seed the configured campaign without changing an existing operator row. It
-- remains disabled until an explicit, separately reviewed enablement action.
insert into public.founding_cohorts (
  campaign_key, capacity, checkout_enabled, manual_full, service_timezone
) values (
  'founding-fathers-2026', 5, false, false, 'America/Toronto'
)
on conflict (campaign_key) do nothing;

create or replace function public.create_founding_reservation(
  p_campaign_key text,
  p_email text,
  p_first_name text default '',
  p_last_name text default '',
  p_phone text default null,
  p_hold_minutes integer default 30
)
returns table (
  reservation_id uuid,
  position_number integer,
  state text,
  hold_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cohort public.founding_cohorts%rowtype;
  v_position integer;
  v_normalized_email text;
  v_reservation public.founding_reservations%rowtype;
begin
  v_normalized_email := pg_catalog.lower(pg_catalog.btrim(p_email));
  if coalesce(v_normalized_email, '') = '' then raise exception 'email is required'; end if;
  if p_hold_minutes is distinct from 30 then raise exception 'hold duration must be exactly 30 minutes'; end if;

  select * into v_cohort from public.founding_cohorts
  where campaign_key = pg_catalog.btrim(p_campaign_key) for update;
  if not found then raise exception 'founding cohort is unavailable'; end if;
  if not v_cohort.checkout_enabled or v_cohort.manual_full then
    raise exception 'founding checkout is unavailable';
  end if;

  update public.founding_reservations
  set state = 'EXPIRED', expired_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where cohort_id = v_cohort.id and state = 'PENDING_CHECKOUT'
    and hold_expires_at <= pg_catalog.now();

  select pg_catalog.count(*)::integer into v_position
  from public.founding_reservations
  where cohort_id = v_cohort.id
    and state in ('PENDING_CHECKOUT', 'PURCHASED', 'MANUAL_REVIEW');
  if v_position >= v_cohort.capacity then raise exception 'founding cohort is full'; end if;

  select positions.position_number into v_position
  from pg_catalog.generate_series(1, v_cohort.capacity) as positions(position_number)
  where not exists (
    select 1 from public.founding_reservations as r
    where r.cohort_id = v_cohort.id
      and r.position_number = positions.position_number
      and r.state in ('PENDING_CHECKOUT', 'PURCHASED', 'MANUAL_REVIEW')
  )
  order by positions.position_number limit 1;

  insert into public.founding_reservations (
    cohort_id, position_number, normalized_email, first_name, last_name, phone,
    hold_expires_at
  ) values (
    v_cohort.id, v_position, v_normalized_email,
    pg_catalog.btrim(coalesce(p_first_name, '')),
    pg_catalog.btrim(coalesce(p_last_name, '')),
    nullif(pg_catalog.btrim(coalesce(p_phone, '')), ''),
    pg_catalog.now() + interval '30 minutes'
  ) returning * into v_reservation;

  return query select v_reservation.reservation_id, v_reservation.position_number,
    v_reservation.state, v_reservation.hold_expires_at;
end;
$function$;

create or replace function public.get_founding_inventory_state(
  p_campaign_key text default 'founding-fathers-2026'
)
returns table (state text, purchased_count integer, pending_count integer, capacity integer)
language sql
security definer
set search_path = ''
as $function$
  with selected as (
    select case
      when c.manual_full or not c.checkout_enabled then 'FULL'
      when counts.purchased_count >= c.capacity then 'FULL'
      when counts.pending_count >= (c.capacity - counts.purchased_count) then 'HELD'
      else 'OPEN'
    end as state,
    counts.purchased_count, counts.pending_count, c.capacity
    from public.founding_cohorts as c
    cross join lateral (
      select
        pg_catalog.count(*) filter (where r.state = 'PURCHASED')::integer as purchased_count,
        pg_catalog.count(*) filter (where (r.state = 'PENDING_CHECKOUT' and r.hold_expires_at > pg_catalog.now())
          or r.state = 'MANUAL_REVIEW')::integer as pending_count
      from public.founding_reservations as r where r.cohort_id = c.id
    ) as counts
    where c.campaign_key = p_campaign_key limit 1
  )
  select * from selected
  union all select 'FULL', 0::integer, 0::integer, 0::integer
  where not exists (select 1 from selected);
$function$;

revoke all on function public.create_founding_reservation(text, text, text, text, text, integer) from public;
revoke all on function public.create_founding_reservation(text, text, text, text, text, integer) from anon;
revoke all on function public.create_founding_reservation(text, text, text, text, text, integer) from authenticated;
grant execute on function public.create_founding_reservation(text, text, text, text, text, integer) to service_role;

revoke all on function public.get_founding_inventory_state(text) from public;
revoke all on function public.get_founding_inventory_state(text) from anon;
revoke all on function public.get_founding_inventory_state(text) from authenticated;
grant execute on function public.get_founding_inventory_state(text) to service_role;
