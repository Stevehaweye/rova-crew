import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

function safeNext(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  if (raw.startsWith('/http')) return null
  return raw
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!user) {
    return NextResponse.redirect(new URL('/auth', baseUrl))
  }

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .single()

  const nextParam = safeNext(request.nextUrl.searchParams.get('next'))

  const destination = !profile?.onboarding_complete
    ? '/onboarding'
    : nextParam ?? '/home'

  return NextResponse.redirect(new URL(destination, baseUrl))
}
