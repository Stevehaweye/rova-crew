import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EventSummary {
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
  attendees: Array<{
    userId: string
    fullName: string
    avatarUrl: string | null
    tier: string
  }>
  milestones: Array<{
    memberName: string
    badgeName: string
    badgeEmoji: string
  }>
  finance: {
    totalCollectedPence: number
    payoutPence: number
    platformFeePence: number
    isPaidEvent: boolean
  } | null
  photos: { count: number; topPhotoUrl: string | null }
  ratings: {
    avgRating: number
    ratingCount: number
    distribution: [number, number, number, number, number]
  }
  spiritPoints: {
    totalAwarded: number
    topEarners: Array<{ name: string; points: number }>
  }
  nextEvent: { id: string; title: string; date: string } | null
}

// ─── generateEventSummary ───────────────────────────────────────────────────

export async function generateEventSummary(
  eventId: string
): Promise<EventSummary | null> {
  const svc = createServiceClient()

  // 1. Fetch event + group
  const { data: event } = await svc
    .from('events')
    .select(
      'id, title, starts_at, ends_at, location, cover_url, event_type, price_pence, total_cost_pence, group_id, created_by, groups ( id, name, slug, logo_url, primary_colour )'
    )
    .eq('id', eventId)
    .maybeSingle()

  if (!event) return null

  const group = event.groups as unknown as {
    id: string
    name: string
    slug: string
    logo_url: string | null
    primary_colour: string
  }

  const colour = group.primary_colour?.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour ?? '0D7377'}`

  const eventDate = format(new Date(event.starts_at), 'EEEE d MMMM yyyy')
  const endDate = event.ends_at ? new Date(event.ends_at) : new Date(event.starts_at)

  // 2. Parallel queries for all summary data
  const [
    rsvpCountResult,
    checkedInResult,
    attendeeResult,
    milestonesResult,
    paymentsResult,
    photoCountResult,
    ratingsResult,
    spiritResult,
    nextEventResult,
  ] = await Promise.all([
    // RSVP count (going + maybe)
    svc
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', ['going', 'maybe']),

    // Checked-in attendees count
    svc
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('checked_in_at', 'is', null),

    // Attendee profiles
    svc
      .from('rsvps')
      .select('user_id, profiles:user_id ( full_name, avatar_url )')
      .eq('event_id', eventId)
      .not('checked_in_at', 'is', null),

    // Badge milestones earned around this event
    svc
      .from('badge_awards')
      .select(
        'user_id, awarded_at, badges:badge_id ( name, emoji ), profiles:user_id ( full_name )'
      )
      .eq('group_id', event.group_id)
      .gte('awarded_at', event.starts_at)
      .lte('awarded_at', new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString()),

    // Payments for paid events
    svc
      .from('payments')
      .select('amount_pence, status')
      .eq('event_id', eventId)
      .eq('status', 'paid'),

    // Photo count
    svc
      .from('event_photos')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('is_hidden', false),

    // Ratings
    svc.from('event_ratings').select('rating').eq('event_id', eventId),

    // Spirit points for this event
    svc
      .from('spirit_points_log')
      .select('user_id, points')
      .eq('reference_id', eventId),

    // Next upcoming event for this group
    svc
      .from('events')
      .select('id, title, starts_at')
      .eq('group_id', event.group_id)
      .gt('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  // 3. Process attendance
  const rsvpCount = rsvpCountResult.count ?? 0
  const attendedCount = checkedInResult.count ?? 0
  const noShowCount = Math.max(0, rsvpCount - attendedCount)
  const attendanceRate = rsvpCount > 0 ? Math.round((attendedCount / rsvpCount) * 100) : 0

  // 4. Process attendee list with tiers
  const attendeeUserIds = (attendeeResult.data ?? []).map((r) => r.user_id)

  let tierMap: Record<string, string> = {}
  if (attendeeUserIds.length > 0) {
    const { data: stats } = await svc
      .from('member_stats')
      .select('user_id, tier')
      .eq('group_id', event.group_id)
      .in('user_id', attendeeUserIds)

    tierMap = Object.fromEntries((stats ?? []).map((s) => [s.user_id, s.tier ?? 'newcomer']))
  }

  const attendees = (attendeeResult.data ?? []).map((r) => {
    const profile = r.profiles as unknown as {
      full_name: string
      avatar_url: string | null
    } | null
    return {
      userId: r.user_id,
      fullName: profile?.full_name ?? 'Member',
      avatarUrl: profile?.avatar_url ?? null,
      tier: tierMap[r.user_id] ?? 'newcomer',
    }
  })

  // 5. Process milestones
  const milestones = (milestonesResult.data ?? []).map((m) => {
    const badge = m.badges as unknown as { name: string; emoji: string } | null
    const profile = m.profiles as unknown as { full_name: string } | null
    return {
      memberName: profile?.full_name?.split(' ')[0] ?? 'Member',
      badgeName: badge?.name ?? 'Badge',
      badgeEmoji: badge?.emoji ?? '🏆',
    }
  })

  // 6. Process finance
  const isPaidEvent = event.event_type === 'paid' || event.event_type === 'shared_cost'
  const payments = paymentsResult.data ?? []
  const totalCollectedPence = payments.reduce((sum, p) => sum + (p.amount_pence ?? 0), 0)
  const platformFeePence = Math.round(totalCollectedPence * 0.05)
  const payoutPence = totalCollectedPence - platformFeePence

  const finance = isPaidEvent
    ? { totalCollectedPence, payoutPence, platformFeePence, isPaidEvent }
    : null

  // 7. Process photos — find top-reacted photo
  const photoCount = photoCountResult.count ?? 0
  let topPhotoUrl: string | null = null

  if (photoCount > 0) {
    // Get all photos for this event then find the one with most reactions
    const { data: photos } = await svc
      .from('event_photos')
      .select('id, storage_path')
      .eq('event_id', eventId)
      .eq('is_hidden', false)
      .limit(50)

    if (photos && photos.length > 0) {
      const photoIds = photos.map((p) => p.id)
      const { data: reactions } = await svc
        .from('photo_reactions')
        .select('photo_id')
        .in('photo_id', photoIds)

      // Count reactions per photo
      const reactionCounts: Record<string, number> = {}
      for (const r of reactions ?? []) {
        reactionCounts[r.photo_id] = (reactionCounts[r.photo_id] ?? 0) + 1
      }

      // Find photo with most reactions (or first photo if no reactions)
      let topPhotoId = photos[0].id
      let maxReactions = 0
      for (const [photoId, count] of Object.entries(reactionCounts)) {
        if (count > maxReactions) {
          maxReactions = count
          topPhotoId = photoId
        }
      }

      const topPhoto = photos.find((p) => p.id === topPhotoId)
      if (topPhoto) {
        const { data: signedData } = await svc.storage
          .from('event-photos')
          .createSignedUrl(topPhoto.storage_path, 3600)
        topPhotoUrl = signedData?.signedUrl ?? null
      }
    }
  }

  // 8. Process ratings
  const ratingRows = ratingsResult.data ?? []
  const ratingCount = ratingRows.length
  const avgRating =
    ratingCount > 0
      ? Math.round((ratingRows.reduce((sum, r) => sum + r.rating, 0) / ratingCount) * 10) / 10
      : 0
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  for (const r of ratingRows) {
    if (r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating - 1]++
    }
  }

  // 9. Process spirit points
  const spiritRows = spiritResult.data ?? []
  const totalAwarded = spiritRows.reduce((sum, r) => sum + r.points, 0)

  // Group by user for top earners
  const userPoints: Record<string, number> = {}
  for (const r of spiritRows) {
    userPoints[r.user_id] = (userPoints[r.user_id] ?? 0) + r.points
  }

  const topEarnerEntries = Object.entries(userPoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  let topEarners: Array<{ name: string; points: number }> = []
  if (topEarnerEntries.length > 0) {
    const earnerIds = topEarnerEntries.map(([id]) => id)
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, full_name')
      .in('id', earnerIds)

    const nameMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.full_name ?? 'Member'])
    )

    topEarners = topEarnerEntries.map(([id, points]) => ({
      name: nameMap[id] ?? 'Member',
      points,
    }))
  }

  // 10. Process next event
  const nextEvent = nextEventResult.data
    ? {
        id: nextEventResult.data.id,
        title: nextEventResult.data.title,
        date: format(new Date(nextEventResult.data.starts_at), 'EEEE d MMMM'),
      }
    : null

  return {
    event: {
      id: event.id,
      title: event.title,
      date: eventDate,
      location: event.location,
      coverUrl: event.cover_url,
      eventType: event.event_type,
    },
    group: {
      id: group.id,
      name: group.name,
      slug: group.slug,
      logoUrl: group.logo_url,
      colour,
    },
    attendance: { rsvpCount, attendedCount, noShowCount, attendanceRate },
    attendees,
    milestones,
    finance,
    photos: { count: photoCount, topPhotoUrl },
    ratings: { avgRating, ratingCount, distribution },
    spiritPoints: { totalAwarded, topEarners },
    nextEvent,
  }
}
