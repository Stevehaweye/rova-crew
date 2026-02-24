'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const router = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const supabase = createClient()

    async function handleRedirect(userId: string) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', userId)
        .single()

      if (!profile?.onboarding_complete) {
        router.replace('/onboarding')
      } else {
        router.replace('/home')
      }
    }

    // Handle PKCE flow (code in query params)
    const code = searchParams.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
        if (error || !data.session?.user) {
          router.replace(
            `/auth?error=exchange_failed&detail=${encodeURIComponent(error?.message ?? 'No session')}`
          )
          return
        }
        handleRedirect(data.session.user.id)
      })
      return
    }

    // Handle implicit flow (tokens in URL hash — auto-detected by supabase client)
    // Listen for the auth state change when tokens are processed from the hash
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        subscription.unsubscribe()
        handleRedirect(session.user.id)
      }
    })

    // Fallback: check if already signed in (tokens may have been processed before listener attached)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        subscription.unsubscribe()
        handleRedirect(session.user.id)
      }
    })

    // Safety timeout — if nothing happens after 5 seconds, redirect to auth
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      router.replace('/auth?error=timeout')
    }, 5000)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [searchParams, router])

  return <Spinner />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackHandler />
    </Suspense>
  )
}
