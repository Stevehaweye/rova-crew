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

      function fail(reason: string) {
        window.location.href = `/auth?error=${encodeURIComponent(reason)}`
      }

      // 1. PKCE flow — ?code=...
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          window.location.href = redirectTarget
          return
        }
        console.error('[auth-callback] exchangeCodeForSession failed:', error)
        fail(error.message || 'code_exchange_failed')
        return
      }

      // 2. Email OTP magic link — ?token_hash=...&type=...
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
        fail(error.message || 'otp_verify_failed')
        return
      }

      // 3. Implicit flow — access_token in hash fragment
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
          fail(error.message || 'set_session_failed')
          return
        }
      }

      // 4. Fallback: session may already exist (same-device flow).
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        window.location.href = redirectTarget
        return
      }

      // 5. Last resort: wait briefly for cookies to propagate and retry.
      await new Promise((r) => setTimeout(r, 2000))
      const { data: { session: retrySession } } = await supabase.auth.getSession()
      if (retrySession?.user) {
        window.location.href = redirectTarget
        return
      }

      fail('timeout')
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
