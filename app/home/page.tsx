import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import UserMenu from './user-menu'
import PushPermissionBanner from '@/components/PushPermissionBanner'
import PostEventCard, { type PostEventHighlight } from '@/components/feed/PostEventCard'

export const metadata: Metadata = {
  title: 'Home | ROVA Crew',
  description: 'Your groups, events, and community — all in one place.',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  full_name: string
  avatar_url: string | null
}

interface Group {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_colour: string
  category: string
  tagline: string | null
}

interface UpcomingEvent {
  id: string
  title: string
  startsAt: string
  location: string | null
  groupName: string
  groupColour: string
  rsvpStatus: 'going' | 'maybe' | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstName(fullName: string) {
  return fullName.split(' ')[0]
}

function initials(fullName: string) {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// Colours in DB are stored without '#'
function hex(c: string) {
  return c.startsWith('#') ? c : `#${c}`
}

function lighten(c: string, alpha = '18') {
  return hex(c) + alpha
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PeopleIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  )
}

function SearchIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

function LightningIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}

// ─── Top Navigation ───────────────────────────────────────────────────────────

function TopNav({ profile, groupSlug }: { profile: Profile; groupSlug?: string | null }) {
  const name = profile.full_name
  const abbr = initials(name)

  return (
    <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <Link href="/home" className="select-none">
          <span className="text-xl font-black tracking-[0.14em]" style={{ color: '#0D7377' }}>
            ROVA
          </span>
          <span className="text-xl font-black tracking-[0.14em]" style={{ color: '#C9982A' }}>
            CREW
          </span>
        </Link>

        {/* User identity */}
        <UserMenu name={name} avatarUrl={profile.avatar_url} initials={abbr} groupSlug={groupSlug} />
      </div>
    </nav>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ name }: { name: string }) {
  const first = firstName(name)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

      {/* Hero */}
      <div className="text-center mb-12">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ backgroundColor: lighten('0D7377', '15'), color: '#0D7377' }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#0D7377' }} />
          Welcome to your dashboard
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">
          Welcome to ROVA Crew,{' '}
          <span style={{ color: '#0D7377' }}>{first}</span>!
        </h1>
        <p className="text-gray-500 text-lg max-w-md mx-auto leading-relaxed">
          Start by creating your first community or finding one to join.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

        {/* Create card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col hover:shadow-md transition-shadow">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style={{ backgroundColor: lighten('0D7377', '12'), color: '#0D7377' }}
          >
            <PeopleIcon />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Start a community</h2>
          <p className="text-gray-500 text-sm flex-1 mb-6 leading-relaxed">
            Launch your group in 3 minutes. Invite members, track attendance, build your crew.
          </p>
          <Link
            href="/groups/new"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#0D7377' }}
          >
            Create a group
            <ChevronRightIcon />
          </Link>
        </div>

        {/* Join card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gray-100 text-gray-500">
            <SearchIcon />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Find a community</h2>
          <p className="text-gray-500 text-sm flex-1 mb-6 leading-relaxed">
            Browse groups near you. From running crews to book clubs — find your people.
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
          >
            Discover groups
            <ChevronRightIcon />
          </Link>
        </div>
      </div>

      {/* WhatsApp migration banner */}
      <div
        className="rounded-2xl p-5 sm:p-6 flex items-center gap-4"
        style={{ backgroundColor: lighten('0D7377', '0E') }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: lighten('0D7377', '20'), color: '#0D7377' }}
        >
          <LightningIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">Migrating from WhatsApp?</p>
          <p className="text-gray-500 text-sm mt-0.5 leading-snug">
            Move your existing group to ROVA in under 5 minutes.
          </p>
        </div>
        <Link
          href="/migrate"
          className="text-sm font-semibold whitespace-nowrap transition-opacity hover:opacity-75 flex-shrink-0"
          style={{ color: '#0D7377' }}
        >
          Start migration&nbsp;→
        </Link>
      </div>
    </div>
  )
}

// ─── Group Card ───────────────────────────────────────────────────────────────

