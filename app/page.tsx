import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DiscoveryClient from './discovery-client'

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

export default async function RootPage() {
  const supabase = await createClient()

  // If logged in, redirect to dashboard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/home')

  // Parallel fetches: public groups, global stats
  const now = new Date().toISOString()
  const [groupsResult, memberCountResult, eventCountResult] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, slug, tagline, category, logo_url, hero_url, hero_focal_x, hero_focal_y, primary_colour, location')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(24),

    // Total approved members across all groups
    supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved'),

    // Events this month
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('starts_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .lt('starts_at', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()),
  ])

  const groups: GroupRow[] = groupsResult.data ?? []
  const groupIds = groups.map((g) => g.id)

  // Fetch member counts + next event date for each group
  const memberCounts: Record<string, number> = {}
  const nextEvents: Record<string, string> = {}

  if (groupIds.length > 0) {
    const [memberRows, eventRows] = await Promise.all([
      supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'approved'),
      supabase
        .from('events')
        .select('group_id, starts_at')
        .in('group_id', groupIds)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true }),
    ])

    for (const r of memberRows.data ?? []) {
      memberCounts[r.group_id] = (memberCounts[r.group_id] ?? 0) + 1
    }

    // Take the first (earliest) event per group
    for (const r of eventRows.data ?? []) {
      if (!nextEvents[r.group_id]) {
        nextEvents[r.group_id] = r.starts_at
      }
    }
  }

  // Sort groups by member count descending
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

  const stats = {
    communities: groups.length,
    members: memberCountResult.count ?? 0,
    eventsThisMonth: eventCountResult.count ?? 0,
  }

  return <DiscoveryClient groups={sortedGroups} stats={stats} companyGroups={[]} companyName={null} />
}
