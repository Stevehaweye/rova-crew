-- Stripe webhook hardening
-- 1. Event-level idempotency so retries + dashboard replays are safe.
-- 2. Guest RSVP unique constraint so concurrent inserts can't duplicate.
-- 3. Membership subscriptions table so renewals/cancellations can adjust access.

create table if not exists public.stripe_processed_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

comment on table public.stripe_processed_events is
  'Records every Stripe event.id we have already processed so that webhook retries and dashboard replays are idempotent.';

alter table public.guest_rsvps
  add constraint guest_rsvps_event_id_email_key
  unique (event_id, email);

create table if not exists public.membership_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text,
  stripe_connected_account_id text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.membership_subscriptions is
  'Per-user membership subscription state driven by Stripe webhooks. Group access should be gated on status in (active, trialing).';

create index if not exists membership_subscriptions_user_group_idx
  on public.membership_subscriptions (user_id, group_id);

create index if not exists membership_subscriptions_status_idx
  on public.membership_subscriptions (status);

-- 4. RSVP milestone deduplication.
--    `milestones_fired` records which per-event RSVP thresholds have already
--    triggered a system message + push, so churning above/below a threshold
--    doesn't repeatedly spam group members.
alter table public.events
  add column if not exists milestones_fired integer[] not null default '{}';

