import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')?.trim() ?? ''
  const category = searchParams.get('category')?.trim() ?? ''
  const sort = searchParams.get('sort')?.trim() ?? 'relevance'

  const svc = createServiceClient()

  // Build query
  let query = svc
    .from('groups')
    .select('id, name, slug, tagline, category, logo_url, hero_url, primary_colour, location')
    .eq('is_public', true)

  // Full-text search if query provided
  if (q) {
    query = query.textSearch('search_vector', q, { type: 'plain', config: 'english' })
  }

  // Category filter
  if (category) {
    query = query.eq('category', category)
  }

  // Sort
  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data: groups, error } = await query.limit(24)

  if (error) {
    console.error('[discover/search] error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  // Fetch member counts
  const groupIds = (groups ?? []).map((g) => g.id)
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

  const results = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    tagline: g.tagline,
    category: g.category,
    logoUrl: g.logo_url,
    heroUrl: g.hero_url,
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
