import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getVisibleGroupIds } from '@/lib/discovery'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')?.trim() ?? ''
  const category = searchParams.get('category')?.trim() ?? ''
  const sort = searchParams.get('sort')?.trim() ?? 'relevance'

  const svc = createServiceClient()

  // ── Determine which groups the user can see ───────────────────────────────
  // Public groups are always visible. Enterprise-scoped groups are only visible
  // to authenticated users whose profile matches the scope.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let scopedGroupIds: string[] | null = null

  if (user) {
    const { data: profile } = await svc
      .from('profiles')
      .select('id, company_id, work_location, department')
      .eq('id', user.id)
      .single()

    if (profile?.company_id) {
      scopedGroupIds = await getVisibleGroupIds({
        id: profile.id,
        company_id: profile.company_id,
        work_location: profile.work_location,
        department: profile.department,
      })
    }
  }

  // ── Fetch public groups ──────────────────────────────────────────────────
  let query = svc
    .from('groups')
    .select('id, name, slug, tagline, category, logo_url, hero_url, hero_focal_x, hero_focal_y, primary_colour, location')
    .eq('is_public', true)

  if (q) {
    query = query.textSearch('search_vector', q, { type: 'plain', config: 'english' })
  }

  if (category) {
    query = query.eq('category', category)
  }

  query = query.order('created_at', { ascending: false })

  const { data: publicGroups } = await query.limit(24)

  // ── Fetch enterprise-scoped groups the user can see ───────────────────────
  let enterpriseGroups: typeof publicGroups = []

  if (scopedGroupIds && scopedGroupIds.length > 0) {
    let entQuery = svc
      .from('groups')
      .select('id, name, slug, tagline, category, logo_url, hero_url, hero_focal_x, hero_focal_y, primary_colour, location')
      .in('id', scopedGroupIds)

    if (q) {
      entQuery = entQuery.textSearch('search_vector', q, { type: 'plain', config: 'english' })
    }

    if (category) {
      entQuery = entQuery.eq('category', category)
    }

    const { data } = await entQuery.limit(24)
    enterpriseGroups = data ?? []
  }

  // ── Merge and deduplicate ────────────────────────────────────────────────
  const seen = new Set<string>()
  const allGroups = []

  for (const g of [...(publicGroups ?? []), ...enterpriseGroups]) {
    if (!seen.has(g.id)) {
      seen.add(g.id)
      allGroups.push(g)
    }
  }

  // Fetch member counts
  const groupIds = allGroups.map((g) => g.id)
  const memberCounts: Record<string, number> = {}

  if (groupIds.length > 0) {
    const { data: memberRows } = await svc
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('status', 'approved')

    for (const r of memberRows ?? []) {
      memberCounts[r.group_id] = (memberCounts[r.group_id] ?? 0) + 1
    }
  }

  const results = allGroups.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    tagline: g.tagline,
    category: g.category,
    logoUrl: g.logo_url,
    heroUrl: g.hero_url,
    heroFocalX: g.hero_focal_x ?? 50,
    heroFocalY: g.hero_focal_y ?? 50,
    primaryColour: g.primary_colour?.startsWith('#') ? g.primary_colour : `#${g.primary_colour}`,
    memberCount: memberCounts[g.id] ?? 0,
    location: g.location,
  }))

  // Sort by member count if requested
  if (sort === 'most_members') {
    results.sort((a, b) => b.memberCount - a.memberCount)
  }

  return NextResponse.json({ groups: results })
}
