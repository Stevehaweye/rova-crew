import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CrewCardClient from './crew-card-client'
import Link from 'next/link'

// ─── Tier Logic ──────────────────────────────────────────────────────────────

function getTier(goingCount: number): { label: string; colour: string } {
  if (goingCount >= 10) return { label: 'Dedicated', colour: '#C9982A' }
  if (goingCount >= 3) return { label: 'Regular', colour: '#0D7377' }
  return { label: 'New Member', colour: '#6B7280' }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function WalletPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth?next=/wallet')

  // Parallel fetches
  const now = new Date().toISOString()

  const [profileResult, membershipsResult, rsvpCountResult] = await Promise.all([
    // Profile
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single(),

    // Group memberships with group data
    supabase
      .from('group_members')
      .select('group_id, role, joined_at, groups ( id, name, slug, logo_url, primary_colour )')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .order('joined_at', { ascending: true }),

    // Total "going" RSVPs (for tier)
    supabase
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'going'),
  ])

  const profile = profileResult.data ?? {
    full_name: user.email?.split('@')[0] ?? 'Member',
    avatar_url: null,
  }

  const memberships = membershipsResult.data ?? []
  const primaryGroup = memberships[0]?.groups as unknown as {
    id: string
    name: string
    slug: string
    logo_url: string | null
    primary_colour: string
  } | null

  if (!primaryGroup) {
    // No group memberships — redirect to home
    redirect('/home')
  }

  const goingCount = rsvpCountResult.count ?? 0
  const tier = getTier(goingCount)
  const memberSince = memberships[0]?.joined_at
    ? new Date(memberships[0].joined_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null

  // Fetch upcoming events user has RSVP'd "going" to
  const { data: upcomingRsvps } = await supabase
    .from('rsvps')
    .select('event_id, status, events ( id, title, starts_at, ends_at, location, cover_url, group_id, groups ( name, primary_colour ) )')
    .eq('user_id', user.id)
    .eq('status', 'going')
    .order('created_at', { ascending: false })

  // Filter to future events and sort by date
  const upcomingEvents = (upcomingRsvps ?? [])
    .map((r) => {
      const ev = r.events as unknown as {
        id: string
        title: string
        starts_at: string
        ends_at: string
        location: string | null
        cover_url: string | null
        group_id: string
        groups: { name: string; primary_colour: string }
      }
      return ev
    })
    .filter((ev) => ev && new Date(ev.starts_at) > new Date(now))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 5)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const colour = primaryGroup.primary_colour.startsWith('#')
    ? primaryGroup.primary_colour
    : `#${primaryGroup.primary_colour}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/home"
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
          <span className="text-gray-300 text-lg">&middot;</span>
          <span className="text-sm font-semibold text-gray-600">My Card</span>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        <CrewCardClient
          userId={user.id}
          fullName={profile.full_name}
          avatarUrl={profile.avatar_url}
          groupName={primaryGroup.name}
          groupSlug={primaryGroup.slug}
          groupLogoUrl={primaryGroup.logo_url}
          colour={colour}
          tier={tier}
          memberSince={memberSince}
          appUrl={appUrl}
          upcomingEvents={upcomingEvents.map((ev) => ({
            id: ev.id,
            title: ev.title,
            startsAt: ev.starts_at,
            location: ev.location,
            groupName: ev.groups?.name ?? primaryGroup.name,
            groupColour: ev.groups?.primary_colour
              ? ev.groups.primary_colour.startsWith('#')
                ? ev.groups.primary_colour
                : `#${ev.groups.primary_colour}`
              : colour,
          }))}
        />
      </main>
    </div>
  )
}
