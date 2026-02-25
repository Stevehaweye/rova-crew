import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push-sender'
import { getMemberTier } from '@/lib/tier-themes'

// Re-export for consumers
export { getMemberTier, TIER_THEMES } from '@/lib/tier-themes'
export type { TierInfo } from '@/lib/tier-themes'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrewScoreResult {
  crewScore: number
  loyalty: number
  spirit: number
  adventure: number
  legacy: number
  tier: string
  rank: number
  totalMembers: number
}

// ─── Percentile helper ──────────────────────────────────────────────────────

/** Compute percentile rank (0–1) for each value in the array. Handles ties via midpoint. */
function computePercentiles(values: number[]): number[] {
  const n = values.length
  if (n <= 1) return values.map(() => 1.0)

  const sorted = [...values].sort((a, b) => a - b)

  return values.map((val) => {
    const below = sorted.filter((v) => v < val).length
    const equal = sorted.filter((v) => v === val).length
    return (below + (equal - 1) / 2) / (n - 1)
  })
}

// ─── Pillar weights ─────────────────────────────────────────────────────────

// Loyalty = 40% (max 400)
const LOYALTY_MAX = 400
const LOYALTY_SUB = { attendance_rate: 0.5, events_attended: 0.25, current_streak: 0.25 }

// Spirit = 30% (max 300)
const SPIRIT_MAX = 300
const SPIRIT_SUB = { spirit_points_total: 0.4, messages_sent: 0.3, reactions_given: 0.3 }

// Adventure = 15% (max 150)
const ADVENTURE_MAX = 150
const ADVENTURE_SUB = { best_streak: 0.6, events_attended: 0.4 }

// Legacy = 15% (max 150)
const LEGACY_MAX = 150
const LEGACY_SUB = { tenure_days: 0.4, guest_converts: 0.4, founding_member: 0.2 }

// ─── Internal scoring ───────────────────────────────────────────────────────

interface MemberData {
  userId: string
  attendanceRate: number
  eventsAttended: number
  currentStreak: number
  spiritPointsTotal: number
  messagesSent: number
  reactionsGiven: number
  bestStreak: number
  guestConverts: number
  tenureDays: number
  isFoundingMember: boolean
}

interface MemberScores {
  userId: string
  loyalty: number
  spirit: number
  adventure: number
  legacy: number
  crewScore: number
}

function computeAllScores(members: MemberData[]): MemberScores[] {
  const n = members.length
  if (n === 0) return []

  // Extract raw values for each metric
  const attendanceRates = members.map((m) => m.attendanceRate)
  const eventsAttended = members.map((m) => m.eventsAttended)
  const currentStreaks = members.map((m) => m.currentStreak)
  const spiritTotals = members.map((m) => m.spiritPointsTotal)
  const messagesSent = members.map((m) => m.messagesSent)
  const reactionsGiven = members.map((m) => m.reactionsGiven)
  const bestStreaks = members.map((m) => m.bestStreak)
  const guestConverts = members.map((m) => m.guestConverts)
  const tenureDays = members.map((m) => m.tenureDays)

  // Compute percentiles for each metric
  const pAttendanceRate = computePercentiles(attendanceRates)
  const pEventsAttended = computePercentiles(eventsAttended)
  const pCurrentStreak = computePercentiles(currentStreaks)
  const pSpiritTotal = computePercentiles(spiritTotals)
  const pMessagesSent = computePercentiles(messagesSent)
  const pReactionsGiven = computePercentiles(reactionsGiven)
  const pBestStreak = computePercentiles(bestStreaks)
  const pGuestConverts = computePercentiles(guestConverts)
  const pTenureDays = computePercentiles(tenureDays)

  return members.map((m, i) => {
    // Loyalty pillar (max 400)
    const loyalty = Math.round(
      pAttendanceRate[i] * LOYALTY_MAX * LOYALTY_SUB.attendance_rate +
      pEventsAttended[i] * LOYALTY_MAX * LOYALTY_SUB.events_attended +
      pCurrentStreak[i] * LOYALTY_MAX * LOYALTY_SUB.current_streak
    )

    // Spirit pillar (max 300)
    const spirit = Math.round(
      pSpiritTotal[i] * SPIRIT_MAX * SPIRIT_SUB.spirit_points_total +
      pMessagesSent[i] * SPIRIT_MAX * SPIRIT_SUB.messages_sent +
      pReactionsGiven[i] * SPIRIT_MAX * SPIRIT_SUB.reactions_given
    )

    // Adventure pillar (max 150)
    const adventure = Math.round(
      pBestStreak[i] * ADVENTURE_MAX * ADVENTURE_SUB.best_streak +
      pEventsAttended[i] * ADVENTURE_MAX * ADVENTURE_SUB.events_attended
    )

    // Legacy pillar (max 150)
    const foundingBonus = m.isFoundingMember ? LEGACY_MAX * LEGACY_SUB.founding_member : 0
    const legacy = Math.round(
      pTenureDays[i] * LEGACY_MAX * LEGACY_SUB.tenure_days +
      pGuestConverts[i] * LEGACY_MAX * LEGACY_SUB.guest_converts +
      foundingBonus
    )

    const crewScore = Math.min(1000, Math.max(0, loyalty + spirit + adventure + legacy))

    return { userId: m.userId, loyalty, spirit, adventure, legacy, crewScore }
  })
}

