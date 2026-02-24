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
  const exchanged = useRef(false)

  useEffect(() => {
    // Prevent double-exchange in React strict mode
    if (exchanged.current) return
    exchanged.current = true

    const code = searchParams.get('code')

    if (!code) {
      router.replace('/auth?error=missing_code')
      return
    }

    const supabase = createClient()

    supabase.auth.exchangeCodeForSession(code).then(async ({ error }) => {
      if (error) {
        console.error('[auth/callback] exchange error:', error.message)
        router.replace(
          `/auth?error=exchange_failed&detail=${encodeURIComponent(error.message)}`
        )
        return
      }

      // Check if the user needs onboarding
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single()

        if (!profile?.onboarding_complete) {
          router.replace('/onboarding')
          return
        }
      }

      router.replace('/home')
    })
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
