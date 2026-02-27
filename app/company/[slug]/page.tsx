import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import CompanyDashboardClient from './company-dashboard-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyGroup {
  id: string
  name: string
  slug: string
  tagline: string | null
  category: string
  logoUrl: string | null
  primaryColour: string
  memberCount: number
  nextEventDate: string | null
  scopeType: string
  isMember: boolean
}

interface Colleague {
  id: string
  fullName: string
  avatarUrl: string | null
  workLocation: string | null
  department: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompanyDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  const svc = createServiceClient()

  // Fetch company by slug
  const { data: company } = await svc
    .from('companies')
    .select('id, name, slug, logo_url, primary_colour')
    .eq('slug', slug)
    .maybeSingle()

  if (!company) redirect('/home')

  // Fetch user profile and verify company membership
  const { data: profile } = await svc
    .from('profiles')
    .select('company_id, work_location, department')
    .eq('id', user.id)
    .single()

  if (!profile || profile.company_id !== company.id) redirect('/home')

  // Parallel fetches: scoped groups, colleagues, member count, user's group memberships
  const now = new Date().toISOString()

  const [scopeResult, colleagueResult, totalMembersResult, userMembershipsResult] =
    await Promise.all([
      // All group scopes for this company
      svc
        .from('group_scope')
        .select('group_id, scope_type, scope_location, scope_department')
        .eq('company_id', company.id),

      // Recent colleagues
      svc
        .from('profiles')
        .select('id, full_name, avatar_url, work_location, department')
        .eq('company_id', company.id)
        .neq('id', user.id)
        .order('created_at', { ascending: false })
        .limit(8),

      // Total members at this company
      svc
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id),

      // User's current group memberships
      svc
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'approved'),
    ])

  const scopeRows = scopeResult.data ?? []
  const userGroupIds = new Set(
    (userMembershipsResult.data ?? []).map((m) => m.group_id)
  )

  // Filter scopes to ones this user can see
  const visibleScopes = scopeRows.filter((s) => {
    switch (s.scope_type) {
      case 'public':
      case 'company':
        return true
      case 'location':
        return (
          profile.work_location &&
          s.scope_location &&
          profile.work_location.toLowerCase().trim() === s.scope_location.toLowerCase().trim()
        )
      case 'department':
        return (
          profile.department &&
          s.scope_department &&
          profile.department.toLowerCase().trim() === s.scope_department.toLowerCase().trim()
        )
      case 'loc_dept':
        return (
          profile.work_location &&
          profile.department &&
          s.scope_location &&
          s.scope_department &&
          profile.work_location.toLowerCase().trim() === s.scope_location.toLowerCase().trim() &&
          profile.department.toLowerCase().trim() === s.scope_department.toLowerCase().trim()
        )
      default:
        return false
    }
  })

  const visibleGroupIds = visibleScopes.map((s) => s.group_id)
  const scopeMap: Record<string, string> = {}
  for (const s of visibleScopes) {
    scopeMap[s.group_id] = s.scope_type
  }

  // Fetch group details + member counts + next events
  let companyGroups: CompanyGroup[] = []
  if (visibleGroupIds.length > 0) {
    const [groupsResult, memberCountsResult, eventsResult] = await Promise.all([
      svc
        .from('groups')
        .select('id, name, slug, tagline, category, logo_url, primary_colour')
        .in('id', visibleGroupIds),

      svc
        .from('group_members')
        .select('group_id')
        .in('group_id', visibleGroupIds)
        .eq('status', 'approved'),

      svc
        .from('events')
        .select('group_id, starts_at')
        .in('group_id', visibleGroupIds)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true }),
    ])

    const memberCounts: Record<string, number> = {}
    for (const r of memberCountsResult.data ?? []) {
      memberCounts[r.group_id] = (memberCounts[r.group_id] ?? 0) + 1
    }

    const nextEvents: Record<string, string> = {}
    for (const r of eventsResult.data ?? []) {
      if (!nextEvents[r.group_id]) {
        nextEvents[r.group_id] = r.starts_at
      }
    }

    companyGroups = (groupsResult.data ?? []).map((g) => {
      const colour = g.primary_colour?.startsWith('#')
        ? g.primary_colour
        : `#${g.primary_colour ?? '0D7377'}`
      return {
        id: g.id,
        name: g.name,
        slug: g.slug,
        tagline: g.tagline,
        category: g.category,
        logoUrl: g.logo_url,
        primaryColour: colour,
        memberCount: memberCounts[g.id] ?? 0,
        nextEventDate: nextEvents[g.id] ?? null,
        scopeType: scopeMap[g.id] ?? 'company',
        isMember: userGroupIds.has(g.id),
      }
    })
  }

  // Count total clubs
  const clubCount = companyGroups.length
  const totalMembers = totalMembersResult.count ?? 0

  // Build colleagues list
  const colleagues: Colleague[] = (colleagueResult.data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name ?? 'Member',
    avatarUrl: p.avatar_url,
    workLocation: p.work_location,
    department: p.department,
  }))

  // Fetch company domains for invite link
  const { data: domainRows } = await svc
    .from('company_domains')
    .select('domain')
    .eq('company_id', company.id)
    .limit(1)

  const primaryDomain = domainRows?.[0]?.domain ?? null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rovacrew.com'
  const inviteLink = `${appUrl}/auth?company=${company.slug}`

  return (
    <CompanyDashboardClient
      company={{
        id: company.id,
        name: company.name,
        slug: company.slug,
        logoUrl: company.logo_url,
        primaryColour: company.primary_colour?.startsWith('#')
          ? company.primary_colour
          : `#${company.primary_colour ?? '0D7377'}`,
      }}
      groups={companyGroups}
      colleagues={colleagues}
      totalMembers={totalMembers}
      clubCount={clubCount}
      inviteLink={inviteLink}
      primaryDomain={primaryDomain}
    />
  )
}
