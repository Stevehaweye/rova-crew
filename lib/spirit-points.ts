import { createServiceClient } from '@/lib/supabase/service'
import { checkAndAwardBadges } from '@/lib/badges'

// ─── Action config ──────────────────────────────────────────────────────────

const ACTION_DEFAULTS: Record<string, { points: number; weeklyCap: number }> = {
  event_attendance: { points: 20, weeklyCap: Infinity },
  weather_bonus:    { points: 5,  weeklyCap: Infinity },
  first_rsvp:       { points: 10, weeklyCap: 10 },
  event_chat_post:  { points: 3,  weeklyCap: 15 },
  photo_upload:     { points: 5,  weeklyCap: 20 },
  co_organise:      { points: 25, weeklyCap: 25 },
  welcome_dm:       { points: 5,  weeklyCap: 15 },
  flyer_share:      { points: 5,  weeklyCap: 15 },
  guest_conversion: { points: 30, weeklyCap: Infinity },
}

const GLOBAL_WEEKLY_CAP = 100

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AwardResult {
  awarded: boolean
  points: number
  totalThisWeek: number
  reason?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns Monday of the current week as YYYY-MM-DD */
function getWeekStart(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

// ─── awardSpiritPoints ─────────────────────────────────────────────────────

export async function awardSpiritPoints(
  userId: string,
  groupId: string,
  actionType: string,
  referenceId?: string,
  pointsOverride?: number
): Promise<AwardResult> {
  const config = ACTION_DEFAULTS[actionType]
  if (!config) {
    return { awarded: false, points: 0, totalThisWeek: 0, reason: 'unknown_action' }
  }

  const points = pointsOverride ?? config.points
  const weekStart = getWeekStart()
  const svc = createServiceClient()

  // Fetch weekly totals in parallel
  const [globalResult, actionResult] = await Promise.all([
    svc
      .from('spirit_points_log')
      .select('points')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .eq('week_start', weekStart),
    svc
      .from('spirit_points_log')
      .select('points')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .eq('week_start', weekStart)
      .eq('action_type', actionType),
  ])

  const totalThisWeek = (globalResult.data ?? []).reduce((sum, r) => sum + r.points, 0)
  const actionTotalThisWeek = (actionResult.data ?? []).reduce((sum, r) => sum + r.points, 0)

  // Global weekly cap
  if (totalThisWeek + points > GLOBAL_WEEKLY_CAP) {
    return { awarded: false, points: 0, totalThisWeek, reason: 'weekly_cap_reached' }
  }

  // Per-action weekly cap
  if (config.weeklyCap !== Infinity && actionTotalThisWeek + points > config.weeklyCap) {
    return { awarded: false, points: 0, totalThisWeek, reason: 'action_cap_reached' }
  }

  // Insert log entry
  const { error: insertErr } = await svc.from('spirit_points_log').insert({
    user_id: userId,
    group_id: groupId,
    action_type: actionType,
    points,
    reference_id: referenceId ?? null,
    week_start: weekStart,
  })

  if (insertErr) {
    console.error('[spirit-points] insert error:', insertErr)
    return { awarded: false, points: 0, totalThisWeek, reason: 'insert_failed' }
  }

  // Update member_stats totals
  const { data: stats } = await svc
    .from('member_stats')
    .select('spirit_points_total, spirit_points_this_month')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .maybeSingle()

  const currentTotal = stats?.spirit_points_total ?? 0
  const currentMonth = stats?.spirit_points_this_month ?? 0

  await svc.from('member_stats').upsert(
    {
      user_id: userId,
      group_id: groupId,
      spirit_points_total: currentTotal + points,
      spirit_points_this_month: currentMonth + points,
    },
    { onConflict: 'user_id,group_id' }
  )

  // Fire-and-forget badge check
  checkAndAwardBadges(userId, groupId).catch((err) =>
    console.error('[spirit-points] badge check error:', err)
  )

  return { awarded: true, points, totalThisWeek: totalThisWeek + points }
}

// Re-export for consumers that used to import from here
export { checkAndAwardBadges } from '@/lib/badges'
