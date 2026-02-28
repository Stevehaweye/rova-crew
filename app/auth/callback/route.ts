import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'

  if (!code) {
    // No code — redirect to auth page with error
    return NextResponse.redirect(
      `${origin}/auth?error=missing_code`
    )
  }

  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    console.error('[auth/callback] Code exchange failed:', error?.message)
    return NextResponse.redirect(
      `${origin}/auth?error=exchange_failed&detail=${encodeURIComponent(error?.message ?? 'Unknown error')}`
    )
  }

  // Check if user needs onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', data.session.user.id)
    .single()

  if (!profile?.onboarding_complete) {
    const onboardingResponse = NextResponse.redirect(`${origin}/onboarding`)
    // Copy cookies from the exchange response
    response.cookies.getAll().forEach((cookie) => {
      onboardingResponse.cookies.set(cookie.name, cookie.value)
    })
    return onboardingResponse
  }

  return response
}
