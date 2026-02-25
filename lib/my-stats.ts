import { createServiceClient } from '@/lib/supabase/service'
import { calculateMemberCrewScore } from '@/lib/crew-score'
import { getMemberTier } from '@/lib/tier-themes'
import { getMonthlyBoardData } from '@/lib/monthly-board'
import type { BadgeData } from '@/components/gamification/BadgeGallery'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PillarData {
  label: string
  emoji: string
  weight: string
  score: number
  max: number
  percentile: number
  detail: string
  colour: string
}

export interface SpiritBreakdown {
  actionType: string
  label: string
  points: number
}

export interface NextMilestone {
  badgeName: string
  badgeEmoji: string
  current: number
  target: number
  progressPercent: number
}

export interface MyStatsData {
  crewScore: number
  tierLevel: number
  tierName: string

  pillars: PillarData[]

  monthEventsAttended: number
  monthEventsAvailable: number
  monthRate: number
  boardRank: number | null
  boardTotal: number
  groupAvgRate: number
  spiritPointsThisMonth: number
  spiritBreakdown: SpiritBreakdown[]

  currentStreak: number
  bestStreak: number

  badges: BadgeData[]

  nextMilestone: NextMilestone | null
  nextEvent: { id: string; title: string; startsAt: string } | null
}

// ─── Action type labels ──────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  event_attendance: 'Event attendance',
  weather_bonus: 'Weather bonus',
  first_rsvp: 'First to RSVP',
  event_chat_post: 'Event chat',
  photo_upload: 'Photo uploads',
  co_organise: 'Co-organising',
  welcome_dm: 'Welcome DMs',
  flyer_share: 'Flyer sharing',
  guest_conversion: 'Guest conversions',
}

// ─── Attendance badge thresholds (sorted) ────────────────────────────────────

const ATTENDANCE_MILESTONES = [1, 5, 10, 15, 25, 30, 50, 100, 200]

// ─── Main function ──────────────────────────────────────────────────────────

