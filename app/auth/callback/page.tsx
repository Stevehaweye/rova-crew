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

    async function redirectUser(userId: string) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', userId)
        .single()

      // Use window.location for reliable redirect on Safari iOS
      // (Next.js router.replace doesn't work in async auth callbacks on Safari)
      if (!profile?.onboarding_complete) {
        window.location.replace('/onboarding')
      } else {
        window.location.replace('/home')
      }
    }

    // With implicit flow, Supabase redirects with tokens in the hash fragment.
    // The Supabase client automatically picks these up and fires onAuthStateChange.
    // This works cross-device because the tokens are self-contained.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Listen for both SIGNED_IN and INITIAL_SESSION — different Supabase
        // versions fire different events when processing tokens from the hash.
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          subscription.unsubscribe()
          clearTimeout(timeout)
          await redirectUser(session.user.id)
        }
      }
    )

    // Also check if session already exists (e.g. tokens already processed)
    async function checkExisting() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        await redirectUser(session.user.id)
      }
    }

    checkExisting()

    // Timeout — if no session after 8 seconds, redirect to auth with error
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      window.location.replace('/auth?error=timeout')
    }, 8000)

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
