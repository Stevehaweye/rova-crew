-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 006: Member Gamification Preferences
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.member_gamification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  hide_from_board boolean DEFAULT false,
  private_crew_score boolean DEFAULT false,
  mute_badge_announcements boolean DEFAULT false,
  mute_gamification_push boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, group_id)
);
