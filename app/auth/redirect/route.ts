import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
  }

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .single()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const destination = profile?.onboarding_complete ? '/home' : '/onboarding'

  return NextResponse.redirect(new URL(destination, baseUrl))
}
