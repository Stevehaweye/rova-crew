'use client'

import { Suspense, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-gray-300 border-t-[#0D7377] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500 font-medium">Signing you in...</p>
      </div>
    </div>
  )
}

function isSafeRelativePath(candidate: string | null): candidate is string {
  if (!candidate) return false
  if (!candidate.startsWith('/')) return false
  if (candidate.startsWith('//')) return false
  if (candidate.startsWith('/http')) return false
  return true
}

function CallbackHandler() {
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const supabase = createClient()

    async function handleAuth() {
      const url = new URL(window.location.href)
      const searchParams = url.searchParams
      const rawNext = searchParams.get('next')
      const nextParam = isSafeRelativePath(rawNext) ? rawNext : null
      const redirectTarget = nextParam
        ? `/auth/redirect?next=${encodeURIComponent(nextParam)}`
        : '/auth/redirect'

      let lastError: string | null = null

      // Try every method that can succeed here and only bail if all of them
      // fail. `detectSessionInUrl` (enabled by default in @supabase/ssr) may
      // have already established a session as a side effect of createClient,
      // so we always finish with a getSession() check.
      async function trySucceed(): Promise<boolean> {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          window.location.href = redirectTarget
          return true
        }
        return false
      }

      // 0. Auto-detect may have already stored the session.
      if (await trySucceed()) return

      // 1. Implicit flow — access_token in hash fragment. This is what our
      //    client is configured for (lib/supabase/client.ts flowType='implicit')
      //    and it works cross-device because no PKCE verifier is required.
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) {
            window.location.href = redirectTarget
            return
          }
          console.error('[auth-callback] setSession failed:', error)
          lastError = error.message || 'set_session_failed'
        }
      }

      // 2. Email OTP flow — ?token_hash=&type=
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'magiclink' | 'signup' | 'recovery' | 'invite' | 'email' | 'email_change',
        })
        if (!error) {
          window.location.href = redirectTarget
          return
        }
        console.error('[auth-callback] verifyOtp failed:', error)
        lastError = error.message || 'otp_verify_failed'
      }

      // 3. PKCE flow — ?code=. Only useful when the ORIGINAL browser (with
      //    the stored verifier) is opening the link. Cross-device magic
      //    links will fail here with "PKCE code verifier not found" — that
      //    is expected and we fall through so the final getSession() catches
      //    any session that auto-detect stored.
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          window.location.href = redirectTarget
          return
        }
        console.warn('[auth-callback] exchangeCodeForSession failed (expected on cross-device magic links):', error.message)
        // Don't record this as `lastError` — the missing-verifier case is
        // expected and we don't want to surface it if a later method works.
      }

      // 4. Final check: session may have been established as a side effect
      //    of one of the above attempts (Supabase-js sometimes stores the
      //    session even when it also throws), or by detectSessionInUrl.
      if (await trySucceed()) return

      // 5. Last resort: cookies may still be propagating.
      await new Promise((r) => setTimeout(r, 2000))
      if (await trySucceed()) return

      window.location.href = `/auth?error=${encodeURIComponent(lastError ?? 'timeout')}`
    }

    handleAuth()
  }, [])

  return <Spinner />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackHandler />
    </Suspense>
  )
}
