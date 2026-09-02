-- Founding CRM cross-contract hardening.
-- These privileged functions are deliberately narrow: the route validates the
-- Stripe object, and the database boundary repeats the exact campaign/payment
-- predicates before touching inventory or CRM data.

create or replace function public.mark_founding_session_manual_review(
  p_campaign_key text,
  p_stripe_session_id text,
  p_stripe_event_id text,
  p_reason text
)
returns table (reservation_id uuid, state text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cohort public.founding_cohorts%rowtype;
  v_reservation public.founding_reservations%rowtype;
  v_reservation_id uuid;
  v_state text;
  v_reason text := pg_catalog.left(pg_catalog.btrim(coalesce(p_reason, '')), 500);
begin
  if pg_catalog.btrim(coalesce(p_campaign_key, '')) <> 'founding-fathers-2026'
     or pg_catalog.btrim(coalesce(p_stripe_session_id, '')) = ''
     or pg_catalog.btrim(coalesce(p_stripe_event_id, '')) = ''
     or v_reason = '' then
    raise exception 'founding manual-review input is invalid';
  end if;

  -- Lock the configured cohort first, matching all other founding state
  -- transitions. The reservation lookup is therefore campaign-scoped and the
  -- state/audit writes commit or roll back together.
  select * into v_cohort
  from public.founding_cohorts
  where campaign_key = pg_catalog.btrim(p_campaign_key)
  for update;
  if not found then raise exception 'founding cohort is unavailable'; end if;

  select * into v_reservation
  from public.founding_reservations
  where cohort_id = v_cohort.id
    and stripe_session_id = pg_catalog.btrim(p_stripe_session_id)
  for update;

  if found then
    v_reservation_id := v_reservation.reservation_id;
    if v_reservation.state <> 'PURCHASED' then
      update public.founding_reservations
      set state = 'MANUAL_REVIEW', updated_at = pg_catalog.now()
      where reservation_id = v_reservation.reservation_id;
      v_state := 'MANUAL_REVIEW';
    else
      v_state := 'PURCHASED';
    end if;
  end if;

  insert into public.stripe_webhook_events (
    stripe_event_id, event_type, processing_state, error_summary,
    reservation_id, processed_at, updated_at
  ) values (
    pg_catalog.btrim(p_stripe_event_id), 'checkout.session.completed', 'FAILED',
    v_reason, v_reservation_id, pg_catalog.now(), pg_catalog.now()
  ) on conflict (stripe_event_id) do update set
    processing_state = 'FAILED', error_summary = excluded.error_summary,
    reservation_id = excluded.reservation_id, processed_at = excluded.processed_at,
    updated_at = excluded.updated_at
  where public.stripe_webhook_events.reservation_id is null
     or public.stripe_webhook_events.reservation_id = excluded.reservation_id;

  return query select v_reservation_id,
    coalesce(v_state, 'NOT_FOUND');
end;
$function$;

-- Keep the historical implementation available only to the new validated
-- wrapper. It is not executable by any API role after this migration.
revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from public;
revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from anon;
revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from authenticated;
revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from service_role;

create or replace function public.fulfill_founding_checkout(
  p_campaign_key text,
  p_price_id text,
  p_product_id text,
  p_stripe_event_id text,
  p_event_type text,
  p_stripe_session_id text,
  p_payment_intent_id text,
  p_stripe_customer_id text,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_amount_cents integer,
  p_currency text default 'usd',
  p_paid_at timestamptz default null
)
returns table (reservation_id uuid, contact_id uuid, membership_id uuid, result text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cohort public.founding_cohorts%rowtype;
  v_reservation public.founding_reservations%rowtype;
begin
  if pg_catalog.btrim(coalesce(p_campaign_key, '')) <> 'founding-fathers-2026'
     or pg_catalog.btrim(coalesce(p_price_id, '')) <> 'price_1UBFsOK67H8U3fOqRw3dEIhw'
     or pg_catalog.btrim(coalesce(p_product_id, '')) <> 'prod_VBd8KVVN9wW0cM'
     or pg_catalog.btrim(coalesce(p_event_type, '')) <> 'checkout.session.completed'
     or pg_catalog.btrim(coalesce(p_stripe_event_id, '')) = ''
     or pg_catalog.btrim(coalesce(p_stripe_session_id, '')) = ''
     or pg_catalog.btrim(coalesce(p_payment_intent_id, '')) = ''
     or coalesce(p_amount_cents, -1) <> 39900
     or pg_catalog.lower(pg_catalog.btrim(coalesce(p_currency, ''))) <> 'usd' then
    raise exception 'founding payment contract validation failed';
  end if;

  -- Resolve and lock the configured cohort/reservation before delegating to
  -- the replay-safe implementation. This prevents a session ID from another
  -- campaign from being fulfilled through the legacy global lookup.
  select * into v_cohort
  from public.founding_cohorts
  where campaign_key = pg_catalog.btrim(p_campaign_key)
  for update;
  if not found then raise exception 'founding cohort is unavailable'; end if;
  select * into v_reservation
  from public.founding_reservations
  where cohort_id = v_cohort.id
    and stripe_session_id = pg_catalog.btrim(p_stripe_session_id)
  for update;
  if not found then
    return query select null::uuid, null::uuid, null::uuid, 'FAILED'::text;
    return;
  end if;

  -- Names come from the locked reservation created before Checkout. Stripe
  -- customer_details is not an authoritative CRM identity source.
  return query
  select * from public.fulfill_founding_checkout(
    p_stripe_event_id,
    p_event_type,
    p_stripe_session_id,
    p_payment_intent_id,
    p_stripe_customer_id,
    p_email,
    v_reservation.first_name,
    v_reservation.last_name,
    p_phone,
    p_amount_cents,
    p_currency,
    p_paid_at
  );
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
  v_membership public.founding_memberships%rowtype;
  v_outbox public.email_outbox%rowtype;
  v_operator text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_operator_email, '')));
