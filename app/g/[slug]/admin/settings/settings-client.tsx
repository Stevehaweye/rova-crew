'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { TIER_THEMES } from '@/lib/tier-themes'

// ─── Types ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Running', emoji: '\u{1F3C3}' },
  { label: 'Cycling', emoji: '\u{1F6B4}' },
  { label: 'Walking', emoji: '\u{1F97E}' },
  { label: 'Yoga', emoji: '\u{1F9D8}' },
  { label: 'Football', emoji: '\u26BD' },
  { label: 'Book Club', emoji: '\u{1F4DA}' },
  { label: 'Social', emoji: '\u{1F37D}\uFE0F' },
  { label: 'Photography', emoji: '\u{1F4F7}' },
  { label: 'Volunteer', emoji: '\u{1F91D}' },
  { label: 'Dog Walking', emoji: '\u{1F415}' },
  { label: 'Knitting', emoji: '\u{1F9F6}' },
  { label: 'Other', emoji: '\u2728' },
]

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
  membershipFee: {
    enabled: boolean
    feePence: number | null
  }
  dmEnabled: boolean
  tierTheme: string
  badgeAnnouncementsEnabled: boolean
  watermarkPhotos: boolean
  location: string
  groupProfile: {
    name: string
    tagline: string
    description: string
    category: string
    isPublic: boolean
    joinApprovalRequired: boolean
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsClient({ group, stripe, membershipFee, dmEnabled: initialDmEnabled, tierTheme: initialTierTheme, badgeAnnouncementsEnabled: initialBadgeAnnounce, watermarkPhotos: initialWatermark, location: initialLocation, groupProfile }: Props) {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Group profile state
  const [profileName, setProfileName] = useState(groupProfile.name)
  const [profileTagline, setProfileTagline] = useState(groupProfile.tagline)
  const [profileDescription, setProfileDescription] = useState(groupProfile.description)
  const [profileCategory, setProfileCategory] = useState(groupProfile.category)
  const [profilePublic, setProfilePublic] = useState(groupProfile.isPublic)
  const [profileApproval, setProfileApproval] = useState(groupProfile.joinApprovalRequired)
  const [profileSaving, setProfileSaving] = useState(false)

  // DM state
  const [dmOn, setDmOn] = useState(initialDmEnabled)
  const [dmSaving, setDmSaving] = useState(false)

  // Membership fee state
  const [feeEnabled, setFeeEnabled] = useState(membershipFee.enabled)
  const [feePounds, setFeePounds] = useState(
    membershipFee.feePence ? (membershipFee.feePence / 100).toFixed(2) : ''
  )
  const [feeSaving, setFeeSaving] = useState(false)
  const [feeError, setFeeError] = useState('')

  // Gamification state
  const [theme, setTheme] = useState(initialTierTheme)
  const [announceOn, setAnnounceOn] = useState(initialBadgeAnnounce)
  const [gamifSaving, setGamifSaving] = useState(false)

  // Watermark state
  const [watermarkOn, setWatermarkOn] = useState(initialWatermark)
  const [watermarkSaving, setWatermarkSaving] = useState(false)

  // Location state
  const [locationVal, setLocationVal] = useState(initialLocation)
  const [locationSaving, setLocationSaving] = useState(false)

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

  async function handleSaveFee() {
    setFeeSaving(true)
    setFeeError('')

    try {
      const feePence = feeEnabled ? Math.round(parseFloat(feePounds || '0') * 100) : 0

      if (feeEnabled && feePence < 100) {
        setFeeError('Fee must be at least £1.00')
        setFeeSaving(false)
        return
      }

      const res = await fetch(`/api/groups/${group.slug}/membership-fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: feeEnabled, fee_pence: feePence }),
      })

      const data = await res.json()

      if (!res.ok) {
        setFeeError(data.error || 'Something went wrong.')
        setFeeSaving(false)
        return
      }

      setToast(feeEnabled ? `Membership fee set to £${(feePence / 100).toFixed(2)}/month` : 'Membership fee disabled')
      setFeeSaving(false)
    } catch {
      setFeeError('Network error. Please try again.')
      setFeeSaving(false)
    }
  }

  async function handleSaveDm() {
    setDmSaving(true)
    try {
      const res = await fetch(`/api/groups/${group.slug}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_dm: dmOn }),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast(data.error || 'Failed to save')
      } else {
        setToast(dmOn ? 'Direct messages enabled' : 'Direct messages disabled')
      }
    } catch {
      setToast('Network error. Please try again.')
    }
    setDmSaving(false)
  }

  async function handleSaveGamification() {
    setGamifSaving(true)
    try {
      const res = await fetch(`/api/groups/${group.slug}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier_theme: theme, badge_announcements_enabled: announceOn }),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast(data.error || 'Failed to save')
      } else {
        const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1).replace('_', ' ')
        setToast(`Tier theme set to ${themeLabel}`)
      }
    } catch {
      setToast('Network error. Please try again.')
    }
    setGamifSaving(false)
  }

  async function handleSaveWatermark() {
    setWatermarkSaving(true)
    try {
      const res = await fetch(`/api/groups/${group.slug}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watermark_photos: watermarkOn }),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast(data.error || 'Failed to save')
      } else {
        setToast(watermarkOn ? 'Watermarking enabled for shared photos' : 'Watermarking disabled')
      }
    } catch {
      setToast('Network error. Please try again.')
    }
    setWatermarkSaving(false)
  }

  async function handleSaveLocation() {
    setLocationSaving(true)
    try {
      const res = await fetch(`/api/groups/${group.slug}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: locationVal }),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast(data.error || 'Failed to save')
      } else {
        setToast(locationVal.trim() ? `Location set to ${locationVal.trim()}` : 'Location cleared')
      }
    } catch {
      setToast('Network error. Please try again.')
    }
    setLocationSaving(false)
  }

  async function handleSaveProfile() {
    if (!profileName.trim()) {
      setToast('Group name is required')
      return
    }
    setProfileSaving(true)
    try {
      const res = await fetch(`/api/groups/${group.slug}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          tagline: profileTagline,
          description: profileDescription,
          category: profileCategory,
          is_public: profilePublic,
          join_approval_required: profileApproval,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast(data.error || 'Failed to save')
      } else {
        setToast('Group profile updated')
      }
    } catch {
      setToast('Network error. Please try again.')
    }
    setProfileSaving(false)
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

        {/* ── Group Profile ──────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Group Profile</p>
              <p className="text-xs text-gray-500">Name, category, description, and visibility</p>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Group name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              />
            </div>

            {/* Tagline */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tagline</label>
              <input
                type="text"
                value={profileTagline}
                onChange={(e) => setProfileTagline(e.target.value)}
                placeholder="A short description of your group"
                maxLength={120}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Description</label>
              <textarea
                value={profileDescription}
                onChange={(e) => setProfileDescription(e.target.value)}
                placeholder="Tell people what your group is about..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(({ label, emoji }) => {
                  const active = profileCategory === label
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setProfileCategory(label)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        active
                          ? 'text-white border-transparent'
                          : 'text-gray-600 border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      style={active ? { backgroundColor: group.colour } : undefined}
                    >
                      {emoji} {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Visibility toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700">Public group</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  {profilePublic ? 'Visible on the discovery page' : 'Only accessible via direct link'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={profilePublic}
                onClick={() => setProfilePublic(!profilePublic)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  profilePublic ? 'bg-teal-500' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${profilePublic ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </label>

            {/* Join approval toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700">Require approval to join</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  {profileApproval ? 'New members need admin approval' : 'Anyone can join instantly'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={profileApproval}
                onClick={() => setProfileApproval(!profileApproval)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  profileApproval ? 'bg-teal-500' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${profileApproval ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </label>

            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: group.colour }}
            >
              {profileSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </section>

        {/* ── Location ────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Location</p>
              <p className="text-xs text-gray-500">Help people find your group on the discovery page</p>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4">
            <input
              type="text"
              value={locationVal}
              onChange={(e) => setLocationVal(e.target.value)}
              placeholder="e.g. London, UK"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
            <p className="text-xs text-gray-400">
              Shown on your group card in the discovery page. Leave blank to hide.
            </p>
            <button
              onClick={handleSaveLocation}
              disabled={locationSaving}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: group.colour }}
            >
              {locationSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </section>

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

        {/* ── Monthly Membership Fee ─────────────────────────────── */}
        {stripe?.chargesEnabled && (
          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Monthly Membership Fee</p>
                <p className="text-xs text-gray-500">Charge members a recurring fee to join your group</p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Enable membership fee</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={feeEnabled}
                  onClick={() => setFeeEnabled(!feeEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    feeEnabled ? 'bg-teal-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      feeEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>

              {/* Price input */}
              {feeEnabled && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Monthly fee
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold">£</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={feePounds}
                      onChange={(e) => setFeePounds(e.target.value)}
                      placeholder="5.00"
                      className="w-full pl-7 pr-20 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">per month</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Minimum £1.00. ROVA Crew takes a 5% platform fee.</p>
                </div>
              )}

              {feeError && (
                <p className="text-xs text-red-500">{feeError}</p>
              )}

              <button
                onClick={handleSaveFee}
                disabled={feeSaving}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: group.colour }}
              >
                {feeSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </section>
        )}
        {/* ── Direct Messages ──────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Direct Messages</p>
              <p className="text-xs text-gray-500">Allow members to message each other directly</p>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-gray-700">Enable direct messages</span>
              <button
                type="button"
                role="switch"
                aria-checked={dmOn}
                onClick={() => setDmOn(!dmOn)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  dmOn ? 'bg-teal-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    dmOn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            <p className="text-xs text-gray-400">
              {dmOn
                ? 'Members can send private messages to other members they share a group with.'
                : 'Direct messaging is disabled for this group.'}
            </p>

            <button
              onClick={handleSaveDm}
              disabled={dmSaving}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: group.colour }}
            >
              {dmSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </section>

        {/* ── Gamification — Tier Theme ───────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 0 1-2.77.853m0 0H11m3 0a6.023 6.023 0 0 0 2.77-.853" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Gamification</p>
              <p className="text-xs text-gray-500">Choose tier names and announcement settings</p>
            </div>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Theme label */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-3">Tier naming theme</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(TIER_THEMES).map(([key, tiers]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      theme === key
                        ? 'border-current shadow-sm'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                    style={theme === key ? { borderColor: group.colour } : undefined}
                  >
                    <p className="text-xs font-bold text-gray-900 capitalize mb-1">
                      {key.replace('_', ' ')}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      {tiers.join(' \u2192 ')}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Badge announcements toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700">Tier-up announcements</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  Post in announcements when a member reaches a new tier
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={announceOn}
                onClick={() => setAnnounceOn(!announceOn)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  announceOn ? 'bg-teal-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    announceOn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            <button
              onClick={handleSaveGamification}
              disabled={gamifSaving}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: group.colour }}
            >
              {gamifSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </section>
        {/* ── Photo Watermarking ──────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Photo Watermarking</p>
              <p className="text-xs text-gray-500">Add group branding to shared event photos</p>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-gray-700">Watermark shared photos</span>
              <button
                type="button"
                role="switch"
                aria-checked={watermarkOn}
                onClick={() => setWatermarkOn(!watermarkOn)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  watermarkOn ? 'bg-teal-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    watermarkOn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            <p className="text-xs text-gray-400">
              {watermarkOn
                ? 'Photos shared from this group will include your group logo and name.'
                : 'Photos will be shared without group branding.'}
            </p>

            <button
              onClick={handleSaveWatermark}
              disabled={watermarkSaving}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: group.colour }}
            >
              {watermarkSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
