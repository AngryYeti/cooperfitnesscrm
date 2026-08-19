-- Founding operator hardening: serialize dashboard mutations with the same
-- cohort-before-reservation lock order as checkout fulfillment.

create or replace function public.mark_founding_manual_review(
  p_campaign_key text,
  p_reservation_id uuid,
  p_reason text,
  p_operator_email text
)
returns table (reservation_id uuid, state text, reason text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cohort public.founding_cohorts%rowtype;
  v_reservation public.founding_reservations%rowtype;
  v_reason text := pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]', ' ', 'g')), 240);
  v_operator text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_operator_email, '')));
begin
  if pg_catalog.btrim(coalesce(p_campaign_key, '')) = '' or v_reason = '' or pg_catalog.length(v_reason) < 3 or v_operator = '' then
    raise exception 'founding review input is invalid';
  end if;

  select * into v_cohort
  from public.founding_cohorts
  where campaign_key = pg_catalog.btrim(p_campaign_key)
  for update;
  if not found then raise exception 'founding cohort is unavailable'; end if;

  select * into v_reservation
  from public.founding_reservations
  where reservation_id = p_reservation_id
    and cohort_id = v_cohort.id
  for update;
  if not found then raise exception 'founding reservation is unavailable'; end if;
  if v_reservation.state = 'PURCHASED' then
    raise exception 'purchased founding memberships cannot be moved to manual review';
  end if;
  if v_reservation.state not in ('PENDING_CHECKOUT', 'EXPIRED', 'MANUAL_REVIEW') then
    raise exception 'founding reservation state cannot be reviewed';
  end if;

  update public.founding_reservations
  set state = 'MANUAL_REVIEW', updated_at = pg_catalog.now()
  where reservation_id = v_reservation.reservation_id;

  insert into public.stripe_webhook_events (
    stripe_event_id, event_type, processing_state, error_summary,
    reservation_id, processed_at, updated_at
  ) values (
    pg_catalog.concat('operator_review:', v_reservation.reservation_id::text),
    'operator.manual_review', 'FAILED', v_reason,
    v_reservation.reservation_id, pg_catalog.now(), pg_catalog.now()
  ) on conflict (stripe_event_id) do update set
    processing_state = 'FAILED', error_summary = excluded.error_summary,
    reservation_id = excluded.reservation_id, processed_at = excluded.processed_at,
    updated_at = excluded.updated_at;

  insert into public.activities (type, contact_id, contact_name, description)
  values (
    'contact_updated', null, null,
    pg_catalog.concat('Founding position ', v_reservation.position_number,
      ' marked for manual review by ', v_operator, ': ', v_reason)
  );

  return query select v_reservation.reservation_id, 'MANUAL_REVIEW'::text, v_reason;
end;
$function$;

create or replace function public.set_founding_checkout_state(
  p_campaign_key text,
  p_closed boolean,
  p_operator_email text
)
returns table (manual_full boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cohort public.founding_cohorts%rowtype;
  v_operator text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_operator_email, '')));
  v_manual_full boolean;
begin
  if pg_catalog.btrim(coalesce(p_campaign_key, '')) = '' or p_closed is null or v_operator = '' then
    raise exception 'founding checkout state input is invalid';
  end if;

  select * into v_cohort
  from public.founding_cohorts
  where campaign_key = pg_catalog.btrim(p_campaign_key)
  for update;
  if not found then raise exception 'founding cohort is unavailable'; end if;

  update public.founding_cohorts
  set manual_full = p_closed, updated_at = pg_catalog.now()
  where id = v_cohort.id
  returning public.founding_cohorts.manual_full into v_manual_full;

  insert into public.activities (type, contact_id, contact_name, description)
  values (
    'contact_updated', null, null,
    pg_catalog.concat('Founding checkout ', case when p_closed then 'closed' else 'reopened' end,
      ' by ', v_operator)
  );
  return query select v_manual_full;
end;
$function$;

create or replace function public.retry_founding_email(
  p_campaign_key text,
  p_reservation_id uuid,
  p_operator_email text
)
returns table (reservation_id uuid, state text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cohort public.founding_cohorts%rowtype;
  v_reservation public.founding_reservations%rowtype;
  v_outbox public.email_outbox%rowtype;
  v_operator text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_operator_email, '')));