begin
  if pg_catalog.btrim(coalesce(p_campaign_key, '')) <> 'founding-fathers-2026' or v_operator = '' then
    raise exception 'founding email retry input is invalid';
  end if;

  select * into v_cohort from public.founding_cohorts
  where campaign_key = pg_catalog.btrim(p_campaign_key) for update;
  if not found then raise exception 'founding cohort is unavailable'; end if;

  select * into v_reservation from public.founding_reservations
  where reservation_id = p_reservation_id and cohort_id = v_cohort.id for update;
  if not found or v_reservation.state <> 'PURCHASED' then
    raise exception 'founding reservation is not purchased';
  end if;

  select * into v_membership from public.founding_memberships
  where reservation_id = v_reservation.reservation_id for update;
  if not found then raise exception 'founding purchased membership is unavailable'; end if;

  select * into v_outbox from public.email_outbox
  where template = 'founding_welcome'
    and state in ('PENDING', 'FAILED')
    and payload ->> 'reservation_id' = v_reservation.reservation_id::text
    and payload ->> 'membership_id' = v_membership.id::text
    and payload ->> 'contact_id' = v_membership.contact_id::text
  order by created_at desc limit 1 for update;
  if not found then raise exception 'founding onboarding email is not linked to purchased membership'; end if;

  update public.email_outbox set state = 'PENDING', next_attempt_at = pg_catalog.now(),
    last_error_at = null, last_error = null, updated_at = pg_catalog.now()
  where id = v_outbox.id;
  insert into public.activities (type, contact_id, contact_name, description)
  values ('contact_updated', v_membership.contact_id, null,
    pg_catalog.concat('Founding onboarding email requeued by ', v_operator));
  return query select v_reservation.reservation_id, 'PENDING'::text, v_outbox.attempts;
end;
$function$;

revoke all on function public.mark_founding_session_manual_review(text, text, text, text) from public;
revoke all on function public.mark_founding_session_manual_review(text, text, text, text) from anon;
revoke all on function public.mark_founding_session_manual_review(text, text, text, text) from authenticated;
grant execute on function public.mark_founding_session_manual_review(text, text, text, text) to service_role;

revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from public;
revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from anon;
revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from authenticated;
grant execute on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, text, text, text, integer, text, timestamptz) to service_role;

revoke all on function public.retry_founding_email(text, uuid, text) from public;
revoke all on function public.retry_founding_email(text, uuid, text) from anon;
revoke all on function public.retry_founding_email(text, uuid, text) from authenticated;
grant execute on function public.retry_founding_email(text, uuid, text) to service_role;
