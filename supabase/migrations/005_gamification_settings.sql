-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 005: Gamification Admin Settings
-- ═══════════════════════════════════════════════════════════════════════════════

-- Board visibility toggles
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS board_monthly_enabled boolean DEFAULT true;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS board_alltime_enabled boolean DEFAULT false;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS board_spirit_enabled boolean DEFAULT true;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS board_streak_enabled boolean DEFAULT false;

-- Crew score visibility to other members
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS crew_score_visible boolean DEFAULT true;

-- Hall of Fame visibility
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS hall_of_fame_visibility text DEFAULT 'members_only'
    CHECK (hall_of_fame_visibility IN ('public', 'members_only', 'hidden'));