// ─── calculateMemberCrewScore ───────────────────────────────────────────────

export async function calculateMemberCrewScore(
  userId: string,
  groupId: string
): Promise<CrewScoreResult> {
  const svc = createServiceClient()

  // Parallel fetch: all member stats, all memberships, group info
  const [statsResult, membersResult, groupResult] = await Promise.all([
    svc
      .from('member_stats')
      .select('user_id, attendance_rate, events_attended, current_streak, spirit_points_total, messages_sent, reactions_given, best_streak, guest_converts')
      .eq('group_id', groupId),
    svc
      .from('group_members')
      .select('user_id, joined_at')
      .eq('group_id', groupId)
      .eq('status', 'approved'),
    svc
      .from('groups')
      .select('created_at, tier_theme, custom_tier_names')
      .eq('id', groupId)
      .single(),
  ])

  const allStats = statsResult.data ?? []
  const allMembers = membersResult.data ?? []
  const group = groupResult.data
  const groupCreatedAt = group?.created_at ? new Date(group.created_at) : null
  const tierTheme = group?.tier_theme ?? 'generic'
  const customTierNames = group?.custom_tier_names as string[] | null

  // Build a joined_at lookup
  const joinedAtMap = new Map<string, Date>()
  for (const m of allMembers) {
    if (m.joined_at) joinedAtMap.set(m.user_id, new Date(m.joined_at))
  }

  const now = new Date()

  // Build member data for all approved members who have stats
  const approvedUserIds = new Set(allMembers.map((m) => m.user_id))
  const memberData: MemberData[] = allStats
    .filter((s) => approvedUserIds.has(s.user_id))
    .map((s) => {
      const joinedAt = joinedAtMap.get(s.user_id)
      const tenureDays = joinedAt ? Math.floor((now.getTime() - joinedAt.getTime()) / 86400000) : 0
      const isFoundingMember =
        joinedAt && groupCreatedAt
          ? joinedAt.getTime() - groupCreatedAt.getTime() <= 30 * 86400000
          : false

      return {
        userId: s.user_id,
        attendanceRate: Number(s.attendance_rate) || 0,
        eventsAttended: s.events_attended ?? 0,
        currentStreak: s.current_streak ?? 0,
        spiritPointsTotal: s.spirit_points_total ?? 0,
        messagesSent: s.messages_sent ?? 0,
        reactionsGiven: s.reactions_given ?? 0,
        bestStreak: s.best_streak ?? 0,
        guestConverts: s.guest_converts ?? 0,
        tenureDays,
        isFoundingMember,
      }
    })

  // If the target user has no stats row yet, add them with zeros
  if (!memberData.find((m) => m.userId === userId)) {
    const joinedAt = joinedAtMap.get(userId)
    const tenureDays = joinedAt ? Math.floor((now.getTime() - joinedAt.getTime()) / 86400000) : 0
    const isFoundingMember =
      joinedAt && groupCreatedAt
        ? joinedAt.getTime() - groupCreatedAt.getTime() <= 30 * 86400000
        : false

    memberData.push({
      userId,
      attendanceRate: 0,
      eventsAttended: 0,
      currentStreak: 0,
      spiritPointsTotal: 0,
      messagesSent: 0,
      reactionsGiven: 0,
      bestStreak: 0,
      guestConverts: 0,
      tenureDays,
      isFoundingMember,
    })
  }

  // Compute scores for all members
  const allScores = computeAllScores(memberData)

  // Sort by crewScore descending for ranking
  const ranked = [...allScores].sort((a, b) => b.crewScore - a.crewScore)

  const targetScores = allScores.find((s) => s.userId === userId)!
  const rank = ranked.findIndex((s) => s.userId === userId) + 1
  const tierInfo = getMemberTier(targetScores.crewScore, tierTheme, customTierNames)

  return {
    crewScore: targetScores.crewScore,
    loyalty: targetScores.loyalty,
    spirit: targetScores.spirit,
    adventure: targetScores.adventure,
    legacy: targetScores.legacy,
    tier: tierInfo.tier,
    rank,
    totalMembers: memberData.length,
  }
}

