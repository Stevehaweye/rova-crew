import { createServiceClient } from '@/lib/supabase/service'

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

interface BadgeCriteria {
  type: string
  value: number | boolean
  min_events?: number
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

// ─── checkAndAwardBadges ───────────────────────────────────────────────────

export async function checkAndAwardBadges(
  userId: string,
  groupId: string
): Promise<string[]> {
  const svc = createServiceClient()

  // Parallel fetch all needed data
  const [statsResult, badgesResult, awardsResult, membershipResult, groupResult] =
    await Promise.all([
      svc
        .from('member_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .maybeSingle(),
      svc.from('badges').select('id, slug, criteria'),
      svc
        .from('badge_awards')
        .select('badge_id')
        .eq('user_id', userId)
        .eq('group_id', groupId),
      svc
        .from('group_members')
        .select('joined_at')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .maybeSingle(),
      svc.from('groups').select('created_at').eq('id', groupId).maybeSingle(),
    ])

  const stats = statsResult.data
  if (!stats) return [] // no member_stats row yet

  const badges = badgesResult.data ?? []
  const existingAwardIds = new Set((awardsResult.data ?? []).map((a) => a.badge_id))
  const joinedAt = membershipResult.data?.joined_at
    ? new Date(membershipResult.data.joined_at)
    : null
  const groupCreatedAt = groupResult.data?.created_at
    ? new Date(groupResult.data.created_at)
    : null

  // Compute derived values
  const now = new Date()
  const tenureDays = joinedAt ? Math.floor((now.getTime() - joinedAt.getTime()) / 86400000) : 0
  const isFoundingMember =
    joinedAt && groupCreatedAt
      ? joinedAt.getTime() - groupCreatedAt.getTime() <= 30 * 86400000
      : false

  // Evaluate each unawarded badge
  const newAwards: { user_id: string; group_id: string; badge_id: string }[] = []

  for (const badge of badges) {
    if (existingAwardIds.has(badge.id)) continue

    const criteria = badge.criteria as BadgeCriteria
    if (!criteria?.type) continue

    let earned = false

    switch (criteria.type) {
      case 'events_attended':
        earned = stats.events_attended >= (criteria.value as number)
        break
      case 'attendance_rate':
        earned =
          stats.attendance_rate >= (criteria.value as number) &&
          stats.events_attended >= (criteria.min_events ?? 0)
        break
      case 'messages_sent':
        earned = stats.messages_sent >= (criteria.value as number)
        break
      case 'reactions_given':
        earned = stats.reactions_given >= (criteria.value as number)
        break
      case 'guest_converts':
        earned = stats.guest_converts >= (criteria.value as number)
        break
      case 'current_streak':
        // Use best_streak so badges aren't lost when streak resets
        earned = stats.best_streak >= (criteria.value as number)
        break
      case 'tenure_days':
        earned = tenureDays >= (criteria.value as number)
        break
      case 'founding_member':
        earned = isFoundingMember
        break
    }

    if (earned) {
      newAwards.push({ user_id: userId, group_id: groupId, badge_id: badge.id })
    }
  }

  if (newAwards.length === 0) return []

  // Batch insert, skip conflicts (badge already awarded)
  const { error } = await svc
    .from('badge_awards')
    .insert(newAwards)
    .select('badge_id')

  if (error) {
    console.error('[spirit-points] badge award error:', error)
    return []
  }

  // Return slugs of newly awarded badges
  const awardedBadgeIds = new Set(newAwards.map((a) => a.badge_id))
  return badges.filter((b) => awardedBadgeIds.has(b.id)).map((b) => b.slug)
}
