import { Metadata } from 'next'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import DiscoveryClient from '../discovery-client'

// ─── SEO Metadata ────────────────────────────────────────────────────────────

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rovacrew.com'

export const metadata: Metadata = {
  title: 'Discover Communities | ROVA Crew',
  description:
    'Find and join activity groups near you. Running clubs, cycling groups, book clubs, social events and more — all beautifully organised on ROVA Crew.',
  openGraph: {
    title: 'Discover Communities | ROVA Crew',
    description:
      'Find and join activity groups near you. Running, cycling, social events and more.',
    url: `${appUrl}/discover`,
    siteName: 'ROVA Crew',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discover Communities | ROVA Crew',
    description:
      'Find and join activity groups near you. Running, cycling, social events and more.',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupRow {
  id: string
  name: string
  slug: string
  tagline: string | null
  category: string
  logo_url: string | null
  hero_url: string | null
  hero_focal_x: number | null
  hero_focal_y: number | null
  primary_colour: string
  location: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DiscoverPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const svc = createServiceClient()

  // Parallel fetches: public groups, global stats, trending, upcoming events for JSON-LD
  const now = new Date().toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [groupsResult, memberCountResult, eventCountResult, trendingResult, upcomingEventsResult] =
    await Promise.all([
      svc
        .from('groups')
        .select('id, name, slug, tagline, category, logo_url, hero_url, hero_focal_x, hero_focal_y, primary_colour, location')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(24),

      svc
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved'),

      svc
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte(
          'starts_at',
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        )
        .lt(
          'starts_at',
          new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
        ),

      // Trending: members joined in last 30 days, grouped by group_id
      svc
        .from('group_members')
        .select('group_id')
        .eq('status', 'approved')
        .gte('created_at', thirtyDaysAgo),

      // Upcoming public events for JSON-LD
      svc
        .from('events')
        .select('id, title, starts_at, ends_at, location, groups!inner ( is_public )')
        .gte('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(10),
    ])

  const groups: GroupRow[] = groupsResult.data ?? []
  const groupIds = groups.map((g) => g.id)

  const memberCounts: Record<string, number> = {}
  const nextEvents: Record<string, string> = {}

  if (groupIds.length > 0) {
    const [memberRows, eventRows] = await Promise.all([
      svc
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'approved'),
      svc
        .from('events')
        .select('group_id, starts_at')
        .in('group_id', groupIds)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true }),
    ])

    for (const r of memberRows.data ?? []) {
      memberCounts[r.group_id] = (memberCounts[r.group_id] ?? 0) + 1
    }

    for (const r of eventRows.data ?? []) {
      if (!nextEvents[r.group_id]) {
        nextEvents[r.group_id] = r.starts_at
      }
    }
  }

  // Build sorted groups
  const sortedGroups = groups
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      tagline: g.tagline,
      category: g.category,
      logoUrl: g.logo_url,
      heroUrl: g.hero_url,
      heroFocalX: g.hero_focal_x ?? 50,
      heroFocalY: g.hero_focal_y ?? 50,
      primaryColour: g.primary_colour.startsWith('#') ? g.primary_colour : `#${g.primary_colour}`,
      memberCount: memberCounts[g.id] ?? 0,
      nextEventDate: nextEvents[g.id] ?? null,
      location: g.location,
    }))
    .sort((a, b) => b.memberCount - a.memberCount)

  // Trending groups: count new members per group in last 30 days
  const trendingCounts: Record<string, number> = {}
  for (const r of trendingResult.data ?? []) {
    trendingCounts[r.group_id] = (trendingCounts[r.group_id] ?? 0) + 1
  }

  const trendingGroups = sortedGroups
    .filter((g) => (trendingCounts[g.id] ?? 0) >= 2)
    .sort((a, b) => (trendingCounts[b.id] ?? 0) - (trendingCounts[a.id] ?? 0))
    .slice(0, 8)

  // Recommended groups: for logged-in users, based on their group categories
  let recommendedGroups: typeof sortedGroups = []
  if (user) {
    const { data: userMemberships } = await svc
      .from('group_members')
      .select('group_id, groups ( category )')
      .eq('user_id', user.id)
      .eq('status', 'approved')

    const userGroupIds = new Set((userMemberships ?? []).map((m) => m.group_id))
    const userCategories = new Set(
      (userMemberships ?? [])
        .map((m) => (m.groups as unknown as { category: string })?.category)
        .filter(Boolean)
    )

    if (userCategories.size > 0) {
      recommendedGroups = sortedGroups
        .filter((g) => !userGroupIds.has(g.id) && userCategories.has(g.category))
        .slice(0, 6)
    }
  }

  const stats = {
    communities: groups.length,
    members: memberCountResult.count ?? 0,
    eventsThisMonth: eventCountResult.count ?? 0,
  }

  // ── JSON-LD ────────────────────────────────────────────────────────────────

  const upcomingEvents = (upcomingEventsResult.data ?? []).filter(
    (e) => (e.groups as unknown as { is_public: boolean })?.is_public
  )

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'ROVA Crew',
        url: appUrl,
        description: 'Community management platform for activity groups, events, and social clubs.',
      },
      {
        '@type': 'ItemList',
        name: 'Communities on ROVA Crew',
        numberOfItems: sortedGroups.length,
        itemListElement: sortedGroups.slice(0, 10).map((g, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Organization',
            name: g.name,
            url: `${appUrl}/g/${g.slug}`,
            description: g.tagline ?? undefined,
          },
        })),
      },
      ...upcomingEvents.slice(0, 5).map((e) => ({
        '@type': 'Event',
        name: e.title,
        startDate: e.starts_at,
        endDate: e.ends_at ?? undefined,
        location: e.location
          ? { '@type': 'Place', name: e.location }
          : undefined,
        url: `${appUrl}/events/${e.id}`,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        organizer: {
          '@type': 'Organization',
          name: 'ROVA Crew',
          url: appUrl,
        },
      })),
    ],
  }

  // Build upcoming events for display
  const upcomingEventsList = upcomingEvents.slice(0, 6).map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.starts_at,
    location: e.location,
  }))

  return (
    <DiscoveryClient
      groups={sortedGroups}
      trendingGroups={trendingGroups}
      recommendedGroups={recommendedGroups}
      stats={stats}
      isLoggedIn={!!user}
      jsonLd={JSON.stringify(jsonLd)}
      upcomingEvents={upcomingEventsList}
    />
  )
}
