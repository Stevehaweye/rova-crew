import { createServiceClient } from '@/lib/supabase/service'
import { generateEventSummary } from '@/lib/post-event-summary'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EventReport {
  event: {
    id: string
    title: string
    date: string
    location: string | null
    coverUrl: string | null
    eventType: string
  }
  group: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
    colour: string
  }
  attendance: {
    rsvpCount: number
    attendedCount: number
    noShowCount: number
    attendanceRate: number
  }
  photos: { count: number; topPhotoUrl: string | null }
  photoContributors: number
  ratings: {
    avgRating: number
    ratingCount: number
    distribution: [number, number, number, number, number]
  }
  ratingResponseRate: number
  finance: {
    totalCollectedPence: number
    payoutPence: number
    platformFeePence: number
    paymentCount: number
    isPaidEvent: boolean
  } | null
  attendeeDetails: Array<{
    userId: string
    fullName: string
    avatarUrl: string | null
    tier: string
    checkedInAt: string | null
    paymentStatus: string | null
  }>
  noShows: Array<{
    userId: string
    fullName: string
    avatarUrl: string | null
    rsvpTime: string
  }>
  waitlistCount: number
}

// ─── generateEventReport ────────────────────────────────────────────────────

export async function generateEventReport(
  eventId: string
): Promise<EventReport | null> {
  const svc = createServiceClient()

  // 1. Get core summary data
  const summary = await generateEventSummary(eventId)
  if (!summary) return null

  // 2. Parallel report-specific queries
  const [
    rsvpDetailsResult,
    photoContribResult,
    waitlistResult,
    paymentCountResult,
    paymentTotalResult,
  ] = await Promise.all([
    // All RSVPs with profiles (going + maybe) for attendee/no-show lists
    svc
      .from('rsvps')
      .select(
        'user_id, status, checked_in_at, created_at, profiles:user_id ( full_name, avatar_url )'
      )
      .eq('event_id', eventId)
      .in('status', ['going', 'maybe']),

    // Photo contributors (distinct uploaders)
    svc
      .from('event_photos')
      .select('uploader_id')
      .eq('event_id', eventId)
      .eq('is_hidden', false),

    // Waitlist count
    svc
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'waitlisted'),

    // Payment count
    svc
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'paid'),

    // Payment total
    svc
      .from('payments')
      .select('amount_pence')
      .eq('event_id', eventId)
      .eq('status', 'paid'),
  ])

  // 3. Build tier map from summary attendees
  const tierMap: Record<string, string> = {}
  for (const a of summary.attendees) {
    tierMap[a.userId] = a.tier
  }

  // 4. Build payment status map
  const paymentUserIds = new Set<string>()
  if (summary.finance) {
    const { data: paymentRows } = await svc
      .from('payments')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('status', 'paid')
      .not('user_id', 'is', null)
    for (const p of paymentRows ?? []) {
      if (p.user_id) paymentUserIds.add(p.user_id)
    }
  }

  // 5. Process RSVP details into attendees + no-shows
  const rsvpRows = rsvpDetailsResult.data ?? []
  const attendeeDetails: EventReport['attendeeDetails'] = []
  const noShows: EventReport['noShows'] = []

  for (const r of rsvpRows) {
    const profile = r.profiles as unknown as {
      full_name: string
      avatar_url: string | null
    } | null

    const fullName = profile?.full_name ?? 'Member'
    const avatarUrl = profile?.avatar_url ?? null
    const tier = tierMap[r.user_id] ?? 'newcomer'

    if (r.checked_in_at) {
      attendeeDetails.push({
        userId: r.user_id,
        fullName,
        avatarUrl,
        tier,
        checkedInAt: r.checked_in_at,
        paymentStatus: summary.finance
          ? paymentUserIds.has(r.user_id)
            ? 'Paid'
            : 'Unpaid'
          : null,
      })
    } else {
      noShows.push({
        userId: r.user_id,
        fullName,
        avatarUrl,
        rsvpTime: r.created_at,
      })
    }
  }

  // 6. Photo contributors (distinct)
  const uploaderIds = new Set((photoContribResult.data ?? []).map((p) => p.uploader_id))
  const photoContributors = uploaderIds.size

  // 7. Payment totals
  const isPaidEvent = summary.event.eventType === 'paid' || summary.event.eventType === 'shared_cost'
  const totalCollectedPence = (paymentTotalResult.data ?? []).reduce(
    (sum, p) => sum + (p.amount_pence ?? 0),
    0
  )
  const platformFeePence = Math.round(totalCollectedPence * 0.05)
  const payoutPence = totalCollectedPence - platformFeePence
  const paymentCount = paymentCountResult.count ?? 0

  // 8. Rating response rate
  const ratingResponseRate =
    summary.attendance.attendedCount > 0
      ? Math.round((summary.ratings.ratingCount / summary.attendance.attendedCount) * 100)
      : 0

  return {
    event: summary.event,
    group: summary.group,
    attendance: summary.attendance,
    photos: summary.photos,
    photoContributors,
    ratings: summary.ratings,
    ratingResponseRate,
    finance: isPaidEvent
      ? { totalCollectedPence, payoutPence, platformFeePence, paymentCount, isPaidEvent }
      : null,
    attendeeDetails,
    noShows,
    waitlistCount: waitlistResult.count ?? 0,
  }
}
