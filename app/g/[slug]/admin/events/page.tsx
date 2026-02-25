import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EventRow {
  id: string
  title: string
  starts_at: string
  ends_at: string
  location: string | null
  max_capacity: number | null
  cover_url: string | null
  created_at: string
  event_type: string | null
  price_amount: number | null
  total_cost: number | null
}

interface PastEventStats {
  attended: number
  avgRating: number | null
  photoCount: number
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AdminEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { slug } = await params
  const { tab } = await searchParams
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/g/${slug}/admin/events`)

  // Group fetch
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

  const now = new Date().toISOString()
  const activeTab = tab ?? 'upcoming'

  // Fetch events
  let eventsQuery = supabase
    .from('events')
    .select('id, title, starts_at, ends_at, location, max_capacity, cover_url, created_at, event_type, price_amount, total_cost')
    .eq('group_id', group.id)

  if (activeTab === 'upcoming') {
    eventsQuery = eventsQuery.gte('starts_at', now).order('starts_at', { ascending: true })
  } else {
    eventsQuery = eventsQuery.lt('starts_at', now).order('starts_at', { ascending: false })
  }

  const { data: events } = await eventsQuery.limit(50)
  const eventRows: EventRow[] = events ?? []

  // Fetch RSVP counts for each event
  const rsvpCounts: Record<string, number> = {}
  if (eventRows.length > 0) {
    const eventIds = eventRows.map((e) => e.id)
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
      rsvpCounts[r.event_id] = (rsvpCounts[r.event_id] ?? 0) + 1
    }
    for (const r of guestRsvps.data ?? []) {
      rsvpCounts[r.event_id] = (rsvpCounts[r.event_id] ?? 0) + 1
    }
  }

  // Fetch report stats for past events
  const pastStats: Record<string, PastEventStats> = {}
  if (activeTab === 'past' && eventRows.length > 0) {
    const svc = createServiceClient()
    const pastIds = eventRows.map((e) => e.id)

    const [checkedInResult, ratingsResult, photosResult] = await Promise.all([
      svc
        .from('rsvps')
        .select('event_id')
        .in('event_id', pastIds)
        .not('checked_in_at', 'is', null),
      svc
        .from('event_ratings')
        .select('event_id, rating')
        .in('event_id', pastIds),
      svc
        .from('event_photos')
        .select('event_id')
        .in('event_id', pastIds)
        .eq('is_hidden', false),
    ])

    // Count attended per event
    for (const r of checkedInResult.data ?? []) {
      if (!pastStats[r.event_id]) pastStats[r.event_id] = { attended: 0, avgRating: null, photoCount: 0 }
      pastStats[r.event_id].attended++
    }

    // Avg rating per event
    const ratingsByEvent: Record<string, number[]> = {}
    for (const r of ratingsResult.data ?? []) {
      if (!ratingsByEvent[r.event_id]) ratingsByEvent[r.event_id] = []
      ratingsByEvent[r.event_id].push(r.rating)
    }
    for (const [eid, ratings] of Object.entries(ratingsByEvent)) {
      if (!pastStats[eid]) pastStats[eid] = { attended: 0, avgRating: null, photoCount: 0 }
      pastStats[eid].avgRating = Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
    }

    // Photo count per event
    for (const r of photosResult.data ?? []) {
      if (!pastStats[r.event_id]) pastStats[r.event_id] = { attended: 0, avgRating: null, photoCount: 0 }
      pastStats[r.event_id].photoCount++
    }
  }

  const colour = group.primary_colour.startsWith('#') ? group.primary_colour : `#${group.primary_colour}`

