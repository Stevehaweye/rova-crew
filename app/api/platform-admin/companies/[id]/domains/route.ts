import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin()
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Unauthorized' },
      { status: e.status ?? 403 }
    )
  }

  const { id: companyId } = await params
  const body = await request.json().catch(() => null)
  const domain = (body?.domain as string)?.toLowerCase().trim()

  if (!domain || !domain.includes('.') || domain.includes('@') || domain.includes(' ')) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Check domain not already registered
  const { data: existing } = await svc
    .from('company_domains')
    .select('id, company_id')
    .eq('domain', domain)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: `Domain "${domain}" is already registered` },
      { status: 409 }
    )
  }

  const { error: insertErr } = await svc
    .from('company_domains')
    .insert({ company_id: companyId, domain })

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Return updated domains list
  const { data: domains } = await svc
    .from('company_domains')
    .select('domain')
    .eq('company_id', companyId)

  return NextResponse.json({
    domains: (domains ?? []).map((d) => d.domain),
  })
}
