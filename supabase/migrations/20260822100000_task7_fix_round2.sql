-- Task 7 fix round 2: diagnose unsafe index upgrades, normalize the disabled
-- campaign row, and provide an explicitly confirmed PROCESSING-email recovery.

-- Upgrade safety preflight. Never deduplicate or release these rows here: a
-- duplicate may represent a paid case and requires operator reconciliation.
do $preflight$
declare
  duplicate_groups bigint;
begin
  select pg_catalog.count(*) into duplicate_groups
  from (
    select cohort_id, position_number
    from public.founding_reservations
    where state in ('PENDING_CHECKOUT', 'PURCHASED', 'MANUAL_REVIEW')
    group by cohort_id, position_number
    having count(*) > 1
  ) as duplicate_active_manual_review_positions;

  if duplicate_groups > 0 then
    raise exception using
      message = pg_catalog.format(
        'Found %s duplicate active/manual-review position group(s); active-position index upgrade aborted',
        duplicate_groups
      ),
      detail = 'No reservation or payment was changed. The existing index remains in place because this migration is transactional.',
      hint = 'Operator remediation (v20260822100000): run SELECT cohort_id, position_number, array_agg(reservation_id) FROM public.founding_reservations WHERE state IN (''PENDING_CHECKOUT'', ''PURCHASED'', ''MANUAL_REVIEW'') GROUP BY cohort_id, position_number HAVING count(*) > 1; reconcile each reservation/payment manually, then rerun this migration. Do not auto-delete or release a row.';
  end if;
end;
$preflight$;

-- Only reached when the preflight proves the new predicate can be installed.
drop index if exists public.founding_reservations_active_position_idx;
create unique index if not exists founding_reservations_active_position_idx
  on public.founding_reservations (cohort_id, position_number)
  where state in ('PENDING_CHECKOUT', 'PURCHASED', 'MANUAL_REVIEW');

-- Normalize both missing and existing rows. Existing rows are deliberately
-- disabled and manually full until an operator explicitly reviews launch.
insert into public.founding_cohorts (
  campaign_key, capacity, checkout_enabled, manual_full, service_timezone
) values (
  'founding-fathers-2026', 5, false, true, 'America/Toronto'
)
on conflict (campaign_key) do update set
  capacity = 5,
  checkout_enabled = false,
  manual_full = true,
  service_timezone = 'America/Toronto',
  updated_at = pg_catalog.now();

create or replace function public.recover_founding_processing_email(
  p_campaign_key text,
  p_reservation_id uuid,
  p_operator_email text,
  p_confirmation_token text
)
returns table (reservation_id uuid, state text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cohort public.founding_cohorts%rowtype;
  v_reservation public.founding_reservations%rowtype;
  v_membership public.founding_memberships%rowtype;
  v_outbox public.email_outbox%rowtype;
  v_operator text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_operator_email, '')));
  v_updated integer;
begin
  if pg_catalog.btrim(coalesce(p_campaign_key, '')) <> 'founding-fathers-2026'
     or v_operator = ''
     or p_confirmation_token <> 'I_HAVE_VERIFIED_EMAIL_NOT_SENT' then
    raise exception 'founding PROCESSING recovery confirmation is invalid';
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
  if not found or v_reservation.state <> 'PURCHASED' then
    raise exception 'founding reservation is not purchased';
  end if;

  select * into v_membership
  from public.founding_memberships
  where reservation_id = v_reservation.reservation_id
  for update;
  if not found then raise exception 'founding purchased membership is unavailable'; end if;

  select * into v_outbox
  from public.email_outbox
  where template = 'founding_welcome'
    and state = 'PROCESSING'
    and updated_at <= pg_catalog.now() - interval '30 minutes'
    and payload ->> 'reservation_id' = v_reservation.reservation_id::text
    and payload ->> 'membership_id' = v_membership.id::text
    and payload ->> 'contact_id' = v_membership.contact_id::text
  order by created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'founding email is not a stale linked PROCESSING job';
  end if;

  update public.email_outbox
  set state = 'PENDING', next_attempt_at = pg_catalog.now(),
      last_error_at = null, last_error = null, updated_at = pg_catalog.now()
  where id = v_outbox.id
    and state = 'PROCESSING'
    and updated_at <= pg_catalog.now() - interval '30 minutes';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then raise exception 'founding email recovery lost its claim'; end if;

  insert into public.activities (type, contact_id, contact_name, description)
  values (
    'contact_updated', v_membership.contact_id, null,
    pg_catalog.concat('Founding onboarding email PROCESSING recovery confirmed by ', v_operator)
  );

  return query select v_reservation.reservation_id, 'PENDING'::text, v_outbox.attempts;
end;
$function$;

revoke all on function public.recover_founding_processing_email(text, uuid, text, text) from public;
revoke all on function public.recover_founding_processing_email(text, uuid, text, text) from anon;
revoke all on function public.recover_founding_processing_email(text, uuid, text, text) from authenticated;
grant execute on function public.recover_founding_processing_email(text, uuid, text, text) to service_role;
