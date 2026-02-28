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

    // Detect auth and redirect immediately — NO async work inside the callback.
    // Safari iOS silently swallows errors after await in event callbacks,
    // which caused the page to freeze on "Signing you in..."
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          subscription.unsubscribe()
          clearTimeout(timeout)
          window.location.href = '/home'
        }
      }
    )

    // Fallback: if session was already processed before listener was set up
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        window.location.href = '/home'
      }
    })

    // Hard fallback: redirect after 5 seconds regardless.
    // If auth succeeded, /home will show the dashboard.
    // If not, /home redirects to /auth.
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      window.location.href = '/home'
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
