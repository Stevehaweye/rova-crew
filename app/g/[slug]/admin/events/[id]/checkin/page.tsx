import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CheckinClient from './checkin-client'

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id: eventId } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/g/${slug}/admin/events/${eventId}/checkin`)

  // Fetch group
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) redirect('/home')

  // Role check
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

  // Fetch event
  const { data: event } = await supabase
    .from('events')
    .select('id, title, starts_at, ends_at, location')
    .eq('id', eventId)
    .eq('group_id', group.id)
    .maybeSingle()

  if (!event) redirect(`/g/${slug}/admin/events`)

  // Fetch all RSVPs (members + guests) for this event
  const [memberRsvpsResult, guestRsvpsResult] = await Promise.all([
    supabase
      .from('rsvps')
      .select('id, user_id, status, checked_in_at, profiles ( full_name, avatar_url )')
      .eq('event_id', eventId)
      .in('status', ['going', 'maybe'])
      .order('created_at', { ascending: true }),

    supabase
      .from('guest_rsvps')
      .select('id, first_name, last_name, status, checked_in_at, qr_token')
      .eq('event_id', eventId)
      .in('status', ['confirmed', 'attended'])
      .order('created_at', { ascending: true }),
  ])

  const colour = group.primary_colour.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour}`

  const memberAttendees = (memberRsvpsResult.data ?? []).map((r) => {
    const profile = r.profiles as unknown as { full_name: string; avatar_url: string | null } | null
    return {
      id: r.id,
      userId: r.user_id,
      name: profile?.full_name ?? 'Member',
      avatarUrl: profile?.avatar_url ?? null,
      rsvpStatus: r.status as 'going' | 'maybe',
      checkedIn: !!r.checked_in_at,
      type: 'member' as const,
      table: 'rsvps' as const,
    }
  })

  const guestAttendees = (guestRsvpsResult.data ?? []).map((r) => ({
    id: r.id,
    userId: null as string | null,
    name: `${r.first_name} ${r.last_name}`,
    avatarUrl: null as string | null,
    rsvpStatus: 'going' as const,
    checkedIn: !!r.checked_in_at,
    type: 'guest' as const,
    table: 'guest_rsvps' as const,
  }))

  return (
    <CheckinClient
      event={{
        id: event.id,
        title: event.title,
        startsAt: event.starts_at,
        location: event.location,
      }}
      groupSlug={group.slug}
      groupName={group.name}
      colour={colour}
      attendees={[...memberAttendees, ...guestAttendees]}
    />
  )
}