function GroupCard({ group, memberCount }: { group: Group; memberCount: number }) {
  const groupColour = hex(group.primary_colour)

  return (
    <Link
      href={`/g/${group.slug}`}
      className="group flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 transition-all duration-200"
    >
      {/* Colour bar */}
      <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: groupColour }} />

      {/* Content */}
      <div className="flex-1 px-4 py-4 flex items-center gap-4 min-w-0">
        {/* Logo / initials */}
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-base overflow-hidden"
          style={{ backgroundColor: groupColour }}
        >
          {group.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.logo_url} alt={group.name} className="w-full h-full object-cover" />
          ) : (
            initials(group.name)
          )}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
          {group.tagline && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{group.tagline}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-gray-400">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
            <span className="text-gray-300">·</span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: lighten(group.primary_colour, '15'), color: groupColour }}
            >
              {group.category}
            </span>
          </div>
        </div>

        {/* CTA */}
        <span
          className="text-sm font-semibold flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: '#0D7377' }}
        >
          View group <ChevronRightIcon />
        </span>
      </div>
    </Link>
  )
}

// ─── Has Groups Content ───────────────────────────────────────────────────────

function HasGroupsContent({
  profile,
  groups,
  memberCounts,
  upcomingEvents,
  postEventHighlights,
}: {
  profile: Profile
  groups: Group[]
  memberCounts: Record<string, number>
  upcomingEvents: UpcomingEvent[]
  postEventHighlights: PostEventHighlight[]
}) {
  const first = firstName(profile.full_name)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Hey, {first} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Here&apos;s what&apos;s happening with your crews.</p>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-8">

        {/* ── Main column ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">

          {/* My Groups */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">My Groups</h2>
              <Link
                href="/groups/new"
                className="text-sm font-semibold transition-opacity hover:opacity-75"
                style={{ color: '#0D7377' }}
              >
                + New group
              </Link>
            </div>
            <div className="space-y-3">
              {groups.map((g) => (
                <GroupCard key={g.id} group={g} memberCount={memberCounts[g.id] ?? 0} />
              ))}
            </div>
          </section>

          {/* Coming up for you */}
          {upcomingEvents.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">Coming up for you</h2>
              </div>
              <div className="space-y-3">
                {upcomingEvents.map((ev) => {
                  const start = new Date(ev.startsAt)
                  const monthStr = format(start, 'MMM')
                  const dayStr = start.getDate().toString()
                  const dateTimeStr = format(start, "EEE d MMM · h:mm a")
                  const colour = ev.groupColour

                  return (
                    <Link
                      key={ev.id}
                      href={`/events/${ev.id}`}
                      className="group flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 transition-all duration-200"
                    >
                      {/* Colour bar */}
                      <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: colour }} />

                      <div className="flex-1 px-4 py-4 flex items-center gap-4 min-w-0">
                        {/* Date block */}
                        <div
                          className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white"
                          style={{ backgroundColor: colour }}
                        >
                          <span className="text-[10px] font-bold uppercase leading-none">{monthStr}</span>
                          <span className="text-lg font-black leading-none">{dayStr}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-gray-400 truncate">{ev.groupName}</p>
                          <p className="font-semibold text-gray-900 text-sm truncate group-hover:underline">{ev.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {dateTimeStr}
                            {ev.location && <> · {ev.location}</>}
                          </p>
                        </div>

                        {/* RSVP status */}
                        {ev.rsvpStatus ? (
                          <span className="flex-shrink-0 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            ✓ Going
                          </span>
                        ) : (
                          <span
                            className="flex-shrink-0 text-xs font-semibold flex items-center gap-0.5"
                            style={{ color: '#0D7377' }}
                          >
                            RSVP <ChevronRightIcon />
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Recent highlights */}
          {postEventHighlights.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">Recent highlights</h2>
              </div>
              <div className="space-y-4">
                {postEventHighlights.map((h) => (
                  <PostEventCard key={h.eventId} highlight={h} />
                ))}
              </div>
            </section>
          )}

          {/* Empty state — no upcoming events and no highlights */}
          {upcomingEvents.length === 0 && postEventHighlights.length === 0 && (
            <section>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <CalendarIcon />
                </div>
                <p className="font-semibold text-gray-700 text-sm">No events recently</p>
                <p className="text-gray-400 text-xs mt-1">
                  Check out what&apos;s happening across your groups.{' '}
                  <Link href="/discover" className="font-semibold hover:underline" style={{ color: '#0D7377' }}>
                    Explore groups &rarr;
                  </Link>
                </p>
              </div>
            </section>
          )}
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <div className="mt-8 lg:mt-0 space-y-4">

          {/* My Streak */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              My Streak
            </p>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">🔥</span>
              <div>
                <p className="text-3xl font-black text-gray-900 leading-none">0</p>
                <p className="text-xs text-gray-400 mt-1">weeks in a row</p>
              </div>
            </div>
            <p
              className="text-sm font-semibold"
              style={{ color: '#0D7377' }}
            >
              Attend an event to start your streak!
            </p>
            <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full w-0 rounded-full" style={{ backgroundColor: '#0D7377' }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">0 / 4 events this month</p>
          </div>

          {/* Quick stats */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Quick Stats
            </p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Groups joined</span>
                <span className="text-sm font-bold text-gray-900">{groups.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Events attended</span>
                <span className="text-sm font-bold text-gray-900">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Crew score</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-900">0</span>
                  <span className="text-xs text-gray-400">/ 1000</span>
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp nudge — compact */}
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ backgroundColor: lighten('0D7377', '0E') }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: lighten('0D7377', '20'), color: '#0D7377' }}
            >
              <LightningIcon />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900">Bring your WhatsApp group</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                Move to ROVA in under 5 minutes.
              </p>
              <Link
                href="/migrate"
                className="text-xs font-semibold mt-2 inline-block"
                style={{ color: '#0D7377' }}
              >
                Start migration →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  // Parallel fetch: profile + group memberships
  const [profileResult, membershipsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single(),
    supabase
      .from('group_members')
      .select(
        `role, status, joined_at,
         groups ( id, name, slug, logo_url, primary_colour, category, tagline )`
      )
      .eq('user_id', user.id)
      .eq('status', 'approved'),
  ])

  // Graceful fallback if profile row isn't ready yet
  const profile: Profile = profileResult.data ?? {
    full_name: user.email?.split('@')[0] ?? 'there',
    avatar_url: null,
  }

  const groups: Group[] = (membershipsResult.data ?? [])
    .map((m) => m.groups as unknown as Group)
    .filter(Boolean)

  // Fetch member counts + upcoming events in parallel
  const groupIds = groups.map((g) => g.id)
  const now = new Date().toISOString()

  const [countRes, eventsRes] = groups.length > 0
    ? await Promise.all([
        supabase
          .from('group_members')
          .select('group_id')
          .in('group_id', groupIds)
          .eq('status', 'approved'),
        supabase
          .from('events')
          .select('id, title, starts_at, location, group_id')
          .in('group_id', groupIds)
          .gte('starts_at', now)
          .order('starts_at', { ascending: true })
          .limit(5),
      ])
    : [{ data: [] as { group_id: string }[] }, { data: [] as { id: string; title: string; starts_at: string; location: string | null; group_id: string }[] }]

  const memberCounts: Record<string, number> = {}
  countRes.data?.forEach(({ group_id }) => {
    memberCounts[group_id] = (memberCounts[group_id] ?? 0) + 1
  })

  // Build group lookup for event cards
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]))

  // Fetch user's RSVPs for these events
  const rawEvents = eventsRes.data ?? []
  const rsvpMap: Record<string, 'going' | 'maybe'> = {}
  if (rawEvents.length > 0) {
    const eventIds = rawEvents.map((e) => e.id)
    const { data: userRsvps } = await supabase
      .from('rsvps')
      .select('event_id, status')
      .eq('user_id', user.id)
      .in('event_id', eventIds)
      .in('status', ['going', 'maybe'])

    userRsvps?.forEach((r) => {
      rsvpMap[r.event_id] = r.status as 'going' | 'maybe'
    })
  }

  const upcomingEvents: UpcomingEvent[] = rawEvents.map((e) => {
    const g = groupMap[e.group_id]
    return {
      id: e.id,
      title: e.title,
      startsAt: e.starts_at,
      location: e.location,
      groupName: g?.name ?? 'Group',
      groupColour: hex(g?.primary_colour ?? '0D7377'),
      rsvpStatus: rsvpMap[e.id] ?? null,
    }
  })

  // ── Post-event highlights (past 7 days) ──────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let postEventHighlights: PostEventHighlight[] = []

  if (groups.length > 0) {
    const svc = createServiceClient()

    const { data: pastEvents } = await svc
      .from('events')
      .select('id, title, ends_at, group_id, cover_url')
      .in('group_id', groupIds)
      .lte('ends_at', now)
      .gte('ends_at', sevenDaysAgo)
      .order('ends_at', { ascending: false })
      .limit(10)

    if (pastEvents && pastEvents.length > 0) {
      const pastEventIds = pastEvents.map((e) => e.id)

      // Parallel fetch: attendance, photos, ratings, milestones
      const [attendanceRes, photosRes, ratingsRes, milestonesRes] = await Promise.all([
        svc
          .from('rsvps')
          .select('event_id')
          .in('event_id', pastEventIds)
          .not('checked_in_at', 'is', null),
        svc
          .from('event_photos')
          .select('event_id, storage_path')
          .in('event_id', pastEventIds)
          .eq('is_hidden', false),
        svc
          .from('event_ratings')
          .select('event_id, rating')
          .in('event_id', pastEventIds),
        svc
          .from('badge_awards')
          .select(
            'group_id, awarded_at, badges:badge_id ( name, emoji ), profiles:user_id ( full_name )'
          )
          .in('group_id', groupIds)
          .gte('awarded_at', sevenDaysAgo),
      ])

      // Attendance counts per event
      const attendanceCounts: Record<string, number> = {}
      for (const r of attendanceRes.data ?? []) {
        attendanceCounts[r.event_id] = (attendanceCounts[r.event_id] ?? 0) + 1
      }

      // Photo counts + first photo path per event
      const photoCounts: Record<string, number> = {}
      const firstPhotoPath: Record<string, string> = {}
      for (const p of photosRes.data ?? []) {
        photoCounts[p.event_id] = (photoCounts[p.event_id] ?? 0) + 1
        if (!firstPhotoPath[p.event_id]) {
          firstPhotoPath[p.event_id] = p.storage_path
        }
      }

      // Get signed URLs for cover photos (parallel)
      const eventsNeedingCover = pastEvents.filter(
        (e) => !e.cover_url && firstPhotoPath[e.id]
      )
      const coverSignResults = await Promise.all(
        eventsNeedingCover.map(async (e) => {
          const { data: signedData } = await svc.storage
            .from('event-photos')
            .createSignedUrl(firstPhotoPath[e.id], 3600)
          return { eventId: e.id, url: signedData?.signedUrl ?? null }
        })
      )
      const coverUrls: Record<string, string> = {}
      for (const r of coverSignResults) {
        if (r.url) coverUrls[r.eventId] = r.url
      }

      // Rating averages per event
      const ratingData: Record<string, { sum: number; count: number }> = {}
      for (const r of ratingsRes.data ?? []) {
        if (!ratingData[r.event_id]) ratingData[r.event_id] = { sum: 0, count: 0 }
        ratingData[r.event_id].sum += r.rating
        ratingData[r.event_id].count++
      }

      // Build highlights
      postEventHighlights = pastEvents.map((e) => {
        const g = groupMap[e.group_id]
        const eventEnd = new Date(e.ends_at)
        const milestoneCutoff = new Date(eventEnd.getTime() + 24 * 60 * 60 * 1000)

        // Match milestones to this event's group and time window
        const eventMilestones = (milestonesRes.data ?? [])
          .filter((m) => {
            return (
              m.group_id === e.group_id &&
              new Date(m.awarded_at) >= eventEnd &&
              new Date(m.awarded_at) <= milestoneCutoff
            )
          })
          .map((m) => {
            const badge = m.badges as unknown as { name: string; emoji: string } | null
            const profile = m.profiles as unknown as { full_name: string } | null
            return {
              memberName: profile?.full_name?.split(' ')[0] ?? 'Member',
              badgeName: badge?.name ?? 'Badge',
              badgeEmoji: badge?.emoji ?? '🏆',
            }
          })

        const rd = ratingData[e.id]
        const avgRating = rd ? Math.round((rd.sum / rd.count) * 10) / 10 : 0

        return {
          eventId: e.id,
          eventTitle: e.title,
          endsAt: e.ends_at,
          groupName: g?.name ?? 'Group',
          groupColour: hex(g?.primary_colour ?? '0D7377'),
          groupSlug: g?.slug ?? '',
          attendedCount: attendanceCounts[e.id] ?? 0,
          avgRating,
          photoCount: photoCounts[e.id] ?? 0,
          coverPhotoUrl: e.cover_url ?? coverUrls[e.id] ?? null,
          milestones: eventMilestones,
        }
      })
    }
  }

  const hasGroups = groups.length > 0

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <TopNav profile={profile} groupSlug={groups[0]?.slug ?? null} />

      <main>
        <PushPermissionBanner />
        {hasGroups ? (
          <HasGroupsContent
            profile={profile}
            groups={groups}
            memberCounts={memberCounts}
            upcomingEvents={upcomingEvents}
            postEventHighlights={postEventHighlights}
          />
        ) : (
          <EmptyState name={profile.full_name} />
        )}
      </main>

      {/* Mobile FAB — only shown in has-groups state */}
      {hasGroups && (
        <Link
          href="/groups/new"
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white lg:hidden transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#0D7377' }}
          aria-label="Create a new group"
        >
          <PlusIcon />
        </Link>
      )}
    </div>
  )
}
