'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyInfo {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

interface ProfileData {
  company_id: string | null
  work_email: string | null
  personal_email: string | null
  company: CompanyInfo | null
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  )
}

function EnvelopeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  )
}

function ArrowRightStartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
  )
}

function XMarkIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [personalEmailInput, setPersonalEmailInput] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Departure modal state
  const [showDepartureModal, setShowDepartureModal] = useState(false)
  const [departureStep, setDepartureStep] = useState<1 | 2>(1)
  const [confirmText, setConfirmText] = useState('')
  const [departureEmail, setDepartureEmail] = useState('')
  const [departing, setDeparting] = useState(false)

  // ── Load profile ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth?next=/settings/account')
        return
      }

      // Fetch profile with company info
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('company_id, work_email, personal_email')
        .eq('id', user.id)
        .single()

      let company: CompanyInfo | null = null
      if (profileRow?.company_id) {
        const { data: companyRow } = await supabase
          .from('companies')
          .select('id, name, slug, logo_url')
          .eq('id', profileRow.company_id)
          .single()

        company = companyRow ?? null
      }

      setProfile({
        company_id: profileRow?.company_id ?? null,
        work_email: profileRow?.work_email ?? null,
        personal_email: profileRow?.personal_email ?? null,
        company,
      })
      setPersonalEmailInput(profileRow?.personal_email ?? '')
      setLoading(false)
    }

    load()
  }, [router])

  // ── Auto-dismiss toast ────────────────────────────────────────────────────

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Save personal email ───────────────────────────────────────────────────

  async function handleSavePersonalEmail() {
    if (!personalEmailInput.trim() || !personalEmailInput.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ personal_email: personalEmailInput.trim() })
        .eq('id', user.id)

      if (updateErr) {
        setError('Failed to save email. Please try again.')
      } else {
        setProfile((prev) =>
          prev ? { ...prev, personal_email: personalEmailInput.trim() } : prev
        )
        setShowEmailForm(false)
        setToast('Personal email saved')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Handle departure ──────────────────────────────────────────────────────

  async function handleDeparture() {
    setDeparting(true)
    setError(null)

    // If no personal email set, save the departure email first
    if (!profile?.personal_email && departureEmail.trim()) {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await supabase
          .from('profiles')
          .update({ personal_email: departureEmail.trim() })
          .eq('id', user.id)
      }
    }

    try {
      const res = await fetch('/api/account/depart-company', { method: 'POST' })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Departure failed. Please try again.')
        setDeparting(false)
        return
      }

      router.push('/home')
    } catch {
      setError('Something went wrong. Please try again.')
      setDeparting(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#0D7377] rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) return null

  const companyName = profile.company?.name ?? 'your company'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Nav bar ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeftIcon />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base font-black tracking-[0.12em]" style={{ color: '#0D7377' }}>
              ROVA
            </span>
            <span className="text-base font-black tracking-[0.12em]" style={{ color: '#C9982A' }}>
              CREW
            </span>
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-sm font-semibold text-gray-700 truncate">Account</span>
          </div>
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>

        {/* ── Work Identity ────────────────────────────────────────────────── */}
        {profile.company_id && profile.company && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Work Identity
            </h2>

            <div className="flex items-center gap-4 mb-4">
              {/* Company logo or initial */}
              <div
                className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: '#0D7377' }}
              >
                {profile.company.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.company.logo_url}
                    alt={profile.company.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-lg">
                    {profile.company.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{profile.company.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#0D737715', color: '#0D7377' }}
                  >
                    <ShieldCheckIcon />
                    Verified employee
                  </span>
                </div>
              </div>
            </div>

            {profile.work_email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <EnvelopeIcon />
                <span>Work email: {profile.work_email}</span>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              You were automatically verified when you signed up with your work email.
            </p>
          </section>
        )}

        {/* ── Personal Email ───────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Personal Email
          </h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}

          {profile.personal_email && !showEmailForm ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="inline-flex items-center gap-1">
                  <CheckIcon />
                  Personal email: {profile.personal_email}
                </span>
              </div>
              <button
                onClick={() => {
                  setPersonalEmailInput(profile.personal_email ?? '')
                  setShowEmailForm(true)
                  setError(null)
                }}
                className="text-sm font-semibold transition-opacity hover:opacity-75"
                style={{ color: '#0D7377' }}
              >
                Change
              </button>
            </div>
          ) : !showEmailForm ? (
            <div>
              <p className="text-sm text-gray-500 mb-3">No personal email set.</p>
              <button
                onClick={() => {
                  setShowEmailForm(true)
                  setError(null)
                }}
                className="text-sm font-semibold transition-opacity hover:opacity-75"
                style={{ color: '#0D7377' }}
              >
                Add personal email
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                value={personalEmailInput}
                onChange={(e) => setPersonalEmailInput(e.target.value)}
                placeholder="your@personal-email.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7377]/30 focus:border-[#0D7377] transition-colors"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSavePersonalEmail}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#0D7377' }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowEmailForm(false)
                    setError(null)
                    setPersonalEmailInput(profile.personal_email ?? '')
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── If I Leave Company ───────────────────────────────────────────── */}
        {profile.company_id && profile.company && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              If I Leave {profile.company.name}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              If you leave {profile.company.name}, your account will transition to a personal ROVA
              Crew account. You&apos;ll keep your badges, crew score, and public group memberships,
              but lose access to company-scoped groups and leaderboards.
            </p>
            <button
              onClick={() => {
                setShowDepartureModal(true)
                setDepartureStep(1)
                setConfirmText('')
                setDepartureEmail('')
                setError(null)
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-700 transition-colors"
            >
              <ArrowRightStartIcon />
              Start departure process
            </button>
          </section>
        )}

        {/* ── Back link ────────────────────────────────────────────────────── */}
        <div className="pt-2">
          <Link
            href="/home"
            className="text-sm font-semibold transition-opacity hover:opacity-75"
            style={{ color: '#0D7377' }}
          >
            &larr; Back to home
          </Link>
        </div>
      </main>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div
            className="px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-lg"
            style={{ backgroundColor: '#0D7377' }}
          >
            {toast}
          </div>
        </div>
      )}

      {/* ── Departure Modal ──────────────────────────────────────────────── */}
      {showDepartureModal && profile.company && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!departing) {
                setShowDepartureModal(false)
              }
            }}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-gray-900">
                {departureStep === 1
                  ? `Moving on from ${profile.company.name}?`
                  : 'Confirm departure'}
              </h2>
              {!departing && (
                <button
                  onClick={() => setShowDepartureModal(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
                  aria-label="Close"
                >
                  <XMarkIcon />
                </button>
              )}
            </div>

            <div className="p-6">
              {departureStep === 1 && (
                <>
                  {/* Two columns: keep vs lose */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {/* What you keep */}
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">
                        What you keep
                      </p>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          Badges earned
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          Crew score
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          Event memories
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          Public clubs
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          Photos
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          Friends
                        </li>
                      </ul>
                    </div>

                    {/* What you lose */}
                    <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3">
                        What you lose
                      </p>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                          Company-scoped groups
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                          Company event history
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                          Company leaderboard
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Personal email requirement */}
                  {!profile.personal_email ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
                      <p className="text-sm font-semibold text-amber-800 mb-2">
                        Personal email required
                      </p>
                      <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                        You need a personal email to continue using ROVA Crew after departure.
                        Your account will move to this email.
                      </p>
                      <input
                        type="email"
                        value={departureEmail}
                        onChange={(e) => setDepartureEmail(e.target.value)}
                        placeholder="your@personal-email.com"
                        className="w-full px-4 py-3 rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7377]/30 focus:border-[#0D7377] bg-white transition-colors"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 mb-6">
                      <p className="text-sm text-gray-600">
                        Your account will move to:{' '}
                        <span className="font-semibold text-gray-900">
                          {profile.personal_email}
                        </span>
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (!profile.personal_email && !departureEmail.trim().includes('@')) {
                        setError('Please enter a valid personal email to continue.')
                        return
                      }
                      setError(null)
                      setDepartureStep(2)
                    }}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#0D7377' }}
                  >
                    Continue
                  </button>
                </>
              )}

              {departureStep === 2 && (
                <>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    This action cannot be undone. You will be removed from all {profile.company.name}{' '}
                    company-scoped groups immediately. Type{' '}
                    <span className="font-mono font-bold text-gray-900">CONFIRM</span> below to
                    proceed.
                  </p>

                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type CONFIRM"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-colors mb-4"
                    autoFocus
                  />

                  {error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setDepartureStep(1)
                        setConfirmText('')
                        setError(null)
                      }}
                      disabled={departing}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border-2 border-gray-200 hover:border-gray-300 transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleDeparture}
                      disabled={confirmText !== 'CONFIRM' || departing}
                      className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                      style={{ backgroundColor: '#DC2626' }}
                    >
                      {departing ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        'Complete departure'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
