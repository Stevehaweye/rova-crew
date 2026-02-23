import { createClient } from '@/lib/supabase/server'
import EventPageClient from './event-page-client'
import Link from 'next/link'

// ─── Not Found ───────────────────────────────────────────────────────────────

function NotFoundView() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-7xl mb-6 select-none">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Event not found</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          This event doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: '#0D7377' }}
        >
          Go home &rarr;
        </Link>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function EventPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  // Fetch event with group info
  const { data: event } = await supabase
    .from('events')
    .select('*, groups ( name, slug, logo_url, primary_colour )')
    .eq('id', params.id)
    .maybeSingle()

  if (!event) return <NotFoundView />

  const group = event.groups as unknown as {
    name: string
    slug: string
    logo_url: string | null
    primary_colour: string
  }

  // Get current user (optional — page works for anonymous)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Parallel fetches: RSVP counts, initial RSVPs, guest RSVPs, user's RSVP, user profile
  const [
    memberRsvpCount,
    guestRsvpCount,
    memberRsvps,
    guestRsvps,
    userRsvpResult,
    profileResult,
  ] = await Promise.all([
    // Member RSVP count (going + maybe)
    supabase
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', params.id)
      .in('status', ['going', 'maybe']),

    // Guest RSVP count (going + maybe)
    supabase
      .from('guest_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', params.id)
      .in('status', ['going', 'maybe']),

    // Member RSVPs with profiles (limit 20)
    supabase
      .from('rsvps')
      .select('id, user_id, status, created_at, profiles ( full_name, avatar_url )')
      .eq('event_id', params.id)
      .in('status', ['going', 'maybe'])
      .order('created_at', { ascending: true })
      .limit(20),

    // Guest RSVPs (limit 20)
    supabase
      .from('guest_rsvps')
      .select('id, name, email, status, created_at')
      .eq('event_id', params.id)
      .in('status', ['going', 'maybe'])
      .order('created_at', { ascending: true })
      .limit(20),

    // Current user's RSVP (if logged in)
    user
      ? supabase
          .from('rsvps')
          .select('id, status')
          .eq('event_id', params.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Current user's profile (if logged in)
    user
      ? supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const totalGoingCount =
    (memberRsvpCount.count ?? 0) + (guestRsvpCount.count ?? 0)

  return (
    <EventPageClient
      event={{
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        coverUrl: event.cover_url,
        maxCapacity: event.max_capacity,
        createdBy: event.created_by,
      }}
      group={{
        name: group.name,
        slug: group.slug,
        logoUrl: group.logo_url,
        primaryColour: group.primary_colour,
      }}
      initialMemberRsvps={
        (memberRsvps.data ?? []).map((r) => {
          const profile = r.profiles as unknown as { full_name: string; avatar_url: string | null } | null
          return {
            id: r.id,
            userId: r.user_id,
            status: r.status as 'going' | 'maybe',
            createdAt: r.created_at,
            profile: profile ?? { full_name: 'Member', avatar_url: null },
          }
        })
      }
      initialGuestRsvps={
        (guestRsvps.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status as 'going' | 'maybe',
          createdAt: r.created_at,
        }))
      }
      totalGoingCount={totalGoingCount}
      currentUser={user ? {
        id: user.id,
        fullName: profileResult.data?.full_name ?? user.email?.split('@')[0] ?? 'You',
        avatarUrl: profileResult.data?.avatar_url ?? null,
      } : null}
      currentUserRsvp={
        userRsvpResult.data
          ? { id: userRsvpResult.data.id, status: userRsvpResult.data.status as 'going' | 'maybe' | 'not_going' }
          : null
      }
    />
  )
}
