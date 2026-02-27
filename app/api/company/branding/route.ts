import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ company: null })
  }

  const svc = createServiceClient()

  const { data: company } = await svc
    .from('companies')
    .select('id, name, slug, logo_url, primary_colour')
    .eq('slug', slug)
    .maybeSingle()

  if (!company) {
    return NextResponse.json({ company: null })
  }

  const { data: domains } = await svc
    .from('company_domains')
    .select('domain')
    .eq('company_id', company.id)

  return NextResponse.json({
    company: {
      name: company.name,
      logo_url: company.logo_url,
      primary_colour: company.primary_colour,
      domains: (domains ?? []).map((d) => d.domain),
    },
  })
}
