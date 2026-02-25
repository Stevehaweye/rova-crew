-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 003: Monthly Attendance Board
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add hide_from_monthly_board column to member_stats
ALTER TABLE public.member_stats
  ADD COLUMN IF NOT EXISTS hide_from_monthly_board boolean DEFAULT false;

-- 2. Create monthly_board_snapshots table
CREATE TABLE IF NOT EXISTS public.monthly_board_snapshots (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period           text        NOT NULL,  -- 'YYYY-MM'
  rank             integer     NOT NULL,
  attendance_rate  decimal     NOT NULL,
  events_attended  integer     NOT NULL,
  events_available integer     NOT NULL,
  spirit_points    integer     NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id, period)
);

ALTER TABLE public.monthly_board_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board snapshots readable by group members"
  ON public.monthly_board_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = monthly_board_snapshots.group_id
        AND gm.user_id = auth.uid()
        AND gm.status = 'approved'
    )
  );

CREATE INDEX idx_board_snapshots_group_period
  ON public.monthly_board_snapshots (group_id, period);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Monthly board reset function (run via pg_cron on 1st of each month)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_monthly_board_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period      text;
  v_month_start timestamptz;
  v_month_end   timestamptz;
  v_group       record;
  v_event       record;
  v_member      record;
  v_events_avail integer;
  v_events_att   integer;
  v_rate         decimal;
  v_rank         integer;
  v_channel_id   uuid;
  v_top3         text[];
  v_msg          text;
BEGIN
  -- Compute previous month boundaries
  v_month_start := date_trunc('month', now() - interval '1 month');
  v_month_end   := date_trunc('month', now());
  v_period      := to_char(v_month_start, 'YYYY-MM');

  -- Loop each group
  FOR v_group IN SELECT id, name FROM public.groups LOOP

    -- Reset rank counter
    v_rank := 0;
    v_top3 := ARRAY[]::text[];

    -- Create a temp table for this group's board
    CREATE TEMP TABLE IF NOT EXISTS tmp_board (
      user_id          uuid,
      attendance_rate  decimal,
      events_attended  integer,
      events_available integer,
      spirit_points    integer,
      rank             integer
    ) ON COMMIT DROP;

    DELETE FROM tmp_board;

    -- For each approved member in the group
    FOR v_member IN
      SELECT gm.user_id, gm.joined_at,
             COALESCE(ms.spirit_points_this_month, 0) AS sp,
             COALESCE(ms.hide_from_monthly_board, false) AS hidden,
             p.full_name
      FROM public.group_members gm
      LEFT JOIN public.member_stats ms ON ms.user_id = gm.user_id AND ms.group_id = gm.group_id
      LEFT JOIN public.profiles p ON p.id = gm.user_id
      WHERE gm.group_id = v_group.id AND gm.status = 'approved'
    LOOP
      -- Skip hidden members
      IF v_member.hidden THEN CONTINUE; END IF;

      -- Count events available (events that started on or after member joined)
      SELECT count(*) INTO v_events_avail
      FROM public.events e
      WHERE e.group_id = v_group.id
        AND e.starts_at >= v_month_start
        AND e.starts_at < v_month_end
        AND e.starts_at >= v_member.joined_at;

      IF v_events_avail = 0 THEN CONTINUE; END IF;

      -- Count events attended (checked in)
      SELECT count(DISTINCT r.event_id) INTO v_events_att
      FROM public.rsvps r
      JOIN public.events e ON e.id = r.event_id
      WHERE r.user_id = v_member.user_id
        AND e.group_id = v_group.id
        AND e.starts_at >= v_month_start
        AND e.starts_at < v_month_end
        AND e.starts_at >= v_member.joined_at
        AND r.checked_in_at IS NOT NULL;

      IF v_events_att = 0 THEN CONTINUE; END IF;

      v_rate := ROUND((v_events_att::decimal / v_events_avail) * 100, 1);

      INSERT INTO tmp_board (user_id, attendance_rate, events_attended, events_available, spirit_points, rank)
      VALUES (v_member.user_id, v_rate, v_events_att, v_events_avail, v_member.sp, 0);

    END LOOP;

    -- Assign ranks
    v_rank := 0;
    FOR v_event IN
      SELECT user_id FROM tmp_board
      ORDER BY attendance_rate DESC, spirit_points DESC
    LOOP
      v_rank := v_rank + 1;
      UPDATE tmp_board SET rank = v_rank WHERE user_id = v_event.user_id;
    END LOOP;

    -- Snapshot into monthly_board_snapshots
    INSERT INTO public.monthly_board_snapshots (group_id, user_id, period, rank, attendance_rate, events_attended, events_available, spirit_points)
    SELECT v_group.id, user_id, v_period, rank, attendance_rate, events_attended, events_available, spirit_points
    FROM tmp_board
    ON CONFLICT (group_id, user_id, period) DO UPDATE SET
      rank = EXCLUDED.rank,
      attendance_rate = EXCLUDED.attendance_rate,
      events_attended = EXCLUDED.events_attended,
      events_available = EXCLUDED.events_available,
      spirit_points = EXCLUDED.spirit_points;

    -- Build top 3 names for announcement
    SELECT array_agg(p.full_name ORDER BY tb.rank)
    INTO v_top3
    FROM tmp_board tb
    JOIN public.profiles p ON p.id = tb.user_id
    WHERE tb.rank <= 3;

    -- Post system message in announcements channel
    SELECT c.id INTO v_channel_id
    FROM public.channels c
    WHERE c.group_id = v_group.id AND c.type = 'announcements'
    LIMIT 1;

    IF v_channel_id IS NOT NULL AND v_top3 IS NOT NULL AND array_length(v_top3, 1) > 0 THEN
      v_msg := to_char(v_month_start, 'Month') || ' board results: ';
      IF array_length(v_top3, 1) >= 1 THEN v_msg := v_msg || '1st ' || v_top3[1]; END IF;
      IF array_length(v_top3, 1) >= 2 THEN v_msg := v_msg || ', 2nd ' || v_top3[2]; END IF;
      IF array_length(v_top3, 1) >= 3 THEN v_msg := v_msg || ', 3rd ' || v_top3[3]; END IF;

      INSERT INTO public.messages (channel_id, sender_id, content, content_type)
      VALUES (v_channel_id, (SELECT user_id FROM tmp_board WHERE rank = 1 LIMIT 1), v_msg, 'system');
    END IF;

    -- Reset spirit_points_this_month for all members in this group
    UPDATE public.member_stats
    SET spirit_points_this_month = 0
    WHERE group_id = v_group.id;

    DROP TABLE IF EXISTS tmp_board;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Schedule with pg_cron (run at 00:01 UTC on 1st of each month)
--    NOTE: pg_cron must be enabled in Supabase dashboard > Database > Extensions
-- ═══════════════════════════════════════════════════════════════════════════════

-- SELECT cron.schedule(
--   'monthly-board-reset',
--   '1 0 1 * *',
--   $$SELECT fn_monthly_board_reset()$$
-- );
