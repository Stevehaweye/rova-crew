import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/home', '/profile', '/onboarding']

function isProtected(pathname: string): boolean {
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) return true
  // /g/<slug>/admin and any sub-paths
  if (/^\/g\/[^/]+\/admin(\/|$)/.test(pathname)) return true
  return false
}

const AUTH_PASSTHROUGH = /^\/auth\/(callback|redirect)(\/|$)/

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Short-circuit: paths that never need session inspection. Avoids running
  // getUser() on every /api/* and /auth callback route, which was a per-request
  // Supabase Auth round-trip that added latency and could race cookie refresh.
  if (pathname.startsWith('/api') || AUTH_PASSTHROUGH.test(pathname)) {
    return NextResponse.next({ request })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !/^https?:\/\//.test(supabaseUrl)
  ) {
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
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico|map)$).*)',
  ],
}
