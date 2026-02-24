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

    async function redirectUser(userId: string) {
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

    async function trySessionOrError(detail?: string) {
      // The session may already be established (e.g. from hash fragment tokens
      // processed by the Supabase client on init). Check before showing error.
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        await redirectUser(session.user.id)
        return
      }

      // No session — show error
      router.replace(
        `/auth?error=exchange_failed&detail=${encodeURIComponent(detail ?? 'Could not establish session')}`
      )
    }

    const code = searchParams.get('code')

    if (code) {
      // Try PKCE code exchange
      supabase.auth
        .exchangeCodeForSession(code)
        .then(async ({ data, error }) => {
          if (!error && data.session?.user) {
            await redirectUser(data.session.user.id)
          } else {
            // Exchange failed — but session may exist from hash tokens
            await trySessionOrError(error?.message)
          }
        })
      return
    }

    // No code param — session may come from hash fragment (implicit flow)
    // or may already exist. Wait briefly then check.
    const checkInterval = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        clearInterval(checkInterval)
        clearTimeout(timeout)
        await redirectUser(session.user.id)
      }
    }, 500)

    const timeout = setTimeout(() => {
      clearInterval(checkInterval)
      trySessionOrError('Timed out waiting for session')
    }, 5000)

    return () => {
      clearInterval(checkInterval)
      clearTimeout(timeout)
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
