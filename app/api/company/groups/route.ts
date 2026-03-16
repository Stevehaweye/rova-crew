import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('company_id')
  if (!companyId) {
    return NextResponse.json({ groups: [] })
  }

  const svc = createServiceClient()

  // Fetch group IDs scoped to this company (all scope types except invitation)
  const { data: scopeRows } = await svc
    .from('group_scope')
    .select('group_id')
    .eq('company_id', companyId)
    .neq('scope_type', 'invitation')

  if (!scopeRows || scopeRows.length === 0) {
    return NextResponse.json({ groups: [] })
  }

  const groupIds = scopeRows.map((r) => r.group_id)

  // Fetch group details
  const { data: groups } = await svc
    .from('groups')
    .select('id, name, slug, tagline, category, primary_colour, logo_url')
    .in('id', groupIds)

  if (!groups || groups.length === 0) {
    return NextResponse.json({ groups: [] })
  }

  // Fetch member counts
  const { data: memberRows } = await svc
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('status', 'approved')

  const counts: Record<string, number> = {}
  for (const r of memberRows ?? []) {
    counts[r.group_id] = (counts[r.group_id] ?? 0) + 1
  }

  const result = groups
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      tagline: g.tagline,
      category: g.category,
      primaryColour: g.primary_colour,
      logoUrl: g.logo_url,
      memberCount: counts[g.id] ?? 0,
    }))
    .sort((a, b) => b.memberCount - a.memberCount)

  return NextResponse.json({ groups: result })
}
