import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getHallOfFameRecords, type HallOfFameRecord } from '@/lib/hall-of-fame'
import { JoinCard } from './join-button'
import ContactOrganiserButton from '@/components/ContactOrganiserButton'
import MessageMemberButton from '@/components/MessageMemberButton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Group {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  category: string
  logo_url: string | null
  hero_url: string | null
  hero_focal_x: number | null
  hero_focal_y: number | null
  primary_colour: string
  is_public: boolean
  join_approval_required: boolean
  created_at: string
}

interface MemberProfile {
  full_name: string
  avatar_url: string | null
}

interface MemberStats {
  tier: string
  crew_score: number
}

interface UpcomingEventData {
  id: string
  title: string
  startsAt: string
  location: string | null
  rsvpCount: number
}

interface Member {
  userId: string
  role: string
  joinedAt: string
  profile: MemberProfile
  stats: MemberStats | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hex(c: string) {
  return c.startsWith('#') ? c : `#${c}`
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function firstInitial(name: string) {
  return (name[0] ?? '?').toUpperCase()
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  newcomer:  { bg: '#F3F4F6', text: '#6B7280', label: 'Newcomer',  emoji: '🌱' },
  regular:   { bg: '#DBEAFE', text: '#1D4ED8', label: 'Regular',   emoji: '⭐' },
  dedicated: { bg: '#D1FAE5', text: '#065F46', label: 'Dedicated', emoji: '💪' },
  veteran:   { bg: '#EDE9FE', text: '#5B21B6', label: 'Veteran',   emoji: '🏆' },
  legend:    { bg: '#FEF3C7', text: '#92400E', label: 'Legend',    emoji: '👑' },
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UsersIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function CalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
    </svg>
  )
}

// ─── Not found ────────────────────────────────────────────────────────────────

function NotFoundView() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-7xl mb-6 select-none">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Group not found</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          This group doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: '#0D7377' }}
        >
          Discover other groups &rarr;
        </Link>
      </div>
    </div>
  )
}

// ─── Private group ────────────────────────────────────────────────────────────

function PrivateGroupView({ group, colour }: { group: Group; colour: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-6 shadow-lg"
          style={{ backgroundColor: colour }}
        >
          {firstInitial(group.name)}
        </div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
          style={{ backgroundColor: colour + '18', color: colour }}
        >
          🔒 Private group
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{group.name}</h1>
        {group.tagline && (
          <p className="text-gray-500 mb-6">{group.tagline}</p>
        )}
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          This is a private group. You need to be invited or approved by an admin to view its content.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: colour }}
        >
          Discover other groups &rarr;
        </Link>
      </div>
    </div>
  )
}

// ─── Hero section ─────────────────────────────────────────────────────────────

