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

    // Once auth is confirmed, redirect via the server-side redirect endpoint.
    // This avoids async Supabase queries in Safari iOS event callbacks which
    // silently fail, and lets the server check onboarding status reliably.
    function doRedirect() {
      window.location.href = '/auth/redirect'
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          subscription.unsubscribe()
          clearTimeout(timeout)
          doRedirect()
        }
      }
    )

    // Fallback: if session was already processed before listener was set up
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        doRedirect()
      }
    })

    // Hard fallback: redirect after 5 seconds regardless.
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      doRedirect()
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
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
