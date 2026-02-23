import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from './admin-shell'

// Supabase join type for nested profiles select
interface ProfileJoin {
  full_name: string
  avatar_url: string | null
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // ── Auth check ────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/g/${slug}/admin`)

  // ── Fetch group ───────────────────────────────────────────────────────────────
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) redirect('/home')

  // ── Role check: must be super_admin or co_admin ───────────────────────────────
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'super_admin' || membership.role === 'co_admin')

  if (!isAdmin) redirect(`/g/${slug}`)

  // ── Parallel data fetch ───────────────────────────────────────────────────────
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const [
    profileResult,
    countResult,
    weekCountResult,
    recentResult,
    upcomingEventsResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single(),

    // Total approved members
    supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .eq('status', 'approved'),

    // New members in the last 7 days
    supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .eq('status', 'approved')
      .gte('joined_at', weekAgo),

    // Last 5 members (most recent first) with profile data
    supabase
      .from('group_members')
      .select('user_id, joined_at, profiles ( full_name, avatar_url )')
      .eq('group_id', group.id)
      .eq('status', 'approved')
      .order('joined_at', { ascending: false })
      .limit(5),

    // Upcoming events (next 5, soonest first)
    supabase
      .from('events')
      .select('id, title, starts_at, ends_at, location, max_capacity, cover_url')
      .eq('group_id', group.id)
      .gte('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(5),
  ])

  const profile = profileResult.data ?? {
    full_name: user.email?.split('@')[0] ?? 'Admin',
    avatar_url: null,
  }

  const memberCount = countResult.count ?? 0
  const membersThisWeek = weekCountResult.count ?? 0

  const recentMembers = (recentResult.data ?? []).map((m) => {
    const p = m.profiles as unknown as ProfileJoin
    return {
      userId: m.user_id,
      fullName: p?.full_name ?? 'Member',
      avatarUrl: p?.avatar_url ?? null,
      joinedAt: m.joined_at,
    }
  })

  const upcomingEvents = upcomingEventsResult.data ?? []

  // Fetch RSVP counts for each upcoming event
  const eventRsvpCounts: Record<string, number> = {}
  if (upcomingEvents.length > 0) {
    const eventIds = upcomingEvents.map((e) => e.id)
    const [memberRsvps, guestRsvps] = await Promise.all([
      supabase
        .from('rsvps')
        .select('event_id')
        .in('event_id', eventIds)
        .in('status', ['going', 'maybe']),
      supabase
        .from('guest_rsvps')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'confirmed'),
    ])
    for (const r of memberRsvps.data ?? []) {
      eventRsvpCounts[r.event_id] = (eventRsvpCounts[r.event_id] ?? 0) + 1
    }
    for (const r of guestRsvps.data ?? []) {
      eventRsvpCounts[r.event_id] = (eventRsvpCounts[r.event_id] ?? 0) + 1
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return (
    <AdminShell
      group={group}
      profile={profile}
      memberCount={memberCount}
      membersThisWeek={membersThisWeek}
      recentMembers={recentMembers}
      appUrl={appUrl}
      upcomingEvents={upcomingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        location: e.location,
        maxCapacity: e.max_capacity,
        rsvpCount: eventRsvpCounts[e.id] ?? 0,
      }))}
    />
  )
}