function Hero({ group, colour }: { group: Group; colour: string }) {
  const focalX = group.hero_focal_x ?? 50
  const focalY = group.hero_focal_y ?? 50

  return (
    <section className="relative h-72 sm:h-[400px] overflow-hidden">

      {/* Background */}
      {group.hero_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={group.hero_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `${focalX}% ${focalY}%` }}
            fetchPriority="high"
            width={1200}
            height={600}
          />
          {/* Dark gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
        </>
      ) : (
        <>
          {/* Gradient colour background with dot texture */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: colour }}
          />
          {/* Dot grid pattern */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          {/* Diagonal light gradient */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.28) 100%)',
            }}
          />
          {/* Bottom fade for text */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </>
      )}

      {/* Nav bar — minimal, transparent */}
      <div className="absolute top-0 left-0 right-0 z-10 px-5 sm:px-10 pt-5 flex items-center justify-between">
        <Link href="/home" className="select-none">
          <span className="text-base font-black tracking-[0.14em] text-white/90 drop-shadow">
            ROVA
          </span>
          <span className="text-base font-black tracking-[0.14em] drop-shadow" style={{ color: '#C9982A' }}>
            CREW
          </span>
        </Link>
      </div>

      {/* Hero content — bottom-left */}
      <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-10 pb-8 max-w-5xl">
        {/* Logo */}
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ring-4 ring-white/20 shadow-2xl mb-4 flex items-center justify-center text-white font-black text-2xl sm:text-3xl overflow-hidden flex-shrink-0"
          style={{ backgroundColor: colour + 'cc', backdropFilter: 'blur(4px)' }}
        >
          {group.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.logo_url} alt={group.name} className="w-full h-full object-cover" />
          ) : (
            <span>{firstInitial(group.name)}</span>
          )}
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-lg">
          {group.name}
        </h1>
        {group.tagline && (
          <p className="text-white/75 text-base sm:text-lg font-light mt-2 drop-shadow max-w-2xl">
            {group.tagline}
          </p>
        )}
      </div>
    </section>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({
  group,
  colour,
  memberCount,
  nextEventDate,
}: {
  group: Group
  colour: string
  memberCount: number
  nextEventDate: string | null
}) {
  const nextLabel = nextEventDate
    ? format(new Date(nextEventDate), 'EEE d MMM')
    : 'Coming soon'

  return (
    <div className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-5 sm:px-10 py-3.5 flex items-center gap-5 sm:gap-8 flex-wrap">
        <div className="flex items-center gap-1.5 text-gray-700 text-sm font-medium">
          <UsersIcon className="w-4 h-4 text-gray-400" />
          <span>
            <strong className="text-gray-900">{memberCount}</strong> member{memberCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-700 text-sm font-medium">
          <CalendarIcon className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">Next event: <strong className="text-gray-700">{nextLabel}</strong></span>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: colour + '18', color: colour }}
        >
          {group.category}
        </span>
        {group.is_public ? (
          <span className="text-xs text-gray-400 font-medium">🌍 Public</span>
        ) : (
          <span className="text-xs text-gray-400 font-medium">🔒 Private</span>
        )}
      </div>
    </div>
  )
}

// ─── About ────────────────────────────────────────────────────────────────────

function About({ description }: { description: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 mb-3">About</h2>
      <p className="text-gray-600 leading-relaxed text-sm">{description}</p>
    </div>
  )
}

// ─── Upcoming Events ─────────────────────────────────────────────────────────

function UpcomingEvents({
  events,
  groupSlug,
  colour,
  isAdmin,
}: {
  events: UpcomingEventData[]
  groupSlug: string
  colour: string
  isAdmin: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-gray-900">Upcoming Events</h2>
        {events.length > 0 && isAdmin && (
          <Link
            href={`/g/${groupSlug}/admin/events`}
            className="text-xs font-semibold transition-opacity hover:opacity-75"
            style={{ color: colour }}
          >
            Manage events &rarr;
          </Link>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-2xl mb-2 select-none">📅</p>
          <p className="text-sm font-medium text-gray-500">No upcoming events</p>
          <p className="text-xs text-gray-400 mt-1">Check back soon for new events.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const start = new Date(ev.startsAt)
            const monthStr = format(start, 'MMM')
            const dayStr = start.getDate().toString()
            const dateTimeStr = format(start, "EEE d MMM · h:mm a")

            return (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors group"
              >
                {/* Date block */}
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white"
                  style={{ backgroundColor: colour }}
                >
                  <span className="text-[10px] font-bold uppercase leading-none">
                    {monthStr}
                  </span>
                  <span className="text-lg font-black leading-none">
                    {dayStr}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate group-hover:underline">{ev.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {dateTimeStr}
                    {ev.location && <> · {ev.location}</>}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{ev.rsvpCount} going</p>
                </div>

                <span
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-colors"
                  style={{ borderColor: colour, color: colour }}
                >
                  View
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Member Wall ──────────────────────────────────────────────────────────────

function MemberWall({
  members,
  groupSlug,
  totalCount,
  colour,
  currentUserId,
}: {
  members: Member[]
  groupSlug: string
  totalCount: number
  colour: string
  currentUserId: string | null
}) {
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center py-12">
        <p className="text-gray-500 text-sm font-medium">No members yet</p>
        <p className="text-gray-400 text-xs mt-1">Be the first to join!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-gray-900">
          Member Wall
          <span className="ml-2 text-sm font-normal text-gray-400">({totalCount})</span>
        </h2>
        {totalCount > 12 && (
          <Link
            href={`/g/${groupSlug}/members`}
            className="text-xs font-semibold transition-opacity hover:opacity-75"
            style={{ color: colour }}
          >
            View all members &rarr;
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        {members.map((m) => {
          const tier = TIER[m.stats?.tier ?? 'newcomer'] ?? TIER.newcomer
          const name = m.profile?.full_name ?? 'Member'

          return (
            <div key={m.userId} className="flex flex-col items-center text-center">
              {/* Avatar */}
              {m.profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.profile.avatar_url}
                  alt={name}
                  className="w-14 h-14 rounded-full object-cover mb-2 ring-2 ring-white shadow-sm"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-base mb-2 ring-2 ring-white shadow-sm"
                  style={{ backgroundColor: colour }}
                >
                  {initials(name)}
                </div>
              )}

              <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2 w-full">
                {name.split(' ')[0]}
              </p>

              <span
                className="mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ backgroundColor: tier.bg, color: tier.text }}
              >
                {tier.emoji} {tier.label}
              </span>

              {/* Message button (not on own card) */}
              {currentUserId && currentUserId !== m.userId && (
                <MessageMemberButton otherUserId={m.userId} colour={colour} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Hall of Fame ────────────────────────────────────────────────────────────

function HallOfFame({ records, colour, slug }: { records: HallOfFameRecord[]; colour: string; slug: string }) {
  const populated = records.filter((r) => r.holderId !== null)
  const preview = populated.slice(0, 3)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrophyIcon />
        <h3 className="text-sm font-bold text-gray-900">Hall of Fame</h3>
      </div>

      {preview.length > 0 ? (
        <div className="space-y-3">
          {preview.map((r) => (
            <div key={r.slug} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className="text-xl">{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700">{r.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{r.holderName}</p>
              </div>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: colour + '15', color: colour }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-2">
          Records appear as members attend events
        </p>
      )}

      <Link
        href={`/g/${slug}/hall-of-fame`}
        className="block text-center text-xs font-semibold mt-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        style={{ color: colour }}
      >
        View all &rarr;
      </Link>
    </div>
  )
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const svc = createServiceClient()
  const { data: group } = await svc
    .from('groups')
    .select('name, tagline, description, logo_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) return { title: 'Group | ROVA Crew' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rovacrew.com'
  return {
    title: `${group.name} | ROVA Crew`,
    description: group.tagline ?? group.description ?? `Join ${group.name} on ROVA Crew`,
    openGraph: {
      title: group.name,
      description: group.tagline ?? group.description ?? `Join ${group.name} on ROVA Crew`,
      url: `${appUrl}/g/${slug}`,
      images: group.logo_url ? [{ url: group.logo_url }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: group.name,
      description: group.tagline ?? group.description ?? undefined,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ invite?: string }>
}) {
  const { slug } = await params
  const { invite: inviteToken } = await searchParams
  const supabase = await createClient()

  // Fetch group
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) return <NotFoundView />

  // Get current user (may not be authenticated)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check existing membership
  let membership: { role: string; status: string } | null = null
  if (user) {
    const { data } = await supabase
      .from('group_members')
      .select('role, status')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()
    membership = data
  }

  const isApprovedMember = membership?.status === 'approved'
  const isAdmin = isApprovedMember &&
    (membership?.role === 'super_admin' || membership?.role === 'co_admin')

  // Private group guard
  if (!group.is_public && !isApprovedMember) {
    return <PrivateGroupView group={group} colour={hex(group.primary_colour)} />
  }

  // Parallel fetch: member count + member profiles (up to 12) + upcoming events + organiser
  const now = new Date().toISOString()
  const [countResult, membersResult, upcomingEventsResult, organiserResult] = await Promise.all([
    supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .eq('status', 'approved'),
    supabase
      .from('group_members')
      .select('user_id, role, joined_at, profiles ( full_name, avatar_url )')
      .eq('group_id', group.id)
      .eq('status', 'approved')
      .order('joined_at', { ascending: true })
      .limit(12),
    supabase
      .from('events')
      .select('id, title, starts_at, location')
      .eq('group_id', group.id)
      .gte('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(3),
    supabase
      .from('group_members')
      .select('profiles ( full_name, avatar_url )')
      .eq('group_id', group.id)
      .eq('role', 'super_admin')
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle(),
  ])

  const memberCount = countResult.count ?? 0
  const membersRaw = membersResult.data ?? []

  // Fetch member_stats separately (no direct FK between group_members and member_stats)
  const userIds = membersRaw.map((m) => m.user_id)
  const { data: statsRows } = userIds.length > 0
    ? await supabase
        .from('member_stats')
        .select('user_id, tier, crew_score')
        .eq('group_id', group.id)
        .in('user_id', userIds)
    : { data: [] as { user_id: string; tier: string; crew_score: number }[] }

  const statsMap = Object.fromEntries(
    (statsRows ?? []).map((s) => [s.user_id, s])
  )

  const members: Member[] = membersRaw.map((m) => ({
    userId: m.user_id,
    role: m.role,
    joinedAt: m.joined_at,
    profile: m.profiles as unknown as MemberProfile,
    stats: statsMap[m.user_id] ?? null,
  }))

  // Build upcoming events with RSVP counts
  const rawEvents = upcomingEventsResult.data ?? []
  const eventRsvpCounts: Record<string, number> = {}
  if (rawEvents.length > 0) {
    const eventIds = rawEvents.map((e) => e.id)
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
        .in('status', ['going', 'maybe']),
    ])
    for (const r of memberRsvps.data ?? []) {
      eventRsvpCounts[r.event_id] = (eventRsvpCounts[r.event_id] ?? 0) + 1
    }
    for (const r of guestRsvps.data ?? []) {
      eventRsvpCounts[r.event_id] = (eventRsvpCounts[r.event_id] ?? 0) + 1
    }
  }

  const upcomingEvents: UpcomingEventData[] = rawEvents.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.starts_at,
    location: e.location,
    rsvpCount: eventRsvpCounts[e.id] ?? 0,
  }))

  const nextEventDate = upcomingEvents.length > 0 ? upcomingEvents[0].startsAt : null

  const organiserProfile = organiserResult.data?.profiles as unknown as { full_name: string; avatar_url: string | null } | null

  // Fetch current user's profile for contact form auto-fill
  let currentUserProfile: { name: string; email: string } | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()
    if (profile) {
      currentUserProfile = { name: profile.full_name ?? '', email: profile.email ?? user.email ?? '' }
    }
  }

  // Fetch hall of fame records
  const hallOfFameRecords = isApprovedMember
    ? await getHallOfFameRecords(group.id)
    : []

  const colour = hex(group.primary_colour)
  const initialStatus = membership?.status as 'approved' | 'pending' | null ?? null

  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: group.name,
    description: group.description ?? group.tagline ?? undefined,
    url: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://rovacrew.com'}/g/${group.slug}`,
    logo: group.logo_url ?? undefined,
    location: undefined as { '@type': string; name: string } | undefined,
    member: {
      '@type': 'QuantitativeValue',
      value: memberCount,
    },
    event: upcomingEvents.map((e) => ({
      '@type': 'Event',
      name: e.title,
      startDate: e.startsAt,
      location: e.location ? { '@type': 'Place', name: e.location } : undefined,
      url: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://rovacrew.com'}/events/${e.id}`,
    })),
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <Hero group={group} colour={colour} />

      {/* Stats bar */}
      <StatsBar group={group} colour={colour} memberCount={memberCount} nextEventDate={nextEventDate} />

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="space-y-8 min-w-0">
            {group.description && <About description={group.description} />}
            <UpcomingEvents events={upcomingEvents} groupSlug={group.slug} colour={colour} isAdmin={isAdmin} />
            <MemberWall
              members={members}
              groupSlug={group.slug}
              totalCount={memberCount}
              colour={colour}
              currentUserId={user?.id ?? null}
            />
          </div>

          {/* ── Right column (sticky sidebar) ────────────────────────── */}
          <div className="space-y-5 lg:sticky lg:top-8">
            <JoinCard
              groupId={group.id}
              groupSlug={group.slug}
              groupName={group.name}
              groupColour={colour}
              requireApproval={group.join_approval_required}
              memberCount={memberCount}
              initialStatus={initialStatus}
              isLoggedIn={!!user}
              membershipFeeEnabled={group.membership_fee_enabled ?? false}
              membershipFeePence={group.membership_fee_pence ?? null}
              inviteToken={inviteToken ?? null}
            />
            {/* Admin Panel — only for admins */}
            {isAdmin && (
              <Link
                href={`/g/${group.slug}/admin`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all"
                style={{ borderLeft: `4px solid ${colour}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: colour + '15' }}
                  >
                    ⚙️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">Admin Panel</p>
                    <p className="text-xs text-gray-400 mt-0.5">Manage events, members &amp; settings</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )}

            {/* Group Chat — only for approved members */}
            {initialStatus === 'approved' && (
              <Link
                href={`/g/${group.slug}/chat`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: colour + '15' }}
                  >
                    💬
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">Group Chat</p>
                    <p className="text-xs text-gray-400 mt-0.5">Join the conversation</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )}

            {/* Monthly Board — only for approved members */}
            {initialStatus === 'approved' && (
              <Link
                href={`/g/${group.slug}/board`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: colour + '15' }}
                  >
                    📊
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">Board</p>
                      {new Date().getDate() <= 3 && (
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Monthly attendance rankings</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )}

            {/* My Stats — only for approved members */}
            {initialStatus === 'approved' && (
              <Link
                href={`/g/${group.slug}/my-stats`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: colour + '15' }}
                  >
                    📈
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">My Stats</p>
                    <p className="text-xs text-gray-400 mt-0.5">Your personal progress</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )}

            {/* Organised by */}
            {organiserProfile && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Organised by</h3>
                <div className="flex items-center gap-3">
                  {organiserProfile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={organiserProfile.avatar_url}
                      alt={organiserProfile.full_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: colour }}
                    >
                      {initials(organiserProfile.full_name)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{organiserProfile.full_name}</p>
                    <p className="text-xs text-gray-400">Group admin</p>
                  </div>
                </div>
                <div className="mt-4">
                  <ContactOrganiserButton
                    groupId={group.id}
                    groupName={group.name}
                    colour={colour}
                    currentUser={currentUserProfile}
                  />
                </div>
              </div>
            )}

            {initialStatus === 'approved' && (
              <HallOfFame records={hallOfFameRecords} colour={colour} slug={group.slug} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
