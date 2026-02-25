import { createServiceClient } from '@/lib/supabase/service'
import { format } from 'date-fns'

export interface HallOfFameRecord {
  slug: string
  label: string
  emoji: string
  holderName: string
  holderAvatarUrl: string | null
  value: string
  holderId: string | null
}

export async function getHallOfFameRecords(
  groupId: string
): Promise<HallOfFameRecord[]> {
  const svc = createServiceClient()

  // Parallel fetch: all member_stats + founding members + group events for monthly record
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  const [statsResult, foundingResult, eventsResult] = await Promise.all([
    svc
      .from('member_stats')
      .select('user_id, events_attended, attendance_rate, best_streak, crew_score, guest_converts')
      .eq('group_id', groupId),
    svc
      .from('group_members')
      .select('user_id, member_number')
      .eq('group_id', groupId)
      .eq('status', 'approved')
      .not('member_number', 'is', null)
      .lte('member_number', 10),
    svc
      .from('events')
      .select('id, starts_at')
      .eq('group_id', groupId)
      .gte('starts_at', twoYearsAgo.toISOString())
      .order('starts_at', { ascending: true }),
  ])

  const allStats = statsResult.data ?? []
  const foundingMembers = foundingResult.data ?? []
  const groupEvents = eventsResult.data ?? []

  // ── Record 1: Most Events Attended ──────────────────────────────────────
  const mostEvents = allStats
    .filter((s) => s.events_attended >= 1)
    .sort((a, b) => b.events_attended - a.events_attended)[0]

  // ── Record 2: Highest Attendance Rate (min 5 events) ────────────────────
  const highestRate = allStats
    .filter((s) => s.events_attended >= 5)
    .sort((a, b) => Number(b.attendance_rate) - Number(a.attendance_rate))[0]

  // ── Record 3: Most Events in a Single Month ────────────────────────────
  let monthlyHolder: { userId: string; count: number; monthLabel: string } | null = null

  if (groupEvents.length > 0) {
    const eventIds = groupEvents.map((e) => e.id)
    const eventStartMap = new Map(groupEvents.map((e) => [e.id, e.starts_at]))

    // Fetch checked-in RSVPs in chunks (Supabase IN has limits)
    const CHUNK = 100
    const allRsvps: { user_id: string; event_id: string }[] = []

    for (let i = 0; i < eventIds.length; i += CHUNK) {
      const chunk = eventIds.slice(i, i + CHUNK)
      const { data } = await svc
        .from('rsvps')
        .select('user_id, event_id')
        .in('event_id', chunk)
        .not('checked_in_at', 'is', null)

      if (data) allRsvps.push(...data)
    }

    // Group by userId + YYYY-MM
    const monthCounts = new Map<string, { userId: string; count: number; monthKey: string }>()

    for (const rsvp of allRsvps) {
      const startsAt = eventStartMap.get(rsvp.event_id)
      if (!startsAt) continue
      const d = new Date(startsAt)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const key = `${rsvp.user_id}::${monthKey}`
      const entry = monthCounts.get(key)
      if (entry) {
        entry.count++
      } else {
        monthCounts.set(key, { userId: rsvp.user_id, count: 1, monthKey })
      }
    }

    let best: { userId: string; count: number; monthKey: string } | null = null
    for (const entry of monthCounts.values()) {
      if (!best || entry.count > best.count) {
        best = entry
      }
    }

    if (best && best.count >= 2) {
      const [year, month] = best.monthKey.split('-').map(Number)
      const monthLabel = format(new Date(year, month - 1), 'MMM yyyy')
      monthlyHolder = { userId: best.userId, count: best.count, monthLabel }
    }
  }

  // ── Record 4: Longest Streak ────────────────────────────────────────────
  const longestStreak = allStats
    .filter((s) => s.best_streak >= 2)
    .sort((a, b) => b.best_streak - a.best_streak)[0]

  // ── Record 5: Most Guests Converted ─────────────────────────────────────
  const mostConverts = allStats
    .filter((s) => s.guest_converts >= 1)
    .sort((a, b) => b.guest_converts - a.guest_converts)[0]

  // ── Record 6: Top Founding Member ───────────────────────────────────────
  const statsMap = new Map(allStats.map((s) => [s.user_id, s]))
  let topFounder: { userId: string; memberNumber: number; crewScore: number } | null = null

  for (const fm of foundingMembers) {
    const stats = statsMap.get(fm.user_id)
    const crewScore = stats?.crew_score ?? 0
    if (!topFounder || crewScore > topFounder.crewScore) {
      topFounder = { userId: fm.user_id, memberNumber: fm.member_number, crewScore }
    }
  }

  // ── Collect holder IDs for profile batch fetch ──────────────────────────
  const holderIds = new Set<string>()
  if (mostEvents) holderIds.add(mostEvents.user_id)
  if (highestRate) holderIds.add(highestRate.user_id)
  if (monthlyHolder) holderIds.add(monthlyHolder.userId)
  if (longestStreak) holderIds.add(longestStreak.user_id)
  if (mostConverts) holderIds.add(mostConverts.user_id)
  if (topFounder) holderIds.add(topFounder.userId)

  const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>()

  if (holderIds.size > 0) {
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', Array.from(holderIds))

    for (const p of profiles ?? []) {
      profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url })
    }
  }

  // ── Build records ───────────────────────────────────────────────────────
  function resolve(userId: string | null | undefined): { name: string; avatar: string | null } {
    if (!userId) return { name: '\u2014', avatar: null }
    const p = profileMap.get(userId)
    return { name: p?.full_name ?? '\u2014', avatar: p?.avatar_url ?? null }
  }

  const r1 = resolve(mostEvents?.user_id)
  const r2 = resolve(highestRate?.user_id)
  const r3 = resolve(monthlyHolder?.userId)
  const r4 = resolve(longestStreak?.user_id)
  const r5 = resolve(mostConverts?.user_id)
  const r6 = resolve(topFounder?.userId)

  return [
    {
      slug: 'most_events',
      label: 'Most Events Attended',
      emoji: '\uD83C\uDFAF',
      holderName: r1.name,
      holderAvatarUrl: r1.avatar,
      value: mostEvents ? `${mostEvents.events_attended} events` : '\u2014',
      holderId: mostEvents?.user_id ?? null,
    },
    {
      slug: 'highest_rate',
      label: 'Highest Attendance Rate',
      emoji: '\uD83D\uDCCA',
      holderName: r2.name,
      holderAvatarUrl: r2.avatar,
      value: highestRate ? `${Math.round(Number(highestRate.attendance_rate))}%` : '\u2014',
      holderId: highestRate?.user_id ?? null,
    },
    {
      slug: 'most_in_month',
      label: 'Most Events in a Month',
      emoji: '\uD83D\uDCC5',
      holderName: r3.name,
      holderAvatarUrl: r3.avatar,
      value: monthlyHolder ? `${monthlyHolder.count} in ${monthlyHolder.monthLabel}` : '\u2014',
      holderId: monthlyHolder?.userId ?? null,
    },
    {
      slug: 'longest_streak',
      label: 'Longest Streak',
      emoji: '\uD83D\uDD25',
      holderName: r4.name,
      holderAvatarUrl: r4.avatar,
      value: longestStreak ? `${longestStreak.best_streak} in a row` : '\u2014',
      holderId: longestStreak?.user_id ?? null,
    },
    {
      slug: 'most_converts',
      label: 'Most Guests Converted',
      emoji: '\uD83D\uDD17',
      holderName: r5.name,
      holderAvatarUrl: r5.avatar,
      value: mostConverts ? `${mostConverts.guest_converts} converts` : '\u2014',
      holderId: mostConverts?.user_id ?? null,
    },
    {
      slug: 'top_founder',
      label: 'Top Founding Member',
      emoji: '\uD83D\uDC51',
      holderName: r6.name,
      holderAvatarUrl: r6.avatar,
      value: topFounder ? `#${topFounder.memberNumber} \u00B7 ${topFounder.crewScore} pts` : '\u2014',
      holderId: topFounder?.userId ?? null,
    },
  ]
}