export async function getMyStatsData(
  userId: string,
  groupId: string
): Promise<MyStatsData> {
  const svc = createServiceClient()

  // Parallel fetch: crew score, member stats, monthly board, group info, badges, next event, spirit log
  const monthStart = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    1
  ))

  const [
    crewScoreResult,
    statsResult,
    boardResult,
    groupResult,
    membershipResult,
    badgesResult,
    awardsResult,
    nextEventResult,
    spiritLogResult,
  ] = await Promise.all([
    calculateMemberCrewScore(userId, groupId),
    svc
      .from('member_stats')
      .select('events_attended, events_available, attendance_rate, current_streak, best_streak, spirit_points_total, spirit_points_this_month, messages_sent, reactions_given, guest_converts')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .maybeSingle(),
    getMonthlyBoardData(groupId, userId),
    svc
      .from('groups')
      .select('created_at, tier_theme, custom_tier_names')
      .eq('id', groupId)
      .single(),
    svc
      .from('group_members')
      .select('joined_at')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .maybeSingle(),
    svc.from('badges').select('id, slug, name, emoji, description, category, criteria'),
    svc
      .from('badge_awards')
      .select('badge_id, awarded_at')
      .eq('user_id', userId)
      .eq('group_id', groupId),
    svc
      .from('events')
      .select('id, title, starts_at')
      .eq('group_id', groupId)
      .gt('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    svc
      .from('spirit_points_log')
      .select('action_type, points')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .gte('created_at', monthStart.toISOString()),
  ])

  const stats = statsResult.data
  const group = groupResult.data
  const tierTheme = group?.tier_theme ?? 'generic'
  const customTierNames = group?.custom_tier_names as string[] | null

  // ── Crew Score + Tier ──────────────────────────────────────────────────
  const tierInfo = getMemberTier(crewScoreResult.crewScore, tierTheme, customTierNames)

  // ── Pillar breakdown ───────────────────────────────────────────────────
  const eventsAttended = stats?.events_attended ?? 0
  const eventsAvailable = stats?.events_available ?? 0
  const attendanceRate = Math.round(Number(stats?.attendance_rate ?? 0))
  const spiritTotal = stats?.spirit_points_total ?? 0
  const messagesSent = stats?.messages_sent ?? 0
  const bestStreak = stats?.best_streak ?? 0
  const guestConverts = stats?.guest_converts ?? 0

  const joinedAt = membershipResult.data?.joined_at
    ? new Date(membershipResult.data.joined_at)
    : null
  const tenureDays = joinedAt
    ? Math.floor((Date.now() - joinedAt.getTime()) / 86400000)
    : 0

  const pillars: PillarData[] = [
    {
      label: 'Loyalty',
      emoji: '\uD83C\uDFAF',
      weight: '40%',
      score: crewScoreResult.loyalty,
      max: 400,
      percentile: Math.round((crewScoreResult.loyalty / 400) * 100),
      detail: `${eventsAttended} / ${eventsAvailable} events \u2014 ${attendanceRate}% rate`,
      colour: '#0D7377',
    },
    {
      label: 'Spirit',
      emoji: '\u2728',
      weight: '30%',
      score: crewScoreResult.spirit,
      max: 300,
      percentile: Math.round((crewScoreResult.spirit / 300) * 100),
      detail: `${spiritTotal} spirit pts \u00B7 ${messagesSent} messages`,
      colour: '#C9982A',
    },
    {
      label: 'Adventure',
      emoji: '\u26A1',
      weight: '15%',
      score: crewScoreResult.adventure,
      max: 150,
      percentile: Math.round((crewScoreResult.adventure / 150) * 100),
      detail: `${bestStreak} best streak \u00B7 ${eventsAttended} events`,
      colour: '#7C3AED',
    },
    {
      label: 'Legacy',
      emoji: '\uD83C\uDFDB\uFE0F',
      weight: '15%',
      score: crewScoreResult.legacy,
      max: 150,
      percentile: Math.round((crewScoreResult.legacy / 150) * 100),
      detail: `${tenureDays} days \u00B7 ${guestConverts} guests converted`,
      colour: '#059669',
    },
  ]

  // ── This Month ─────────────────────────────────────────────────────────
  const boardEntry = boardResult.currentUserEntry
  const monthEventsAttended = boardEntry?.eventsAttended ?? 0
  const monthEventsAvailable = boardEntry?.eventsAvailable ?? 0
  const monthRate = boardEntry ? Math.round(boardEntry.attendanceRate) : 0
  const boardRank = boardEntry?.rank ?? null
  const boardTotal = boardResult.totalQualifyingMembers
  const groupAvgRate = Math.round(boardResult.groupAvgRate)
  const spiritPointsThisMonth = stats?.spirit_points_this_month ?? 0

  // Spirit breakdown
  const spiritMap = new Map<string, number>()
  for (const row of spiritLogResult.data ?? []) {
    spiritMap.set(
      row.action_type,
      (spiritMap.get(row.action_type) ?? 0) + row.points
    )
  }
  const spiritBreakdown: SpiritBreakdown[] = Array.from(spiritMap.entries())
    .map(([actionType, points]) => ({
      actionType,
      label: ACTION_LABELS[actionType] ?? actionType,
      points,
    }))
    .sort((a, b) => b.points - a.points)

  // ── Badges ─────────────────────────────────────────────────────────────
  const awardedSet = new Map<string, string>()
  for (const a of awardsResult.data ?? []) {
    awardedSet.set(a.badge_id, a.awarded_at)
  }

  const badges: BadgeData[] = (badgesResult.data ?? []).map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    emoji: b.emoji,
    description: b.description,
    category: b.category,
    awardedAt: awardedSet.get(b.id) ?? null,
  }))

  // ── Next Milestone ─────────────────────────────────────────────────────
  let nextMilestone: NextMilestone | null = null

  // Find attendance badges from the badges list
  const attendanceBadges = (badgesResult.data ?? [])
    .filter((b) => {
      const criteria = b.criteria as { type: string; value: number }
      return criteria.type === 'events_attended'
    })
    .map((b) => ({
      name: b.name,
      emoji: b.emoji,
      target: (b.criteria as { type: string; value: number }).value,
    }))
    .sort((a, b) => a.target - b.target)

  // Find next unearned attendance milestone
  for (const badge of attendanceBadges) {
    if (eventsAttended < badge.target) {
      nextMilestone = {
        badgeName: badge.name,
        badgeEmoji: badge.emoji,
        current: eventsAttended,
        target: badge.target,
        progressPercent: Math.round((eventsAttended / badge.target) * 100),
      }
      break
    }
  }

  // ── Next Event ─────────────────────────────────────────────────────────
  const nextEvent = nextEventResult.data
    ? {
        id: nextEventResult.data.id,
        title: nextEventResult.data.title,
        startsAt: nextEventResult.data.starts_at,
      }
    : null

  return {
    crewScore: crewScoreResult.crewScore,
    tierLevel: tierInfo.level as 1 | 2 | 3 | 4 | 5,
    tierName: tierInfo.tier,
    pillars,
    monthEventsAttended,
    monthEventsAvailable,
    monthRate,
    boardRank,
    boardTotal,
    groupAvgRate,
    spiritPointsThisMonth,
    spiritBreakdown,
    currentStreak: stats?.current_streak ?? 0,
    bestStreak: stats?.best_streak ?? 0,
    badges,
    nextMilestone,
    nextEvent,
  }
}
