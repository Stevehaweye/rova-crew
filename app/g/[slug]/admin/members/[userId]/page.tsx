import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import MemberInsightsClient from './member-insights-client'

export default async function MemberInsightsPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>
}) {
  const { slug, userId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/g/${slug}/admin/members/${userId}`)

  const svc = createServiceClient()

  // Fetch group
  const { data: group } = await svc
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()
  if (!group) redirect('/home')

  // Verify admin
  const { data: adminMembership } = await svc
    .from('group_members')
    .select('role')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .maybeSingle()
  if (
    !adminMembership ||
    !['super_admin', 'co_admin'].includes(adminMembership.role)
  )
    redirect(`/g/${slug}`)

  // Fetch member's profile and membership
  const [profileResult, membershipResult, statsResult] = await Promise.all([
    svc
      .from('profiles')
      .select('full_name, avatar_url, email')
      .eq('id', userId)
      .maybeSingle(),
    svc
      .from('group_members')
      .select('role, joined_at, status')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .eq('status', 'approved')
      .maybeSingle(),
    svc
      .from('member_stats')
      .select('tier, crew_score, spirit_points_total')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const membership = membershipResult.data
  if (!membership) redirect(`/g/${slug}/admin/members`)

  const profile = profileResult.data
  const stats = statsResult.data

  // Fetch group events and RSVPs for this member
  const { data: groupEvents } = await svc
    .from('events')
    .select('id, title, starts_at, ends_at')
    .eq('group_id', group.id)
    .order('starts_at', { ascending: false })

  const eventIds = (groupEvents ?? []).map((e) => e.id)

  // Fetch RSVP history for this member
  let rsvpHistory: {
    eventId: string
    eventTitle: string
    eventDate: string
    rsvpStatus: string
    checkedIn: boolean
  }[] = []

  if (eventIds.length > 0) {
    const { data: rsvps } = await svc
      .from('rsvps')
      .select('event_id, status, checked_in_at, created_at')
      .eq('user_id', userId)
      .in('event_id', eventIds)

    const eventMap = Object.fromEntries(
      (groupEvents ?? []).map((e) => [e.id, e])
    )

    rsvpHistory = (rsvps ?? []).map((r) => {
      const event = eventMap[r.event_id]
      return {
        eventId: r.event_id,
        eventTitle: event?.title ?? 'Unknown Event',
        eventDate: event?.starts_at ?? r.created_at,
        rsvpStatus: r.status,
        checkedIn: !!r.checked_in_at,
      }
    })

    // Sort by event date, most recent first
    rsvpHistory.sort(
      (a, b) =>
        new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
    )
  }

  // Fetch badge awards
  const [badgesResult, awardsResult] = await Promise.all([
    svc.from('badges').select('id, slug, name, emoji, description, category'),
    svc
      .from('badge_awards')
      .select('badge_id, awarded_at')
      .eq('user_id', userId)
      .eq('group_id', group.id),
  ])

  const awardMap = Object.fromEntries(
    (awardsResult.data ?? []).map((a) => [a.badge_id, a.awarded_at])
  )

  const badges = (badgesResult.data ?? []).map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    emoji: b.emoji,
    description: b.description,
    category: b.category,
    awardedAt: awardMap[b.id] ?? null,
  }))

  // Fetch nudges sent to this member
  const { data: nudges } = await svc
    .from('nudges_sent')
    .select('id, created_at')
    .eq('group_id', group.id)
    .eq('member_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const lastNudgeAt = nudges?.[0]?.created_at ?? null

  // Compute last activity
  const spiritResult = await svc
    .from('spirit_points_log')
    .select('created_at')
    .eq('group_id', group.id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const latestRsvpDate = rsvpHistory[0]?.eventDate ?? null
  const latestSpiritDate = spiritResult.data?.[0]?.created_at ?? null
  let lastActive: string | null = null
  if (latestRsvpDate && latestSpiritDate) {
    lastActive =
      latestRsvpDate > latestSpiritDate ? latestRsvpDate : latestSpiritDate
  } else {
    lastActive = latestRsvpDate || latestSpiritDate || null
  }

  // Compute attendance and no-show rates
  const goingRsvps = rsvpHistory.filter((r) => r.rsvpStatus === 'going')
  const attended = goingRsvps.filter((r) => r.checkedIn).length
  const noShows = goingRsvps.filter((r) => {
    // Only count as no-show if event is in the past
    return !r.checkedIn && new Date(r.eventDate) < new Date()
  }).length
  const totalGoing = goingRsvps.length
  const attendanceRate = totalGoing > 0 ? Math.round((attended / totalGoing) * 100) : 0
  const noShowRate = totalGoing > 0 ? Math.round((noShows / totalGoing) * 100) : 0

  return (
    <MemberInsightsClient
      group={{
        id: group.id,
        name: group.name,
        slug: group.slug,
        primaryColour: group.primary_colour,
      }}
      member={{
        userId,
        fullName: profile?.full_name ?? 'Member',
        avatarUrl: profile?.avatar_url ?? null,
        email: profile?.email ?? null,
        role: membership.role,
        joinedAt: membership.joined_at,
        tier: stats?.tier ?? 'newcomer',
        crewScore: stats?.crew_score ?? 0,
        spiritPoints: stats?.spirit_points_total ?? 0,
        lastActive,
        attendanceRate,
        noShowRate,
        eventsAttended: attended,
        totalRsvps: totalGoing,
      }}
      rsvpHistory={rsvpHistory}
      badges={badges}
      lastNudgeAt={lastNudgeAt}
    />
  )
}
