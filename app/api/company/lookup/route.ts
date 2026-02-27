import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractDomain } from '@/lib/company'

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')

  if (!email || !email.includes('@') || !email.includes('.')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const domain = extractDomain(email)
  if (!domain || !domain.includes('.')) {
    return NextResponse.json({ company: null })
  }

  const svc = createServiceClient()

  const { data: domainRow } = await svc
    .from('company_domains')
    .select('company_id')
    .eq('domain', domain)
    .maybeSingle()

  if (!domainRow) {
    return NextResponse.json({ company: null })
  }

  const { data: company } = await svc
    .from('companies')
    .select('id, name, slug, logo_url, primary_colour')
    .eq('id', domainRow.company_id)
    .maybeSingle()

  return NextResponse.json({ company: company ?? null })
}
