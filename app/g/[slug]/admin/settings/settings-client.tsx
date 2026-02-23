'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  group: {
    id: string
    name: string
    slug: string
    colour: string
  }
  stripe: {
    accountId: string
    chargesEnabled: boolean
    payoutsEnabled: boolean
    detailsSubmitted: boolean
  } | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsClient({ group, stripe }: Props) {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Show toast on return from Stripe
  useEffect(() => {
    const stripeParam = searchParams.get('stripe')
    if (stripeParam === 'complete') {
      setToast(
        stripe?.chargesEnabled
          ? 'Stripe connected successfully! You can now accept payments.'
          : 'Stripe onboarding submitted. It may take a moment to activate.'
      )
    } else if (stripeParam === 'refresh') {
      setToast('Your Stripe link expired. Click below to continue setup.')
    }
  }, [searchParams, stripe?.chargesEnabled])

  // Dismiss toast after 6 seconds
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 6000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleConnect() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: group.id, slug: group.slug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      setError('No onboarding URL returned. Please try again.')
      setLoading(false)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 h-14">
          <Link
            href={`/g/${group.slug}/admin`}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <p className="text-sm font-bold text-gray-900">Settings</p>
            <p className="text-xs text-gray-400">{group.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Toast */}
        {toast && (
          <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3">
            <p className="text-sm text-teal-800">{toast}</p>
          </div>
        )}

        {/* ── Stripe Connect Card ──────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 21Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Payments</p>
              <p className="text-xs text-gray-500">Accept payments for your events via Stripe</p>
            </div>
          </div>

          <div className="px-5 py-5">
            {/* ── Connected ──────────────────────────────── */}
            {stripe?.chargesEnabled ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Stripe Connected</p>
                    <p className="text-xs text-gray-400">
                      Account {stripe.accountId.slice(0, 12)}...
                      {stripe.payoutsEnabled && ' · Payouts enabled'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  You can now create paid events. Funds are transferred directly to your bank account.
                  ROVA Crew takes a 5% platform fee per transaction.
                </p>
              </div>
            ) : stripe?.detailsSubmitted ? (
              /* ── Onboarding submitted, waiting for activation ── */
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Onboarding in progress</p>
                    <p className="text-xs text-gray-400">Stripe is reviewing your details</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Your details have been submitted. Stripe may take a few minutes to verify your account.
                  Refresh this page to check the latest status.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: group.colour }}
                >
                  {loading ? 'Loading...' : 'Continue setup on Stripe'}
                </button>
              </div>
            ) : stripe ? (
              /* ── Account created but onboarding not finished ── */
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Setup incomplete</p>
                    <p className="text-xs text-gray-400">Finish connecting your Stripe account</p>
                  </div>
                </div>
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: group.colour }}
                >
                  {loading ? 'Loading...' : 'Continue Stripe setup'}
                </button>
              </div>
            ) : (
              /* ── Not connected ──────────────────────────── */
              <div className="space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Connect a Stripe account to accept card payments for your events.
                  Funds go directly to your bank account. ROVA Crew takes a 5% platform fee.
                </p>
                <ul className="text-xs text-gray-500 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    Accept credit/debit card payments
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    Automatic payouts to your bank account
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    Takes about 2 minutes to set up
                  </li>
                </ul>
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: group.colour }}
                >
                  {loading ? 'Connecting...' : 'Connect Stripe'}
                </button>
                {error && (
                  <p className="text-xs text-red-500 text-center">{error}</p>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
