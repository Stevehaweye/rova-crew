-- Enable Row Level Security on 7 tables flagged by Supabase's security
-- advisor (`rls_disabled_in_public`, `policy_exists_rls_disabled`).
--
-- All 7 tables are only touched by server-side code via the service-role
-- client (which bypasses RLS), so enabling RLS with NO policies is
-- sufficient to lock anonymous / anon-key access without breaking the
-- application. New tables in this repo should follow the same pattern.
--
-- `photo_consent_preferences` already has 7 user-facing policies attached
-- (created outside the migrations folder). Turning RLS on activates them;
-- they remain available if we later move any consent flow to run under
-- the auth client.

alter table public.photo_consent_preferences  enable row level security;
alter table public.member_gamification_prefs  enable row level security;
alter table public.event_plus_ones            enable row level security;
alter table public.nudges_sent                enable row level security;
alter table public.introductions              enable row level security;
alter table public.group_invites              enable row level security;
alter table public.spirit_points_log          enable row level security;