begin
  if pg_catalog.btrim(coalesce(p_campaign_key, '')) = '' or v_operator = '' then
    raise exception 'founding email retry input is invalid';
  end if;

  select * into v_cohort
  from public.founding_cohorts
  where campaign_key = pg_catalog.btrim(p_campaign_key)
  for update;
  if not found then raise exception 'founding cohort is unavailable'; end if;

  select * into v_reservation
  from public.founding_reservations
  where reservation_id = p_reservation_id
    and cohort_id = v_cohort.id
  for update;
  if not found then raise exception 'founding reservation is unavailable'; end if;

  select * into v_outbox
  from public.email_outbox
  where template = 'founding_welcome'
    and state in ('PENDING', 'FAILED')
    and payload ->> 'reservation_id' = v_reservation.reservation_id::text
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'founding onboarding email is not retryable'; end if;

  update public.email_outbox
  set state = 'PENDING', next_attempt_at = pg_catalog.now(),
      last_error_at = null, last_error = null, updated_at = pg_catalog.now()
  where id = v_outbox.id;

  insert into public.activities (type, contact_id, contact_name, description)
  values ('contact_updated', null, null,
    pg_catalog.concat('Founding onboarding email requeued by ', v_operator));

  return query select v_reservation.reservation_id, 'PENDING'::text, v_outbox.attempts;
end;
$function$;

-- Partial hold OPEN: HELD only when every remaining slot is actively held.
create or replace function public.get_founding_inventory_state(
  p_campaign_key text default 'founding-2026'
)
returns table (state text, purchased_count integer, pending_count integer, capacity integer)
language sql
security definer
set search_path = ''
as $function$
  with selected as (
    select case
      when c.manual_full or not c.checkout_enabled or counts.purchased_count >= c.capacity then 'FULL'
      -- Full pending: HELD. A partial hold remains OPEN for remaining slots.
      when counts.pending_count >= (c.capacity - counts.purchased_count) then 'HELD'
      else 'OPEN'
    end as state,
    counts.purchased_count,
    counts.pending_count,
    c.capacity
    from public.founding_cohorts as c
    cross join lateral (
      select
        pg_catalog.count(*) filter (where r.state = 'PURCHASED')::integer as purchased_count,
        pg_catalog.count(*) filter (where r.state = 'PENDING_CHECKOUT'
          and r.hold_expires_at > pg_catalog.now())::integer as pending_count
      from public.founding_reservations as r
      where r.cohort_id = c.id
    ) as counts
    where c.campaign_key = p_campaign_key
    limit 1
  )
  select * from selected
  union all
  select 'FULL', 0::integer, 0::integer, 0::integer
  where not exists (select 1 from selected);
$function$;

revoke all on function public.mark_founding_manual_review(text, uuid, text, text) from public;
revoke all on function public.mark_founding_manual_review(text, uuid, text, text) from anon;
revoke all on function public.mark_founding_manual_review(text, uuid, text, text) from authenticated;
grant execute on function public.mark_founding_manual_review(text, uuid, text, text) to service_role;

revoke all on function public.set_founding_checkout_state(text, boolean, text) from public;
revoke all on function public.set_founding_checkout_state(text, boolean, text) from anon;
revoke all on function public.set_founding_checkout_state(text, boolean, text) from authenticated;
grant execute on function public.set_founding_checkout_state(text, boolean, text) to service_role;

revoke all on function public.retry_founding_email(text, uuid, text) from public;
revoke all on function public.retry_founding_email(text, uuid, text) from anon;
revoke all on function public.retry_founding_email(text, uuid, text) from authenticated;
grant execute on function public.retry_founding_email(text, uuid, text) to service_role;

revoke all on function public.get_founding_inventory_state(text) from public;
revoke all on function public.get_founding_inventory_state(text) from anon;
revoke all on function public.get_founding_inventory_state(text) from authenticated;
grant execute on function public.get_founding_inventory_state(text) to service_role;
