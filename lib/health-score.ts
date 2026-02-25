import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push-sender'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HealthScoreResult {
  score: number
  previousScore: number | null
  signals: {
    attendance: number
    retention: number
    frequency: number
    growth: number
    engagement: number
  }
  delta: number | null
}

// ─── calculateGroupHealthScore ──────────────────────────────────────────────

export async function calculateGroupHealthScore(
  groupId: string
): Promise<HealthScoreResult> {
  const svc = createServiceClient()

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString()
  const nowISO = now.toISOString()

  // ── Parallel data fetch ─────────────────────────────────────────────────

  const [
    pastEventsResult,
    allMembersResult,
    eventsIn90DaysResult,
    spiritLogsResult,
    existingScoreResult,
  ] = await Promise.all([
    // Last 10 past events (for attendance signal)
    svc
      .from('events')
      .select('id')
      .eq('group_id', groupId)
      .lt('starts_at', nowISO)
      .order('starts_at', { ascending: false })
      .limit(10),

    // All group members regardless of status (for retention + growth)
    svc
      .from('group_members')
      .select('user_id, status, joined_at')
      .eq('group_id', groupId),

    // Events in last 90 days (for frequency signal)
    svc
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .gte('starts_at', ninetyDaysAgo)
      .lt('starts_at', nowISO),

    // Spirit points log entries in last 30 days (for engagement signal)
    svc
      .from('spirit_points_log')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .gte('created_at', thirtyDaysAgo),

    // Existing health score row (for previous_score)
    svc
      .from('group_health_scores')
      .select('score')
      .eq('group_id', groupId)
      .maybeSingle(),
  ])

  const pastEventIds = (pastEventsResult.data ?? []).map((e) => e.id)
  const allMembers = allMembersResult.data ?? []

  // ── Attendance RSVP fetch (needs event IDs from first query) ────────────

  let rsvpData: { event_id: string; checked_in_at: string | null }[] = []
  if (pastEventIds.length > 0) {
    const { data } = await svc
      .from('rsvps')
      .select('event_id, checked_in_at')
      .in('event_id', pastEventIds)
      .in('status', ['going', 'maybe'])
    rsvpData = data ?? []
  }

  // ── Engagement: photos + ratings from last 30 days ──────────────────────

  // Get recent event IDs for engagement metrics
  const { data: recentEvents } = await svc
    .from('events')
    .select('id')
    .eq('group_id', groupId)
    .gte('starts_at', thirtyDaysAgo)
    .lt('starts_at', nowISO)

  const recentEventIds = (recentEvents ?? []).map((e) => e.id)

  let photoCount = 0
  let ratingCount = 0
  if (recentEventIds.length > 0) {
    const [photosResult, ratingsResult] = await Promise.all([
      svc
        .from('event_photos')
        .select('id', { count: 'exact', head: true })
        .in('event_id', recentEventIds)
        .eq('is_hidden', false),
      svc
        .from('event_ratings')
        .select('id', { count: 'exact', head: true })
        .in('event_id', recentEventIds),
    ])
    photoCount = photosResult.count ?? 0
    ratingCount = ratingsResult.count ?? 0
  }

  // ── Signal 1: Attendance (max 30) ───────────────────────────────────────

  let attendance = 0
  if (pastEventIds.length > 0) {
    const rsvpsByEvent: Record<string, { total: number; attended: number }> = {}
    for (const eid of pastEventIds) {
      rsvpsByEvent[eid] = { total: 0, attended: 0 }
    }
    for (const r of rsvpData) {
      if (rsvpsByEvent[r.event_id]) {
        rsvpsByEvent[r.event_id].total++
        if (r.checked_in_at) rsvpsByEvent[r.event_id].attended++
      }
    }

    let totalRate = 0
    let eventsWithRsvps = 0
    for (const eid of pastEventIds) {
      const ev = rsvpsByEvent[eid]
      if (ev.total > 0) {
        totalRate += ev.attended / ev.total
        eventsWithRsvps++
      }
    }

    if (eventsWithRsvps > 0) {
      const avgRate = totalRate / eventsWithRsvps
      attendance = Math.round(avgRate * 30)
    }
  }

  // ── Signal 2: Retention (max 25) ────────────────────────────────────────

  const matureMembers = allMembers.filter(
    (m) => m.joined_at && new Date(m.joined_at).getTime() <= now.getTime() - 30 * 86400000
  )
  const retainedMembers = matureMembers.filter((m) => m.status === 'approved')

  let retention: number
  if (matureMembers.length === 0) {
    retention = 25 // New group — benefit of the doubt
  } else {
    retention = Math.round((retainedMembers.length / matureMembers.length) * 25)
  }

  // ── Signal 3: Event Frequency (max 20) ──────────────────────────────────

  const eventsIn90Days = eventsIn90DaysResult.count ?? 0
  const frequencyRatio = Math.min(1, eventsIn90Days / 12) // Target: 4/month = 12 in 90 days
  const frequency = Math.round(frequencyRatio * 20)

  // ── Signal 4: Member Growth (max 15) ────────────────────────────────────

  const approvedMembers = allMembers.filter((m) => m.status === 'approved')
  const recentJoins = approvedMembers.filter(
    (m) => m.joined_at && new Date(m.joined_at).toISOString() >= thirtyDaysAgo
  ).length
  const previousJoins = approvedMembers.filter(
    (m) =>
      m.joined_at &&
      new Date(m.joined_at).toISOString() >= sixtyDaysAgo &&
      new Date(m.joined_at).toISOString() < thirtyDaysAgo
  ).length

  let growth: number
  if (previousJoins > 0) {
    const growthRatio = recentJoins / previousJoins
    growth = Math.round(Math.min(1, growthRatio / 2) * 15)
  } else if (recentJoins > 0) {
    growth = Math.round(0.7 * 15) // Growth but no baseline
  } else {
    growth = 0
  }

  // ── Signal 5: Community Engagement (max 10) ─────────────────────────────

  const totalApproved = approvedMembers.length
  let engagement = 0
  if (totalApproved > 0) {
    const spiritActions = spiritLogsResult.count ?? 0

    const spiritRatio = Math.min(1, spiritActions / (totalApproved * 3))
    const photoRatio = Math.min(1, photoCount / (totalApproved * 0.5))
    const ratingRatio = Math.min(1, ratingCount / (totalApproved * 0.5))

    const blended = spiritRatio * 0.5 + photoRatio * 0.25 + ratingRatio * 0.25
    engagement = Math.round(blended * 10)
  }

  // ── Compute total + upsert ──────────────────────────────────────────────

  const score = Math.min(100, attendance + retention + frequency + growth + engagement)
  const previousScore = existingScoreResult.data?.score ?? null

  await svc.from('group_health_scores').upsert(
    {
      group_id: groupId,
      score,
      signal_attendance: attendance,
      signal_retention: retention,
      signal_frequency: frequency,
      signal_growth: growth,
      signal_engagement: engagement,
      calculated_at: nowISO,
      previous_score: previousScore,
    },
    { onConflict: 'group_id' }
  )

  // ── Health alert if score dropped 15+ ───────────────────────────────────

  if (previousScore !== null && previousScore - score >= 15) {
    sendHealthAlert(groupId, previousScore, score).catch((err) =>
      console.error('[health-score] alert error:', err)
    )
  }

  const delta = previousScore !== null ? score - previousScore : null

  return { score, previousScore, signals: { attendance, retention, frequency, growth, engagement }, delta }
}

// ─── Health Alert ────────────────────────────────────────────────────────────

async function sendHealthAlert(
  groupId: string,
  beforeScore: number,
  afterScore: number
): Promise<void> {
  const svc = createServiceClient()

  const { data: group } = await svc
    .from('groups')
    .select('name, slug')
    .eq('id', groupId)
    .single()

  if (!group) return

  const { data: admins } = await svc
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .in('role', ['super_admin', 'co_admin'])
    .eq('status', 'approved')

  if (!admins || admins.length === 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  for (const admin of admins) {
    sendPushToUser(
      admin.user_id,
      {
        title: `⚠️ Health Score alert for ${group.name}`,
        body: `Your Health Score dropped from ${beforeScore} to ${afterScore}. Open the dashboard to see why.`,
        url: `${appUrl}/g/${group.slug}/admin`,
      },
      'health_alert'
    ).catch(() => {})
  }
}