// ─── recalculateGroupCrewScores ─────────────────────────────────────────────

export async function recalculateGroupCrewScores(groupId: string): Promise<void> {
  const svc = createServiceClient()

  // Parallel fetch
  const [statsResult, membersResult, groupResult] = await Promise.all([
    svc
      .from('member_stats')
      .select('user_id, crew_score, tier, attendance_rate, events_attended, current_streak, spirit_points_total, messages_sent, reactions_given, best_streak, guest_converts')
      .eq('group_id', groupId),
    svc
      .from('group_members')
      .select('user_id, joined_at')
      .eq('group_id', groupId)
      .eq('status', 'approved'),
    svc
      .from('groups')
      .select('created_at, tier_theme, custom_tier_names')
      .eq('id', groupId)
      .single(),
  ])

  const allStats = statsResult.data ?? []
  const allMembers = membersResult.data ?? []
  const group = groupResult.data
  const groupCreatedAt = group?.created_at ? new Date(group.created_at) : null
  const tierTheme = group?.tier_theme ?? 'generic'
  const customTierNames = group?.custom_tier_names as string[] | null

  if (allMembers.length === 0) return

  const joinedAtMap = new Map<string, Date>()
  for (const m of allMembers) {
    if (m.joined_at) joinedAtMap.set(m.user_id, new Date(m.joined_at))
  }

  const now = new Date()
  const approvedUserIds = new Set(allMembers.map((m) => m.user_id))
  const statsMap = new Map(allStats.map((s) => [s.user_id, s]))

  // Build member data for all approved members
  const memberData: MemberData[] = allMembers.map((m) => {
    const s = statsMap.get(m.user_id)
    const joinedAt = joinedAtMap.get(m.user_id)
    const tenureDays = joinedAt ? Math.floor((now.getTime() - joinedAt.getTime()) / 86400000) : 0
    const isFoundingMember =
      joinedAt && groupCreatedAt
        ? joinedAt.getTime() - groupCreatedAt.getTime() <= 30 * 86400000
        : false

    return {
      userId: m.user_id,
      attendanceRate: s ? Number(s.attendance_rate) || 0 : 0,
      eventsAttended: s?.events_attended ?? 0,
      currentStreak: s?.current_streak ?? 0,
      spiritPointsTotal: s?.spirit_points_total ?? 0,
      messagesSent: s?.messages_sent ?? 0,
      reactionsGiven: s?.reactions_given ?? 0,
      bestStreak: s?.best_streak ?? 0,
      guestConverts: s?.guest_converts ?? 0,
      tenureDays,
      isFoundingMember,
    }
  })

  // Compute scores
  const allScores = computeAllScores(memberData)

  // Rank by crewScore descending
  const ranked = [...allScores].sort((a, b) => b.crewScore - a.crewScore)
  const rankMap = new Map<string, number>()
  ranked.forEach((s, i) => rankMap.set(s.userId, i + 1))

  // Detect tier promotions + enforce tier-only-increases
  interface TierPromotion { userId: string; newTier: string; newLevel: number }
  const promotions: TierPromotion[] = []

  const nowISO = now.toISOString()
  const CHUNK_SIZE = 10

  for (let i = 0; i < allScores.length; i += CHUNK_SIZE) {
    const chunk = allScores.slice(i, i + CHUNK_SIZE)
    await Promise.all(
      chunk.map((s) => {
        const oldStats = statsMap.get(s.userId)
        const oldCrewScore = oldStats?.crew_score ?? 0
        const oldTierLevel = getMemberTier(oldCrewScore, tierTheme, customTierNames).level
        const newTierInfo = getMemberTier(s.crewScore, tierTheme, customTierNames)

        // Tier can only increase, never decrease
        let finalTier: string
        if (newTierInfo.level > oldTierLevel) {
          finalTier = newTierInfo.tier
          promotions.push({ userId: s.userId, newTier: newTierInfo.tier, newLevel: newTierInfo.level })
        } else {
          finalTier = oldStats?.tier ?? newTierInfo.tier
        }

        return svc
          .from('member_stats')
          .upsert(
            {
              user_id: s.userId,
              group_id: groupId,
              crew_score: s.crewScore,
              tier: finalTier,
              loyalty_score: s.loyalty,
              spirit_score: s.spirit,
              adventure_score: s.adventure,
              legacy_score: s.legacy,
              last_calculated_at: nowISO,
            },
            { onConflict: 'user_id,group_id' }
          )
      })
    )
  }

  // Fire-and-forget: send tier promotion notifications
  if (promotions.length > 0) {
    handleTierPromotions(groupId, promotions, svc).catch((err) =>
      console.error('[crew-score] tier promotion error:', err)
    )
  }
}

