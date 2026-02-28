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

function CallbackHandler() {
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const supabase = createClient()

    async function handleAuth() {
      // 1. Try to extract tokens from the hash fragment (implicit flow)
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
            window.location.href = '/auth/redirect'
            return
          }
        }
      }

      // 2. Fallback: check if session already exists (e.g. same-device flow)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        window.location.href = '/auth/redirect'
        return
      }

      // 3. Last resort: wait briefly and check again
      await new Promise(r => setTimeout(r, 2000))
      const { data: { session: retrySession } } = await supabase.auth.getSession()
      if (retrySession?.user) {
        window.location.href = '/auth/redirect'
        return
      }

      // Nothing worked — send back to auth
      window.location.href = '/auth?error=timeout'
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
