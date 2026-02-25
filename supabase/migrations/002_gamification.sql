-- ============================================================================
-- ROVA Crew — Week 5 Gamification Schema
-- Run in Supabase SQL Editor
-- ============================================================================

-- ─── 1. Extend member_stats with tracking columns ──────────────────────────

-- Messages sent in group channels (denormalised for display/scoring)
ALTER TABLE public.member_stats
  ADD COLUMN IF NOT EXISTS messages_sent      integer DEFAULT 0;

-- Reactions given on messages (spirit metric)
ALTER TABLE public.member_stats
  ADD COLUMN IF NOT EXISTS reactions_given     integer DEFAULT 0;

-- Last event the user was checked into (for streak continuity checks)
ALTER TABLE public.member_stats
  ADD COLUMN IF NOT EXISTS last_attended_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- Date of last attendance (simplifies streak gap detection)
ALTER TABLE public.member_stats
  ADD COLUMN IF NOT EXISTS last_attended_at    timestamptz;

-- ─── 2. Badges table — badge definitions ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.badges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        UNIQUE NOT NULL,
  name        text        NOT NULL,
  description text        NOT NULL,
  emoji       text        NOT NULL,
  category    text        NOT NULL CHECK (category IN ('loyalty', 'spirit', 'adventure', 'legacy', 'milestone')),
  sort_order  integer     DEFAULT 0,
  -- Flexible criteria evaluated by the scoring engine
  -- e.g. {"type":"events_attended","value":1}
  -- e.g. {"type":"attendance_rate","value":0.9,"min_events":10}
  criteria    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read badges (they're public definitions)
CREATE POLICY "Badges are readable by all authenticated users"
  ON public.badges FOR SELECT
  TO authenticated
  USING (true);

-- ─── 3. Badge awards — which users earned which badges ─────────────────────

CREATE TABLE IF NOT EXISTS public.badge_awards (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id   uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  badge_id   uuid        NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE (user_id, group_id, badge_id)
);

ALTER TABLE public.badge_awards ENABLE ROW LEVEL SECURITY;

-- Group members can see each other's badges
CREATE POLICY "Badge awards readable by group members"
  ON public.badge_awards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = badge_awards.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'approved'
    )
  );

-- ─── 4. Leaderboard snapshots — monthly rankings ──────────────────────────

CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period          text        NOT NULL,  -- 'YYYY-MM' format, e.g. '2026-02'
  crew_score      integer     NOT NULL DEFAULT 0,
  rank            integer     NOT NULL DEFAULT 0,
  tier            text        NOT NULL DEFAULT 'newcomer',
  loyalty_score   integer     NOT NULL DEFAULT 0,
  spirit_score    integer     NOT NULL DEFAULT 0,
  adventure_score integer     NOT NULL DEFAULT 0,
  legacy_score    integer     NOT NULL DEFAULT 0,
  events_attended integer     NOT NULL DEFAULT 0,
  events_available integer    NOT NULL DEFAULT 0,
  attendance_rate decimal     NOT NULL DEFAULT 0,
  current_streak  integer     NOT NULL DEFAULT 0,
  best_streak     integer     NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id, period)
);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- Group members can see their group's leaderboard
CREATE POLICY "Leaderboard snapshots readable by group members"
  ON public.leaderboard_snapshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = leaderboard_snapshots.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'approved'
    )
  );

-- ─── 5. Indexes for performance ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_badge_awards_user_group
  ON public.badge_awards (user_id, group_id);