  const TABS = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
  ]

  const emptyMessages: Record<string, { emoji: string; title: string; sub: string }> = {
    upcoming: { emoji: '📅', title: 'No upcoming events', sub: 'Create an event to get your group together.' },
    past: { emoji: '📦', title: 'No past events', sub: 'Events that have ended will appear here.' },
  }

  const empty = emptyMessages[activeTab] ?? emptyMessages.upcoming

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href={`/g/${group.slug}/admin`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <Link href="/home" className="select-none">
            <span className="text-base font-black tracking-[0.14em]" style={{ color: '#0D7377' }}>ROVA</span>
            <span className="text-base font-black tracking-[0.14em]" style={{ color: '#C9982A' }}>CREW</span>
          </Link>
          <span className="text-gray-300 text-lg">·</span>
          <span className="text-sm font-semibold text-gray-600">Events</span>

          {/* Create button */}
          <Link
            href={`/g/${group.slug}/admin/events/new`}
            className="ml-auto px-4 py-2 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: colour }}
          >
            Create event +
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage events for <strong>{group.name}</strong>
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/g/${group.slug}/admin/events?tab=${tab.key}`}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={
                activeTab === tab.key
                  ? { backgroundColor: '#fff', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                  : { color: '#6B7280' }
              }
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Events list */}
        {eventRows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <p className="text-4xl mb-3 select-none">{empty.emoji}</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">{empty.title}</p>
            <p className="text-sm text-gray-400 mb-5">{empty.sub}</p>
            {activeTab === 'upcoming' && (
              <Link
                href={`/g/${group.slug}/admin/events/new`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
                style={{ backgroundColor: colour }}
              >
                Create your first event &rarr;
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_100px_80px_100px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span>Event</span>
              <span>Date</span>
              <span>RSVPs</span>
              <span>Actions</span>
            </div>

            {/* Rows */}
            {eventRows.map((ev) => {
              const start = new Date(ev.starts_at)
              const dateStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
              const count = rsvpCounts[ev.id] ?? 0
              const isPast = new Date(ev.starts_at) < new Date()

              return (
                <div
                  key={ev.id}
                  className="sm:grid sm:grid-cols-[1fr_100px_80px_100px] gap-4 px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  {/* Event info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white"
                      style={{ backgroundColor: isPast ? '#9CA3AF' : colour }}
                    >
                      <span className="text-[8px] font-bold uppercase leading-none">
                        {start.toLocaleDateString('en-GB', { month: 'short' })}
                      </span>
                      <span className="text-base font-black leading-none">{start.getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                        {(() => {
                          const type = ev.event_type ?? 'free'
                          if (type === 'paid') return (
                            <span className="flex-shrink-0 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              £{(ev.price_amount ?? 0).toFixed(2)}
                            </span>
                          )
                          if (type === 'shared_cost') return (
                            <span className="flex-shrink-0 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              SHARED
                            </span>
                          )
                          return (
                            <span className="flex-shrink-0 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              FREE
                            </span>
                          )
                        })()}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {ev.location ?? 'No location'}
                      </p>
                      {isPast && pastStats[ev.id] && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {pastStats[ev.id].attended} attended
                          {pastStats[ev.id].avgRating !== null && (
                            <> · {pastStats[ev.id].avgRating}★</>
                          )}
                          {pastStats[ev.id].photoCount > 0 && (
                            <> · {pastStats[ev.id].photoCount} photos</>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex items-center">
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">{dateStr}</p>
                      <p className="text-xs text-gray-400">{timeStr}</p>
                    </div>
                  </div>

                  {/* RSVPs */}
                  <div className="flex items-center">
                    <p className="text-sm font-bold text-gray-900">
                      {count}
                      {ev.max_capacity && (
                        <span className="text-gray-400 font-normal">/{ev.max_capacity}</span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/events/${ev.id}`}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      View
                    </Link>
                    {!isPast && (
                      <Link
                        href={`/g/${group.slug}/admin/events/${ev.id}/edit`}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </Link>
                    )}
                    {isPast && (
                      <Link
                        href={`/g/${group.slug}/admin/events/${ev.id}/report`}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: colour }}
                      >
                        📊 Report
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
