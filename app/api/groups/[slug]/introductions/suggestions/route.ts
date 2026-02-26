import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    const { data: group } = await svc
      .from('groups')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Admin check
    const { data: membership } = await svc
      .from('group_members')
      .select('role, status')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch events in this group from the past 30 days
    const { data: recentEvents } = await svc
      .from('events')
      .select('id')
      .eq('group_id', group.id)
      .gte('starts_at', thirtyDaysAgo)

    const eventIds = (recentEvents ?? []).map((e) => e.id)

    if (eventIds.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    // Fetch RSVPs for those events (only 'going')
    const { data: rsvps } = await svc
      .from('rsvps')
      .select('event_id, user_id')
      .in('event_id', eventIds)
      .eq('status', 'going')

    if (!rsvps || rsvps.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    // Build co-attendee pairs
    const eventAttendees: Record<string, string[]> = {}
    for (const r of rsvps) {
      if (!eventAttendees[r.event_id]) eventAttendees[r.event_id] = []
      eventAttendees[r.event_id].push(r.user_id)
    }

    const pairCounts: Record<string, number> = {}
    for (const attendees of Object.values(eventAttendees)) {
      for (let i = 0; i < attendees.length; i++) {
        for (let j = i + 1; j < attendees.length; j++) {
          const [a, b] = [attendees[i], attendees[j]].sort()
          const key = `${a}|${b}`
          pairCounts[key] = (pairCounts[key] ?? 0) + 1
        }
      }
    }

    // Fetch existing introductions to exclude
    const { data: existingIntros } = await svc
      .from('introductions')
      .select('member_a, member_b')
      .eq('group_id', group.id)

    const existingPairs = new Set(
      (existingIntros ?? []).map((i) => {
        const [a, b] = [i.member_a, i.member_b].sort()
        return `${a}|${b}`
      })
    )

    // Fetch existing DM channels to exclude pairs that already chat
    const allUserIds = new Set<string>()
    for (const key of Object.keys(pairCounts)) {
      const [a, b] = key.split('|')
      allUserIds.add(a)
      allUserIds.add(b)
    }

    const { data: dmMemberships } = await svc
      .from('channel_members')
      .select('channel_id, user_id, channels!inner(type)')
      .in('user_id', Array.from(allUserIds))

    const dmChannelUsers: Record<string, Set<string>> = {}
    for (const cm of dmMemberships ?? []) {
      if ((cm.channels as unknown as { type: string })?.type === 'dm') {
        if (!dmChannelUsers[cm.channel_id]) dmChannelUsers[cm.channel_id] = new Set()
        dmChannelUsers[cm.channel_id].add(cm.user_id)
      }
    }

    const existingDmPairs = new Set<string>()
    for (const users of Object.values(dmChannelUsers)) {
      const arr = Array.from(users)
      if (arr.length === 2) {
        const [a, b] = arr.sort()
        existingDmPairs.add(`${a}|${b}`)
      }
    }

    // Filter and sort suggestions
    const suggestions = Object.entries(pairCounts)
      .filter(([key]) => !existingPairs.has(key) && !existingDmPairs.has(key))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([key, sharedEvents]) => {
        const [memberA, memberB] = key.split('|')
        return { memberA, memberB, sharedEvents }
      })

    if (suggestions.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    // Fetch profiles for suggested members
    const profileIds = new Set<string>()
    for (const s of suggestions) {
      profileIds.add(s.memberA)
      profileIds.add(s.memberB)
    }

    const { data: profiles } = await svc
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', Array.from(profileIds))

    const profileMap: Record<string, { fullName: string; avatarUrl: string | null }> = {}
    for (const p of profiles ?? []) {
      profileMap[p.id] = { fullName: p.full_name, avatarUrl: p.avatar_url }
    }

    const enrichedSuggestions = suggestions.map((s) => ({
      memberA: {
        id: s.memberA,
        fullName: profileMap[s.memberA]?.fullName ?? 'Unknown',
        avatarUrl: profileMap[s.memberA]?.avatarUrl ?? null,
      },
      memberB: {
        id: s.memberB,
        fullName: profileMap[s.memberB]?.fullName ?? 'Unknown',
        avatarUrl: profileMap[s.memberB]?.avatarUrl ?? null,
      },
      sharedEvents: s.sharedEvents,
    }))

    return NextResponse.json({ suggestions: enrichedSuggestions })
  } catch (err) {
    console.error('[introductions/suggestions] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