CREATE INDEX IF NOT EXISTS idx_badge_awards_group
  ON public.badge_awards (group_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_group_period
  ON public.leaderboard_snapshots (group_id, period);

CREATE INDEX IF NOT EXISTS idx_leaderboard_group_period_rank
  ON public.leaderboard_snapshots (group_id, period, rank);

CREATE INDEX IF NOT EXISTS idx_rsvps_checked_in
  ON public.rsvps (event_id, checked_in_at)
  WHERE checked_in_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rsvps_user_status
  ON public.rsvps (user_id, status);

CREATE INDEX IF NOT EXISTS idx_events_group_starts
  ON public.events (group_id, starts_at);

-- ─── 6. Seed badge definitions ─────────────────────────────────────────────

INSERT INTO public.badges (slug, name, description, emoji, category, sort_order, criteria)
VALUES
  -- ── Loyalty badges (attendance-based) ──
  ('first_timer',     'First Timer',     'Attended your first event',                        '🎉', 'loyalty',   1,  '{"type":"events_attended","value":1}'),
  ('regular',         'Regular',         'Attended 5 events',                                '⭐', 'loyalty',   2,  '{"type":"events_attended","value":5}'),
  ('committed',       'Committed',       'Attended 15 events',                               '💪', 'loyalty',   3,  '{"type":"events_attended","value":15}'),
  ('devoted',         'Devoted',         'Attended 30 events',                               '🔥', 'loyalty',   4,  '{"type":"events_attended","value":30}'),
  ('centurion',       'Centurion',       'Attended 100 events',                              '💯', 'loyalty',   5,  '{"type":"events_attended","value":100}'),
  ('iron_will',       'Iron Will',       '90%+ attendance rate over 10+ events',             '🛡️', 'loyalty',   6,  '{"type":"attendance_rate","value":0.9,"min_events":10}'),
  ('perfect_record',  'Perfect Record',  '100% attendance rate over 5+ events',              '✨', 'loyalty',   7,  '{"type":"attendance_rate","value":1.0,"min_events":5}'),

  -- ── Spirit badges (community engagement) ──
  ('social_butterfly','Social Butterfly','Sent 50 messages in group chat',                   '🦋', 'spirit',    10, '{"type":"messages_sent","value":50}'),
  ('chatterbox',      'Chatterbox',      'Sent 200 messages in group chat',                  '💬', 'spirit',    11, '{"type":"messages_sent","value":200}'),
  ('cheerleader',     'Cheerleader',     'Gave 25 emoji reactions',                          '📣', 'spirit',    12, '{"type":"reactions_given","value":25}'),
  ('ambassador',      'Ambassador',      'Brought 3 guests who became members',              '🤝', 'spirit',    13, '{"type":"guest_converts","value":3}'),
  ('recruiter',       'Recruiter',       'Brought 10 guests who became members',             '🧲', 'spirit',    14, '{"type":"guest_converts","value":10}'),

  -- ── Streak badges ──
  ('on_fire',         'On Fire',         '3 events in a row',                                '🔥', 'adventure', 20, '{"type":"current_streak","value":3}'),
  ('unstoppable',     'Unstoppable',     '10 events in a row',                               '⚡', 'adventure', 21, '{"type":"current_streak","value":10}'),
  ('legendary_streak','Legendary Streak','25 events in a row',                               '🏆', 'adventure', 22, '{"type":"current_streak","value":25}'),

  -- ── Legacy badges (tenure-based) ──
  ('founding_member', 'Founding Member', 'Joined in the group''s first month',               '🏛️', 'legacy',    30, '{"type":"founding_member","value":true}'),
  ('six_months',      'Six Months',      'Member for 6 months',                              '📅', 'legacy',    31, '{"type":"tenure_days","value":180}'),
  ('one_year_club',   'One Year Club',   'Member for a full year',                           '🎂', 'legacy',    32, '{"type":"tenure_days","value":365}'),
  ('old_guard',       'Old Guard',       'Member for 2 years',                               '👑', 'legacy',    33, '{"type":"tenure_days","value":730}')

ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Done! Tables created:
--   - badges (19 seed badges)
--   - badge_awards
--   - leaderboard_snapshots
-- Extended:
--   - member_stats (+4 columns: messages_sent, reactions_given,
--     last_attended_event_id, last_attended_at)
-- ============================================================================
