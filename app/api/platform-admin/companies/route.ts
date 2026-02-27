import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Slug helper ──────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

// ─── POST: Create a new company ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin()
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Unauthorized' },
      { status: e.status ?? 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const name = body?.name?.trim() as string | undefined
  const domains = body?.domains as string[] | undefined
  const logoUrl = (body?.logo_url as string) || null
  const primaryColour = (body?.primary_colour as string) || '0D9488'

  if (!name) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  }
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return NextResponse.json(
      { error: 'At least one email domain is required' },
      { status: 400 }
    )
  }

  // Validate domain formats
  const cleanDomains = domains.map((d) => d.toLowerCase().trim())
  for (const d of cleanDomains) {
    if (!d.includes('.') || d.includes('@') || d.includes(' ')) {
      return NextResponse.json(
        { error: `Invalid domain format: ${d}` },
        { status: 400 }
      )
    }
  }

  const svc = createServiceClient()

  // Check for domain conflicts
  const { data: existing } = await svc
    .from('company_domains')
    .select('domain')
    .in('domain', cleanDomains)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      {
        error: 'Domain already registered',
        conflicts: existing.map((r) => r.domain),
      },
      { status: 409 }
    )
  }

  // Generate unique slug
  let slug = toSlug(name)
  let suffix = 1
  while (true) {
    const candidate = suffix === 1 ? slug : `${slug}-${suffix}`
    const { data: clash } = await svc
      .from('companies')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!clash) {
      slug = candidate
      break
    }
    suffix++
  }

  // Insert company
  const { data: company, error: companyErr } = await svc
    .from('companies')
    .insert({
      name,
      slug,
      logo_url: logoUrl,
      primary_colour: primaryColour,
    })
    .select()
    .single()

  if (companyErr || !company) {
    return NextResponse.json(
      { error: companyErr?.message ?? 'Failed to create company' },
      { status: 500 }
    )
  }

  // Insert domains
  const domainRows = cleanDomains.map((d) => ({
    company_id: company.id,
    domain: d,
  }))

  const { error: domainErr } = await svc
    .from('company_domains')
    .insert(domainRows)

  if (domainErr) {
    // Rollback company
    await svc.from('companies').delete().eq('id', company.id)
    return NextResponse.json(
      { error: `Failed to add domains: ${domainErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { ...company, domains: cleanDomains },
    { status: 201 }
  )
}

// ─── GET: List all companies ─────────────────────────────────────────────────

export async function GET() {
  try {
    await requirePlatformAdmin()
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Unauthorized' },
      { status: e.status ?? 403 }
    )
  }

  const svc = createServiceClient()

  const { data: companies } = await svc
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: allDomains } = await svc
    .from('company_domains')
    .select('company_id, domain')

  const domainMap: Record<string, string[]> = {}
  for (const d of allDomains ?? []) {
    if (!domainMap[d.company_id]) domainMap[d.company_id] = []
    domainMap[d.company_id].push(d.domain)
  }

  const result = (companies ?? []).map((c) => ({
    ...c,
    domains: domainMap[c.id] ?? [],
  }))

  return NextResponse.json(result)
}
