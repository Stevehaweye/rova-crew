import { createServiceClient } from '@/lib/supabase/service'
import { getMemberTier } from '@/lib/tier-themes'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BoardEntry {
  userId: string
  fullName: string
  avatarUrl: string | null
  tierLevel: number
  tierName: string
  rank: number
  attendanceRate: number        // 0-100
  eventsAttended: number
  eventsAvailable: number
  spiritPointsThisMonth: number
}

export interface CurrentUserBoardEntry extends BoardEntry {
  groupAvgRate: number
  comparedToAverage: number     // +/- percentage points
}

export interface MonthlyBoardData {
  topTen: BoardEntry[]
  membersBelowTopTen: number
  currentUserEntry: CurrentUserBoardEntry | null
  groupAvgRate: number
  month: string                 // 'YYYY-MM'
  totalQualifyingMembers: number
}

// ─── Main function ──────────────────────────────────────────────────────────

export async function getMonthlyBoardData(
  groupId: string,
  currentUserId: string
): Promise<MonthlyBoardData> {
  const svc = createServiceClient()

  // Current month boundaries (UTC)
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const monthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  // Parallel fetch
  const [eventsResult, membersResult, statsResult, groupResult] = await Promise.all([
    svc
      .from('events')
      .select('id, starts_at')
      .eq('group_id', groupId)
      .gte('starts_at', monthStart.toISOString())
      .lt('starts_at', monthEnd.toISOString()),
    svc
      .from('group_members')
      .select('user_id, joined_at, profiles ( full_name, avatar_url )')
      .eq('group_id', groupId)
      .eq('status', 'approved'),
    svc
      .from('member_stats')
      .select('user_id, crew_score, tier, spirit_points_this_month, hide_from_monthly_board')
      .eq('group_id', groupId),
    svc
      .from('groups')
      .select('tier_theme, custom_tier_names')
      .eq('id', groupId)
      .single(),
  ])

  const events = eventsResult.data ?? []
  const members = membersResult.data ?? []
  const stats = statsResult.data ?? []
  const tierTheme = groupResult.data?.tier_theme ?? 'generic'
  const customTierNames = groupResult.data?.custom_tier_names as string[] | null

  // Early return if no events this month
  if (events.length === 0) {
    return {
      topTen: [],
      membersBelowTopTen: 0,
      currentUserEntry: null,
      groupAvgRate: 0,
      month: monthStr,
      totalQualifyingMembers: 0,
    }
  }

  // Fetch check-ins for this month's events
  const eventIds = events.map((e) => e.id)
  const { data: rsvps } = await svc
    .from('rsvps')
    .select('user_id, event_id, checked_in_at')
    .in('event_id', eventIds)
    .not('checked_in_at', 'is', null)

  const checkIns = rsvps ?? []

  // Build lookup: eventId → starts_at
  const eventStartMap = new Map(events.map((e) => [e.id, new Date(e.starts_at)]))

  // Build lookup: userId → Set of eventIds they checked into
  const userCheckIns = new Map<string, Set<string>>()
  for (const r of checkIns) {
    if (!userCheckIns.has(r.user_id)) {
      userCheckIns.set(r.user_id, new Set())
    }
    userCheckIns.get(r.user_id)!.add(r.event_id)
  }

  // Build lookup: userId → stats
  const statsMap = new Map(stats.map((s) => [s.user_id, s]))

  // Build lookup: userId → profile
  const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>()
  for (const m of members) {
    const profile = m.profiles as unknown as { full_name: string; avatar_url: string | null } | null
    if (profile) {
      profileMap.set(m.user_id, profile)
    }
  }

  // Build lookup: userId → joined_at
  const joinedAtMap = new Map<string, Date>()
  for (const m of members) {
    if (m.joined_at) {
      joinedAtMap.set(m.user_id, new Date(m.joined_at))
    }
  }

  // Compute each member's monthly attendance
  interface RawEntry {
    userId: string
    attendanceRate: number
    eventsAttended: number
    eventsAvailable: number
    spiritPointsThisMonth: number
  }

  const rawEntries: RawEntry[] = []

  for (const m of members) {
    const memberStats = statsMap.get(m.user_id)

    // Skip hidden members
    if (memberStats?.hide_from_monthly_board) continue

    const joinedAt = joinedAtMap.get(m.user_id)
    const memberCheckIns = userCheckIns.get(m.user_id)

    // Count events available (events that started after member joined)
    let eventsAvailable = 0
    let eventsAttended = 0

    for (const [eventId, eventStart] of eventStartMap) {
      if (!joinedAt || eventStart >= joinedAt) {
        eventsAvailable++
        if (memberCheckIns?.has(eventId)) {
          eventsAttended++
        }
      }
    }

    // Skip if no events available or no attendance
    if (eventsAvailable === 0 || eventsAttended === 0) continue

    rawEntries.push({
      userId: m.user_id,
      attendanceRate: Math.round((eventsAttended / eventsAvailable) * 100),
      eventsAttended,
      eventsAvailable,
      spiritPointsThisMonth: memberStats?.spirit_points_this_month ?? 0,
    })
  }

  // Sort by attendanceRate DESC, then spiritPoints DESC as tiebreaker
  rawEntries.sort((a, b) => {
    if (b.attendanceRate !== a.attendanceRate) return b.attendanceRate - a.attendanceRate
    return b.spiritPointsThisMonth - a.spiritPointsThisMonth
  })

  // Assign ranks
  const rankedEntries: (RawEntry & { rank: number })[] = rawEntries.map((e, i) => ({
    ...e,
    rank: i + 1,
  }))

  // Compute group average
  const totalQualifying = rankedEntries.length
  const groupAvgRate =
    totalQualifying > 0
      ? Math.round(rankedEntries.reduce((sum, e) => sum + e.attendanceRate, 0) / totalQualifying)
      : 0

  // Build BoardEntry from a ranked entry
  function toBoardEntry(entry: RawEntry & { rank: number }): BoardEntry {
    const profile = profileMap.get(entry.userId)
    const memberStats = statsMap.get(entry.userId)
    const crewScore = memberStats?.crew_score ?? 0
    const tierInfo = getMemberTier(crewScore, tierTheme, customTierNames)

    return {
      userId: entry.userId,
      fullName: profile?.full_name ?? 'Member',
      avatarUrl: profile?.avatar_url ?? null,
      tierLevel: tierInfo.level,
      tierName: tierInfo.tier,
      rank: entry.rank,
      attendanceRate: entry.attendanceRate,
      eventsAttended: entry.eventsAttended,
      eventsAvailable: entry.eventsAvailable,
      spiritPointsThisMonth: entry.spiritPointsThisMonth,
    }
  }

  // Top 10
  const topTen = rankedEntries.slice(0, 10).map(toBoardEntry)

  // Members below top 10 count (anti-shame: no names)
  const membersBelowTopTen = Math.max(0, totalQualifying - 10)

  // Current user entry
  const currentUserRanked = rankedEntries.find((e) => e.userId === currentUserId)
  let currentUserEntry: CurrentUserBoardEntry | null = null

  if (currentUserRanked) {
    const entry = toBoardEntry(currentUserRanked)
    currentUserEntry = {
      ...entry,
      groupAvgRate,
      comparedToAverage: Math.round(entry.attendanceRate - groupAvgRate),
    }
  }

  return {
    topTen,
    membersBelowTopTen,
    currentUserEntry,
    groupAvgRate,
    month: monthStr,
    totalQualifyingMembers: totalQualifying,
  }
}
