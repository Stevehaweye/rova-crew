-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 004: Achievement Badge System
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add announced_at to badge_awards for tracking celebrations
ALTER TABLE public.badge_awards
  ADD COLUMN IF NOT EXISTS announced_at timestamptz;

-- 2. Add member_number to group_members for founding member logic
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS member_number integer;

-- 3. Add new badges for specified thresholds
--    (1 and 100 events already exist as first_timer/centurion)
--    (3 and 10 streak already exist as on_fire/unstoppable)
INSERT INTO public.badges (slug, name, description, emoji, category, sort_order, criteria)
VALUES
  ('ten_timer',         'Ten Timer',         'Attended 10 events',                    '🔟', 'loyalty',   2,  '{"type":"events_attended","value":10}'),
  ('quarter_century',   'Quarter Century',   'Attended 25 events',                    '🏅', 'loyalty',   3,  '{"type":"events_attended","value":25}'),
  ('half_century',      'Half Century',      'Attended 50 events',                    '🎖️', 'loyalty',   4,  '{"type":"events_attended","value":50}'),
  ('two_hundred_club',  'Two Hundred Club',  'Attended 200 events',                   '🏛️', 'loyalty',   6,  '{"type":"events_attended","value":200}'),
  ('hot_streak',        'Hot Streak',        '5 events in a row',                     '🌶️', 'adventure', 20, '{"type":"current_streak","value":5}'),
  ('marathon_streak',   'Marathon Streak',   '20 events in a row',                    '🏃', 'adventure', 22, '{"type":"current_streak","value":20}'),
  ('connector',         'Connector',         'Brought 1 guest who became a member',   '🔗', 'spirit',    15, '{"type":"spirit_log","action":"guest_conversion","value":1}'),
  ('super_connector',   'Super Connector',   'Brought 3 guests who became members',   '🌐', 'spirit',    16, '{"type":"spirit_log","action":"guest_conversion","value":3}'),
  ('comm_builder',      'Community Builder', 'Brought 10 guests who became members',  '🏘️', 'spirit',    17, '{"type":"spirit_log","action":"guest_conversion","value":10}'),
  ('shutterstock',      'Shutterstock',      'Uploaded 10 event photos',              '📸', 'spirit',    18, '{"type":"spirit_log","action":"photo_upload","value":10}'),
  ('early_bird',        'Early Bird',        'First to RSVP to 5 events',             '🐦', 'spirit',    19, '{"type":"spirit_log","action":"first_rsvp","value":5}'),
  ('organiser',         'Organiser',         'Co-organised an event',                 '📋', 'spirit',    20, '{"type":"spirit_log","action":"co_organise","value":1}'),
  ('senior_organiser',  'Senior Organiser',  'Co-organised 5 events',                 '🎓', 'spirit',    21, '{"type":"spirit_log","action":"co_organise","value":5}')
ON CONFLICT (slug) DO NOTHING;

-- 4. Add badge_celebrations notification preference
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS badge_celebrations boolean DEFAULT true;
