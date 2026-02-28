'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StripeAccountData {
  stripe_account_id: string
  onboarding_complete: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 21Z" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

function PaymentsPageInner() {
  const searchParams = useSearchParams()
  const [account, setAccount] = useState<StripeAccountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [openingDashboard, setOpeningDashboard] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    const success = searchParams.get('success')
    const refresh = searchParams.get('refresh')
    if (success === 'true') {
      setToast('Stripe onboarding complete! Checking your account status...')
      fetchStatus()
    } else if (refresh === 'true') {
      setToast('Your Stripe link expired. Click below to continue setup.')
    }
  }, [searchParams])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 6000)
    return () => clearTimeout(t)
  }, [toast])

  async function fetchStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect')
      const data = await res.json()
      setAccount(data.account ?? null)
    } catch (err) {
      console.error('[payments] Failed to fetch status:', err)
    }
    setLoading(false)
  }

  async function handleConnect() {
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
      setToast(data.error || 'Something went wrong.')
    } catch {
      setToast('Network error. Please try again.')
    }
    setConnecting(false)
  }

  async function handleOpenDashboard() {
    setOpeningDashboard(true)
    try {
      const res = await fetch('/api/stripe/dashboard-link', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        setToast(data.error || 'Could not open dashboard.')
      }
    } catch {
      setToast('Network error. Please try again.')
    }
    setOpeningDashboard(false)
  }

  const maskedAccountId = account?.stripe_account_id
    ? `acct_...${account.stripe_account_id.slice(-4)}`
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 h-14">
          <Link
            href="/settings/account"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeftIcon />
          </Link>
          <div>
            <p className="text-sm font-bold text-gray-900">Payments</p>
            <p className="text-xs text-gray-400">Stripe Connect</p>
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

        {/* Loading state */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center justify-center">
            <Spinner />
            <p className="text-sm text-gray-400 mt-3">Checking payment status...</p>
          </div>
        ) : account?.onboarding_complete && account?.charges_enabled ? (
          /* ── STATE 3: Connected and active ──────────────────────────── */
          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircleIcon />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Payments active</p>
                <p className="text-xs text-gray-500">Stripe account: {maskedAccountId}</p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Status rows */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Charges enabled</span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Yes
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Payouts enabled</span>
                  {account.payouts_enabled ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Yes
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                      No
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={handleOpenDashboard}
                  disabled={openingDashboard}
                  className="flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80 disabled:opacity-60"
                  style={{ color: '#0D7377' }}
                >
                  {openingDashboard ? (
                    <Spinner />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  )}
                  Manage payouts and view transaction history
                </button>
                <p className="text-xs text-gray-400 mt-1.5">
                  Opens your Stripe Express dashboard to set your payout schedule and see payment history.
                </p>
              </div>
            </div>
          </section>
        ) : account ? (
          /* ── STATE 2: Onboarding started but not complete ──────────── */
          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <ClockIcon />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Account setup incomplete</p>
                <p className="text-xs text-gray-500">Stripe needs more information</p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                You started connecting your bank account but Stripe needs a bit more information to verify your identity.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#D97706' }}
              >
                {connecting ? <><Spinner /> Loading...</> : 'Continue setup'}
              </button>
            </div>
          </section>
        ) : (
          /* ── STATE 1: Not connected ────────────────────────────────── */
          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <CreditCardIcon />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Accept payments for your groups</p>
                <p className="text-xs text-gray-500">Connect your bank account once</p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                Connect your bank account once and accept payments across all your ROVA groups — no matter how many you create. Setup takes about 5 minutes. ROVA takes a 5% platform fee on each transaction.
              </p>

              <ul className="space-y-2.5">
                {[
                  'One setup. Works across all your groups.',
                  'Payments go directly to your bank.',
                  'Configurable payout schedule.',
                  'Full transaction history.',
                  'Stripe handles all card data — ROVA never sees it.',
                ].map((text) => (
                  <li key={text} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-teal-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {text}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#0D7377' }}
              >
                {connecting ? <><Spinner /> Connecting...</> : 'Connect bank account'}
              </button>
            </div>
          </section>
        )}

        {/* Settings nav links */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</p>
          </div>
          <div className="divide-y divide-gray-100">
            <Link href="/settings/account" className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <span className="text-sm text-gray-700">Account</span>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
            <Link href="/settings/notifications" className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <span className="text-sm text-gray-700">Notifications</span>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm font-semibold" style={{ color: '#0D7377' }}>Payments</span>
              {account?.onboarding_complete ? (
                <span className="w-2 h-2 rounded-full bg-green-500" />
              ) : account ? (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner />
      </div>
    }>
      <PaymentsPageInner />
    </Suspense>
  )
}
