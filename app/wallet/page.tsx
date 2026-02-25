import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getMemberTier } from '@/lib/tier-themes'
import CrewCardClient from './crew-card-client'
import Link from 'next/link'

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function WalletPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth?next=/wallet')

  const now = new Date().toISOString()
  const svc = createServiceClient()

  const [profileResult, membershipsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single(),

    supabase
      .from('group_members')
      .select('group_id, role, joined_at, groups ( id, name, slug, logo_url, primary_colour, tier_theme, custom_tier_names )')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .order('joined_at', { ascending: true }),
  ])

  const profile = profileResult.data ?? {
    full_name: user.email?.split('@')[0] ?? 'Member',
    avatar_url: null,
  }

  const memberships = membershipsResult.data ?? []

  if (memberships.length === 0) {
    redirect('/home')
  }

  // Fetch gamification data for all groups in parallel
  const groupIds = memberships.map((m) => m.group_id)

  const [statsResult, badgesResult, upcomingRsvpsResult] = await Promise.all([
    // Member stats across all groups
    svc
      .from('member_stats')
      .select('group_id, crew_score, tier')
      .eq('user_id', user.id)
      .in('group_id', groupIds),

    // Most recent badge award per group
    svc
      .from('badge_awards')
      .select('group_id, awarded_at, badges ( emoji, name )')
      .eq('user_id', user.id)
      .in('group_id', groupIds)
      .order('awarded_at', { ascending: false }),

    // Upcoming RSVPs
    supabase
      .from('rsvps')
      .select('event_id, status, events ( id, title, starts_at, ends_at, location, cover_url, group_id, groups ( name, primary_colour ) )')
      .eq('user_id', user.id)
      .eq('status', 'going')
      .order('created_at', { ascending: false }),
  ])

  // Build stats map: group_id -> { crew_score }
  const statsMap = new Map<string, { crew_score: number }>()
  for (const row of statsResult.data ?? []) {
    statsMap.set(row.group_id, { crew_score: row.crew_score ?? 0 })
  }

  // Build recent badge map: group_id -> { emoji, name } (first match = most recent)
  const badgeMap = new Map<string, { emoji: string; name: string }>()
  for (const row of badgesResult.data ?? []) {
    if (!badgeMap.has(row.group_id)) {
      const badge = row.badges as unknown as { emoji: string; name: string } | null
      if (badge) {
        badgeMap.set(row.group_id, { emoji: badge.emoji, name: badge.name })
      }
    }
  }

  // Build per-group card data
  const groups = memberships.map((m) => {
    const g = m.groups as unknown as {
      id: string
      name: string
      slug: string
      logo_url: string | null
      primary_colour: string
      tier_theme: string | null
      custom_tier_names: string[] | null
    }

    const colour = g.primary_colour?.startsWith('#')
      ? g.primary_colour
      : `#${g.primary_colour ?? '0D7377'}`

    const stats = statsMap.get(g.id)
    const crewScore = stats?.crew_score ?? 0
    const tierInfo = getMemberTier(crewScore, g.tier_theme ?? undefined, g.custom_tier_names)
    const recentBadge = badgeMap.get(g.id) ?? null

    const memberSince = m.joined_at
      ? new Date(m.joined_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      : null

    return {
      id: g.id,
      name: g.name,
      slug: g.slug,
      logoUrl: g.logo_url,
      colour,
      tierLevel: tierInfo.level as 1 | 2 | 3 | 4 | 5,
      tierName: tierInfo.tier,
      tierTheme: g.tier_theme ?? 'generic',
      customTierNames: g.custom_tier_names ?? null,
      crewScore,
      recentBadge,
      memberSince,
    }
  })

  // Filter upcoming events
  const upcomingEvents = (upcomingRsvpsResult.data ?? [])
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
          groups={groups}
          appUrl={appUrl}
          upcomingEvents={upcomingEvents.map((ev) => {
            const evColour = ev.groups?.primary_colour
              ? ev.groups.primary_colour.startsWith('#')
                ? ev.groups.primary_colour
                : `#${ev.groups.primary_colour}`
              : groups[0].colour
            return {
              id: ev.id,
              title: ev.title,
              startsAt: ev.starts_at,
              location: ev.location,
              groupName: ev.groups?.name ?? groups[0].name,
              groupColour: evColour,
            }
          })}
        />
      </main>
    </div>
  )
}
