import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; domain: string }> }
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

  const { id: companyId, domain } = await params
  const decodedDomain = decodeURIComponent(domain)
  const svc = createServiceClient()

  // Check company has at least 2 domains before allowing deletion
  const { data: currentDomains } = await svc
    .from('company_domains')
    .select('domain')
    .eq('company_id', companyId)

  if (!currentDomains || currentDomains.length <= 1) {
    return NextResponse.json(
      { error: 'Cannot remove the last domain. Delete the company instead.' },
      { status: 400 }
    )
  }

  const { error: delErr } = await svc
    .from('company_domains')
    .delete()
    .eq('company_id', companyId)
    .eq('domain', decodedDomain)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  // Return updated domains list
  const { data: remaining } = await svc
    .from('company_domains')
    .select('domain')
    .eq('company_id', companyId)

  return NextResponse.json({
    domains: (remaining ?? []).map((d) => d.domain),
  })
}