// ─── Tier promotion notifications ───────────────────────────────────────────

async function handleTierPromotions(
  groupId: string,
  promotions: { userId: string; newTier: string; newLevel: number }[],
  svc: ReturnType<typeof createServiceClient>
): Promise<void> {
  const [groupResult, channelResult] = await Promise.all([
    svc.from('groups').select('name, slug, badge_announcements_enabled').eq('id', groupId).single(),
    svc.from('channels').select('id').eq('group_id', groupId).eq('type', 'announcements').maybeSingle(),
  ])

  const group = groupResult.data
  if (!group) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Fetch profile names for system messages
  const userIds = promotions.map((p) => p.userId)
  const { data: profiles } = await svc
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  for (const promo of promotions) {
    const name = nameMap.get(promo.userId) ?? 'A member'

    // 1. Push notification to the promoted user
    sendPushToUser(promo.userId, {
      title: 'New tier unlocked!',
      body: `You\u2019re now a ${promo.newTier} in ${group.name}. Keep it up!`,
      url: `${appUrl}/g/${group.slug}`,
    }, 'tier_promotion').catch(() => {})

    // 2. System message in announcements channel (if group has it enabled)
    if (group.badge_announcements_enabled && channelResult.data) {
      await svc.from('messages').insert({
        channel_id: channelResult.data.id,
        sender_id: promo.userId,
        content: `${name} just reached ${promo.newTier} tier!`,
        content_type: 'system',
      })
    }
  }
}
