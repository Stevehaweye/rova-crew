import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=missing_code`)
  }

  // Collect cookies to set on the final response
  const cookiesToForward: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToForward.push(...cookiesToSet)
        },
      },
    }
  )

  // Exchange the auth code for a session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession error:', exchangeError.message)
    const errorUrl = new URL(`${origin}/auth`)
    errorUrl.searchParams.set('error', 'exchange_failed')
    errorUrl.searchParams.set('detail', exchangeError.message)
    return NextResponse.redirect(errorUrl)
  }

  // Determine where to send the user
  let redirectTo = `${origin}/home`

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()

    if (!profile?.onboarding_complete) {
      redirectTo = `${origin}/onboarding`
    }
  }

  // Build final response with all auth cookies
  const response = NextResponse.redirect(redirectTo)
  cookiesToForward.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options as never)
  )

  return response
}
