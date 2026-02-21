import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/home', '/profile']

function isProtected(pathname: string): boolean {
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) return true
  // /g/<slug>/admin and any sub-paths
  if (/^\/g\/[^/]+\/admin(\/|$)/.test(pathname)) return true
  return false
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('[middleware] NEXT_PUBLIC_SUPABASE_URL =', supabaseUrl)

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !/^https?:\/\//.test(supabaseUrl)
  ) {
    console.error(
      '[middleware] Missing or invalid Supabase env vars.',
      `NEXT_PUBLIC_SUPABASE_URL="${supabaseUrl}"`,
      '— must be a valid https:// URL. Update .env.local with your real Supabase project credentials.'
    )
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Forward updated cookies onto the request so downstream code sees them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Rebuild the response so the browser receives the new cookies
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not add any logic between createServerClient and getUser()
  // A simple mistake here can cause hard-to-debug session issues.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && isProtected(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth'
    redirectUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static  (static assets)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     *  - common image extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
