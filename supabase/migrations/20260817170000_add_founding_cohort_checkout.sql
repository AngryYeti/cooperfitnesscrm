-- Founding cohort checkout: inventory, fulfillment, and operator-safe outbox.
-- All write paths below are server-only functions. The browser never receives
-- service credentials or purchaser rows.

create extension if not exists pgcrypto;

create table if not exists public.founding_cohorts (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null unique check (btrim(campaign_key) <> ''),
  capacity integer not null default 5 check (capacity between 1 and 5),
  checkout_enabled boolean not null default false,
  manual_full boolean not null default false,
  service_timezone text not null default 'America/Toronto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founding_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null default gen_random_uuid() unique,
  cohort_id uuid not null references public.founding_cohorts(id) on delete restrict,
  position_number integer not null check (position_number > 0),
  state text not null default 'PENDING_CHECKOUT'
    check (state in ('PENDING_CHECKOUT', 'PURCHASED', 'EXPIRED', 'MANUAL_REVIEW')),
  hold_expires_at timestamptz not null,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  normalized_email text not null check (normalized_email <> ''),
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  purchased_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists founding_reservations_active_position_idx
  on public.founding_reservations (cohort_id, position_number)
  where state in ('PENDING_CHECKOUT', 'PURCHASED');

create unique index if not exists founding_reservations_payment_intent_unique_idx
  on public.founding_reservations (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists founding_reservations_cohort_state_idx
  on public.founding_reservations (cohort_id, state);

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  processing_state text not null default 'RECEIVED'
    check (processing_state in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED')),
  error_summary text,
  retry_count integer not null default 0 check (retry_count >= 0),
  reservation_id uuid references public.founding_reservations(reservation_id) on delete set null,
  first_received_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_state_attempt_idx
  on public.stripe_webhook_events (processing_state, next_attempt_at);

create table if not exists public.founding_memberships (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.founding_reservations(reservation_id) on delete restrict,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text not null unique,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  cohort_tag text not null,
  service_start_at timestamptz not null,
  service_end_at timestamptz not null,
  check (service_end_at > service_start_at),
  service_timezone text not null default 'America/Toronto',
  lifecycle_state text not null default 'ACTIVE'
    check (lifecycle_state in ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founding_memberships_contact_idx
  on public.founding_memberships (contact_id);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  template text not null,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  state text not null default 'PENDING'
    check (state in ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  next_attempt_at timestamptz not null default now(),
  last_error_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_outbox_delivery_idx
  on public.email_outbox (state, next_attempt_at);

alter table public.founding_cohorts enable row level security;
alter table public.founding_cohorts force row level security;
alter table public.founding_reservations enable row level security;
alter table public.founding_reservations force row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;
alter table public.founding_memberships enable row level security;
alter table public.founding_memberships force row level security;
alter table public.email_outbox enable row level security;
alter table public.email_outbox force row level security;

-- Backfill only singleton normalized addresses. Existing duplicate emails stay
-- NULL and therefore remain separate contacts rather than being merged.
alter table public.contacts add column if not exists normalized_email text;
update public.contacts as c
set normalized_email = pg_catalog.lower(pg_catalog.btrim(c.email))
where c.email is not null
  and pg_catalog.btrim(c.email) <> ''
  and not exists (
    select 1
    from public.contacts as d
    where d.id <> c.id
      and d.email is not null
      and pg_catalog.btrim(d.email) <> ''
      and pg_catalog.lower(pg_catalog.btrim(d.email)) = pg_catalog.lower(pg_catalog.btrim(c.email))
  );

create unique index if not exists contacts_normalized_email_unique_idx
  on public.contacts (normalized_email)
  where normalized_email is not null;

alter table public.contacts drop constraint if exists contacts_normalized_email_check;
alter table public.contacts add constraint contacts_normalized_email_check
  check (normalized_email is null or normalized_email = pg_catalog.lower(pg_catalog.btrim(normalized_email)));

-- The cohort row lock makes capacity accounting atomic. This function is
-- intentionally private and can only be called by the CRM service role.
create or replace function public.create_founding_reservation(
  p_campaign_key text,
  p_email text,
  p_first_name text default '',
  p_last_name text default '',
  p_phone text default null,
  p_hold_minutes integer default 15
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
  if coalesce(v_normalized_email, '') = '' then
    raise exception 'email is required';
  end if;
  if p_hold_minutes is null or p_hold_minutes not between 1 and 30 then
    raise exception 'hold duration is invalid';
  end if;

  select * into v_cohort
  from public.founding_cohorts
  where campaign_key = pg_catalog.btrim(p_campaign_key)
  for update;

  if not found then
    raise exception 'founding cohort is unavailable';
  end if;
  if not v_cohort.checkout_enabled or v_cohort.manual_full then
    raise exception 'founding checkout is unavailable';
  end if;

  update public.founding_reservations
  set state = 'EXPIRED', expired_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where cohort_id = v_cohort.id
    and state = 'PENDING_CHECKOUT'
    and hold_expires_at <= pg_catalog.now();

  select pg_catalog.count(*)::integer into v_position
  from public.founding_reservations
  where cohort_id = v_cohort.id
    and state in ('PENDING_CHECKOUT', 'PURCHASED');
  if v_position >= v_cohort.capacity then
    raise exception 'founding cohort is full';
  end if;

  select positions.position_number into v_position
  from pg_catalog.generate_series(1, v_cohort.capacity) as positions(position_number)
  where not exists (
    select 1
    from public.founding_reservations as r
    where r.cohort_id = v_cohort.id
      and r.position_number = positions.position_number
      and r.state in ('PENDING_CHECKOUT', 'PURCHASED')
  )
  order by positions.position_number
  limit 1;

  insert into public.founding_reservations (
    cohort_id, position_number, normalized_email, first_name, last_name, phone,
    hold_expires_at
  ) values (
    v_cohort.id, v_position, v_normalized_email,
    pg_catalog.btrim(coalesce(p_first_name, '')),
    pg_catalog.btrim(coalesce(p_last_name, '')),
    nullif(pg_catalog.btrim(coalesce(p_phone, '')), ''),
    pg_catalog.now() + (p_hold_minutes * interval '1 minute')
  )
  returning * into v_reservation;

  return query select v_reservation.reservation_id, v_reservation.position_number,
    v_reservation.state, v_reservation.hold_expires_at;
end;
$function$;

-- Only aggregate counts and one of OPEN/HELD/FULL leave this database.
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
      when counts.pending_count > 0 then 'HELD'
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

create or replace function public.fulfill_founding_checkout(
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
  v_event public.stripe_webhook_events%rowtype;
  v_reservation public.founding_reservations%rowtype;
  v_cohort public.founding_cohorts%rowtype;
  v_cohort_id uuid;
  v_existing_membership public.founding_memberships%rowtype;
  v_contact_id uuid;
  v_membership_id uuid;
  v_normalized_email text;
  v_paid_at timestamptz := coalesce(p_paid_at, pg_catalog.now());
  v_service_end timestamptz;
  v_activity_type text;
begin
  if coalesce(pg_catalog.btrim(p_stripe_event_id), '') = ''
     or coalesce(pg_catalog.btrim(p_stripe_session_id), '') = ''
     or coalesce(pg_catalog.btrim(p_payment_intent_id), '') = '' then
    raise exception 'Stripe event, session, and payment identifiers are required';
  end if;
  v_normalized_email := pg_catalog.lower(pg_catalog.btrim(p_email));
  if coalesce(v_normalized_email, '') = '' then
    raise exception 'purchaser email is required';
  end if;
  if coalesce(pg_catalog.btrim(p_event_type), '') = '' then
    raise exception 'Stripe event type is required';
  end if;

  insert into public.stripe_webhook_events (stripe_event_id, event_type)
  values (p_stripe_event_id, p_event_type)
  on conflict (stripe_event_id) do nothing;

  select * into v_event
  from public.stripe_webhook_events
  where stripe_event_id = p_stripe_event_id
  for update;

  if v_event.processing_state = 'PROCESSED' then
    return query
      select v_event.reservation_id, m.contact_id, m.id, 'REPLAYED'
      from public.founding_memberships as m
      where m.reservation_id = v_event.reservation_id;
    return;
  end if;

  update public.stripe_webhook_events
  set processing_state = 'PROCESSING',
      retry_count = retry_count + 1,
      processing_started_at = pg_catalog.now(),
      error_summary = null,
      updated_at = pg_catalog.now()
  where id = v_event.id;

  -- Keep the durable RECEIVED/PROCESSING claim outside this savepoint. Any
  -- fulfillment error rolls back only the nested work, then is recorded on
  -- the already-claimed event by the nested exception handler below.
  begin
  select cohort_id into v_cohort_id
  from public.founding_reservations
  where stripe_session_id = p_stripe_session_id;
  if found then
    select * into v_cohort
    from public.founding_cohorts
    where id = v_cohort_id
    for update;
    if not found then
      raise exception 'reservation cohort is unavailable';
    end if;
  end if;

  select * into v_reservation
  from public.founding_reservations
  where stripe_session_id = p_stripe_session_id
  for update;
  if not found then
    -- A known payment/customer with a different session is a linkage
    -- mismatch, not a new checkout. Hold it for operator review.
    select cohort_id into v_cohort_id
    from public.founding_reservations
    where (stripe_payment_intent_id = p_payment_intent_id)
       or (p_stripe_customer_id is not null
           and stripe_customer_id = p_stripe_customer_id)
    order by purchased_at desc nulls last
    limit 1;
    if found then
      select * into v_cohort
      from public.founding_cohorts
      where id = v_cohort_id
      for update;
      if not found then
        raise exception 'reservation cohort is unavailable';
      end if;
      select * into v_reservation
      from public.founding_reservations
      where cohort_id = v_cohort_id
        and ((stripe_payment_intent_id = p_payment_intent_id)
          or (p_stripe_customer_id is not null
              and stripe_customer_id = p_stripe_customer_id))
      order by purchased_at desc nulls last
      limit 1
      for update;
      update public.founding_reservations
      set state = 'MANUAL_REVIEW', updated_at = pg_catalog.now()
      where reservation_id = v_reservation.reservation_id;
      update public.stripe_webhook_events
      set processing_state = 'FAILED', error_summary = 'Stripe Checkout Session linkage mismatch',
          reservation_id = v_reservation.reservation_id, updated_at = pg_catalog.now()
      where id = v_event.id;
      return query select v_reservation.reservation_id, null::uuid, null::uuid, 'MANUAL_REVIEW';
      return;
    end if;
    update public.stripe_webhook_events
    set processing_state = 'FAILED', error_summary = 'matching reservation/session not found',
        next_attempt_at = pg_catalog.now() + interval '5 minutes', updated_at = pg_catalog.now()
    where id = v_event.id;
    return query select null::uuid, null::uuid, null::uuid, 'FAILED';
    return;
  end if;

  if (v_reservation.stripe_payment_intent_id is not null
      and v_reservation.stripe_payment_intent_id <> p_payment_intent_id)
     or (v_reservation.stripe_customer_id is not null
      and v_reservation.stripe_customer_id is distinct from p_stripe_customer_id) then
    update public.founding_reservations
    set state = 'MANUAL_REVIEW', updated_at = pg_catalog.now()
    where reservation_id = v_reservation.reservation_id;
    update public.stripe_webhook_events
    set processing_state = 'FAILED', error_summary = 'Stripe payment or customer linkage mismatch',
        reservation_id = v_reservation.reservation_id, updated_at = pg_catalog.now()
    where id = v_event.id;
    return query select v_reservation.reservation_id, null::uuid, null::uuid, 'MANUAL_REVIEW';
    return;
  end if;

  select * into v_existing_membership
  from public.founding_memberships
  where reservation_id = v_reservation.reservation_id
  for update;
  if found then
    if v_existing_membership.stripe_session_id <> p_stripe_session_id
       or v_existing_membership.stripe_payment_intent_id <> p_payment_intent_id
       or v_reservation.state <> 'PURCHASED' then
      update public.founding_reservations
      set state = 'MANUAL_REVIEW', updated_at = pg_catalog.now()
      where reservation_id = v_reservation.reservation_id;
      update public.stripe_webhook_events
      set processing_state = 'FAILED', error_summary = 'existing membership linkage mismatch',
          reservation_id = v_reservation.reservation_id, updated_at = pg_catalog.now()
      where id = v_event.id;
      return query select v_reservation.reservation_id, null::uuid, null::uuid, 'MANUAL_REVIEW';
      return;
    end if;
    update public.stripe_webhook_events
    set processing_state = 'PROCESSED', reservation_id = v_reservation.reservation_id,
        processed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where id = v_event.id;
    return query select v_reservation.reservation_id, v_existing_membership.contact_id,
      v_existing_membership.id, 'REPLAYED';
    return;
  end if;

  if v_reservation.state = 'EXPIRED' or v_reservation.hold_expires_at <= pg_catalog.now() then
    update public.founding_reservations
    set state = 'MANUAL_REVIEW', updated_at = pg_catalog.now()
    where reservation_id = v_reservation.reservation_id;
    update public.stripe_webhook_events
    set processing_state = 'FAILED', error_summary = 'reservation hold is no longer live',
        reservation_id = v_reservation.reservation_id, updated_at = pg_catalog.now()
    where id = v_event.id;
    return query select v_reservation.reservation_id, null::uuid, null::uuid, 'MANUAL_REVIEW';
    return;
  end if;
  if v_reservation.state not in ('PENDING_CHECKOUT', 'PURCHASED')
     or v_reservation.normalized_email <> v_normalized_email then
    update public.stripe_webhook_events
    set processing_state = 'FAILED', error_summary = 'reservation validation failed',
        reservation_id = v_reservation.reservation_id, updated_at = pg_catalog.now()
    where id = v_event.id;
    return query select v_reservation.reservation_id, null::uuid, null::uuid, 'FAILED';
    return;
  end if;

  insert into public.contacts (
    first_name, last_name, phone, email, normalized_email, status, source, tags
  ) values (
    coalesce(nullif(pg_catalog.btrim(p_first_name), ''), 'Founding'),
    coalesce(nullif(pg_catalog.btrim(p_last_name), ''), 'Member'),
    nullif(pg_catalog.btrim(coalesce(p_phone, '')), ''),
    p_email, v_normalized_email, 'Active Client', 'Website', array['Founding Cohort']::text[]
  )
  on conflict (normalized_email) where normalized_email is not null
  do update set updated_at = pg_catalog.now(), email = coalesce(public.contacts.email, excluded.email)
  returning id into v_contact_id;

  -- Apply the 12-week term to the local calendar in the cohort policy
  -- timezone, then convert the resulting local instant back to timestamptz.
  v_service_end := (v_paid_at at time zone v_cohort.service_timezone + interval '12 weeks')
    at time zone v_cohort.service_timezone;
  insert into public.founding_memberships (
    reservation_id, stripe_session_id, stripe_payment_intent_id, contact_id,
    cohort_tag, service_start_at, service_end_at, service_timezone
  ) values (
    v_reservation.reservation_id, p_stripe_session_id, p_payment_intent_id, v_contact_id,
    'founding', v_paid_at, v_service_end, v_cohort.service_timezone
  )
  on conflict (reservation_id) do update set updated_at = pg_catalog.now()
  returning id into v_membership_id;

  update public.founding_reservations
  set state = 'PURCHASED', stripe_payment_intent_id = p_payment_intent_id,
      stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
      purchased_at = coalesce(purchased_at, v_paid_at), updated_at = pg_catalog.now()
  where reservation_id = v_reservation.reservation_id;

  insert into public.revenue (
    stripe_event_id, contact_id, product_name, amount_cents, currency, status,
    source, stripe_created_at
  ) values (
    p_stripe_event_id, v_contact_id, 'Founding Cohort Membership', p_amount_cents,
    coalesce(nullif(pg_catalog.lower(p_currency), ''), 'usd'), 'succeeded',
    'checkout.session', v_paid_at
  ) on conflict (stripe_event_id) do nothing;

  v_activity_type := case when exists (
    select 1 from public.activities where contact_id = v_contact_id
  ) then 'contact_updated' else 'contact_created' end;
  insert into public.activities (type, contact_id, contact_name, description)
  values (
    v_activity_type, v_contact_id,
    pg_catalog.concat_ws(' ', p_first_name, p_last_name),
    pg_catalog.concat('Founding cohort membership purchased (', p_stripe_event_id, ')')
  );

  insert into public.email_outbox (dedupe_key, template, recipient, payload)
  values (
    pg_catalog.concat('founding-welcome:', v_reservation.reservation_id::text),
    'founding_welcome', p_email,
    pg_catalog.jsonb_build_object('reservation_id', v_reservation.reservation_id,
      'membership_id', v_membership_id, 'contact_id', v_contact_id)
  ) on conflict (dedupe_key) do nothing;

  update public.stripe_webhook_events
  set processing_state = 'PROCESSED', reservation_id = v_reservation.reservation_id,
      processed_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = v_event.id;

  return query select v_reservation.reservation_id, v_contact_id, v_membership_id, 'FULFILLED';
exception when others then
  update public.stripe_webhook_events
  set processing_state = 'FAILED', error_summary = pg_catalog.left(sqlerrm, 500),
      next_attempt_at = pg_catalog.now() + interval '5 minutes', updated_at = pg_catalog.now()
  where stripe_event_id = p_stripe_event_id;
  return query select null::uuid, null::uuid, null::uuid, 'FAILED';
  return;
end;
end;
$function$;



create or replace function public.attach_founding_checkout_session(
  p_reservation_id uuid,
  p_stripe_session_id text,
  p_stripe_customer_id text default null,
  p_hold_expires_at timestamptz default null
)
returns table (reservation_id uuid, stripe_session_id text, hold_expires_at timestamptz, state text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reservation public.founding_reservations%rowtype;
  v_cohort public.founding_cohorts%rowtype;
  v_cohort_id uuid;
  v_expiry timestamptz;
begin
  if coalesce(pg_catalog.btrim(p_stripe_session_id), '') = '' then
    raise exception 'Stripe Checkout Session is required';
  end if;

  select cohort_id into v_cohort_id
  from public.founding_reservations
  where reservation_id = p_reservation_id;
  if not found then
    raise exception 'reservation is unavailable';
  end if;

  select * into v_cohort
  from public.founding_cohorts
  where id = v_cohort_id
  for update;
  if not found then
    raise exception 'reservation cohort is unavailable';
  end if;

  select * into v_reservation
  from public.founding_reservations
  where public.founding_reservations.reservation_id = p_reservation_id
  for update;
  if not found then
    raise exception 'reservation is unavailable';
  end if;
  if v_reservation.state <> 'PENDING_CHECKOUT' then
    raise exception 'reservation is no longer pending';
  end if;
  if v_reservation.hold_expires_at <= pg_catalog.now() then
    raise exception 'reservation hold has expired';
  end if;
  if v_reservation.stripe_session_id is not null
     and v_reservation.stripe_session_id <> p_stripe_session_id then
    raise exception 'reservation already has another Checkout Session';
  end if;

  v_expiry := least(v_reservation.hold_expires_at,
    coalesce(p_hold_expires_at, v_reservation.hold_expires_at));
  update public.founding_reservations
  set stripe_session_id = p_stripe_session_id,
      stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
      hold_expires_at = v_expiry,
      updated_at = pg_catalog.now()
  where public.founding_reservations.reservation_id = p_reservation_id
  returning public.founding_reservations.reservation_id,
    public.founding_reservations.stripe_session_id,
    public.founding_reservations.hold_expires_at,
    public.founding_reservations.state
  into reservation_id, stripe_session_id, hold_expires_at, state;
  return next;
end;
$function$;

create or replace function public.release_founding_reservation(
  p_reservation_id uuid,
  p_stripe_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cohort public.founding_cohorts%rowtype;
  v_cohort_id uuid;
  v_updated integer;
begin
  select cohort_id into v_cohort_id
  from public.founding_reservations
  where reservation_id = p_reservation_id
    and stripe_session_id = p_stripe_session_id;
  if not found then
    return false;
  end if;

  select * into v_cohort
  from public.founding_cohorts
  where id = v_cohort_id
  for update;
  if not found then
    return false;
  end if;

  update public.founding_reservations
  set state = 'EXPIRED', expired_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where reservation_id = p_reservation_id
    and stripe_session_id = p_stripe_session_id
    and state = 'PENDING_CHECKOUT'
    and stripe_payment_intent_id is null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

revoke all on table public.founding_cohorts from public;
revoke all on table public.founding_cohorts from anon;
revoke all on table public.founding_cohorts from authenticated;
revoke all on table public.founding_reservations from public;
revoke all on table public.founding_reservations from anon;
revoke all on table public.founding_reservations from authenticated;
revoke all on table public.stripe_webhook_events from public;
revoke all on table public.stripe_webhook_events from anon;
revoke all on table public.stripe_webhook_events from authenticated;
revoke all on table public.founding_memberships from public;
revoke all on table public.founding_memberships from anon;
revoke all on table public.founding_memberships from authenticated;
revoke all on table public.email_outbox from public;
revoke all on table public.email_outbox from anon;
revoke all on table public.email_outbox from authenticated;

revoke all on function public.create_founding_reservation(text, text, text, text, text, integer) from public;
revoke all on function public.create_founding_reservation(text, text, text, text, text, integer) from anon;
revoke all on function public.create_founding_reservation(text, text, text, text, text, integer) from authenticated;
grant execute on function public.create_founding_reservation(text, text, text, text, text, integer) to service_role;

revoke all on function public.attach_founding_checkout_session(uuid, text, text, timestamptz) from public;
revoke all on function public.attach_founding_checkout_session(uuid, text, text, timestamptz) from anon;
revoke all on function public.attach_founding_checkout_session(uuid, text, text, timestamptz) from authenticated;
grant execute on function public.attach_founding_checkout_session(uuid, text, text, timestamptz) to service_role;

revoke all on function public.release_founding_reservation(uuid, text) from public;
revoke all on function public.release_founding_reservation(uuid, text) from anon;
revoke all on function public.release_founding_reservation(uuid, text) from authenticated;
grant execute on function public.release_founding_reservation(uuid, text) to service_role;

revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from public;
revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from anon;
revoke all on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, integer, text, timestamptz) from authenticated;
grant execute on function public.fulfill_founding_checkout(text, text, text, text, text, text, text, text, text, integer, text, timestamptz) to service_role;

revoke all on function public.get_founding_inventory_state(text) from public;
revoke all on function public.get_founding_inventory_state(text) from anon;
revoke all on function public.get_founding_inventory_state(text) from authenticated;
grant execute on function public.get_founding_inventory_state(text) to service_role;
