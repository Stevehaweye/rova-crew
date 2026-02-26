'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'rova_migrate_wizard'

const PRESET_COLOURS = [
  '#0D7377',
  '#C9982A',
  '#DC2626',
  '#7C3AED',
  '#2563EB',
  '#059669',
]

const CATEGORIES = [
  { label: 'Running', emoji: '🏃' },
  { label: 'Cycling', emoji: '🚴' },
  { label: 'Walking', emoji: '🥾' },
  { label: 'Yoga', emoji: '🧘' },
  { label: 'Football', emoji: '⚽' },
  { label: 'Book Club', emoji: '📚' },
  { label: 'Social', emoji: '🍽️' },
  { label: 'Photography', emoji: '📷' },
  { label: 'Volunteer', emoji: '🤝' },
  { label: 'Dog Walking', emoji: '🐕' },
  { label: 'Knitting', emoji: '🧶' },
  { label: 'Other', emoji: '✨' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  step: number
  name: string
  context: string
  tagline: string
  description: string
  category: string
  location: string
  colour: string
  slug: string
  groupId: string | null
  groupSlug: string | null
  groupName: string | null
}

const DEFAULT_STATE: WizardState = {
  step: 1,
  name: '',
  context: '',
  tagline: '',
  description: '',
  category: '',
  location: '',
  colour: '#0D7377',
  slug: '',
  groupId: null,
  groupSlug: null,
  groupName: null,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

function loadState(): WizardState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<WizardState>
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state: WizardState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage may be unavailable
  }
}

function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5 8.25 12l7.5-7.5"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={3.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  )
}

function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
      />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  current,
  total,
  colour,
}: {
  current: number
  total: number
  colour: string
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => {
        const stepNum = i + 1
        const isActive = stepNum === current
        const isComplete = stepNum < current

        return (
          <div key={stepNum} className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
              style={{
                backgroundColor: isActive
                  ? colour
                  : isComplete
                    ? colour + '30'
                    : '#F3F4F6',
                color: isActive
                  ? '#FFFFFF'
                  : isComplete
                    ? colour
                    : '#9CA3AF',
              }}
            >
              {isComplete ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              ) : (
                stepNum
              )}
            </div>
            {stepNum < total && (
              <div
                className="w-8 h-0.5 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor: isComplete ? colour + '40' : '#E5E7EB',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function MigrateWizard() {
  const router = useRouter()
  const [state, setState] = useState<WizardState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [customHex, setCustomHex] = useState('')
  const [initialized, setInitialized] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const confettiFired = useRef(false)

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadState()
    setState(saved)
    setInitialized(true)
  }, [])

  // Persist state on change
  useEffect(() => {
    if (initialized) {
      saveState(state)
    }
  }, [state, initialized])

  const patch = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }, [])

  const goToStep = useCallback(
    (step: number) => {
      setError('')
      patch({ step })
    },
    [patch]
  )

  // ── Step 1: Generate AI profile ───────────────────────────────────────────

  async function handleGenerateProfile() {
    if (!state.name || state.name.trim().length < 3) {
      setError('Group name must be at least 3 characters.')
      return
    }

    setError('')
    setAiLoading(true)
    goToStep(2)

    try {
      const res = await fetch('/api/migration/draft-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name.trim(),
          context: state.context.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        patch({
          description: data.description || state.description,
          tagline: data.tagline || state.tagline,
          category: data.category || state.category || 'Other',
          slug: state.slug || toSlug(state.name),
        })
      } else {
        // Non-blocking — user can fill in manually
        patch({
          slug: state.slug || toSlug(state.name),
          category: state.category || 'Other',
        })
      }
    } catch {
      // AI failed — user fills in manually
      patch({
        slug: state.slug || toSlug(state.name),
        category: state.category || 'Other',
      })
    } finally {
      setAiLoading(false)
    }
  }

  // ── Step 2: Create group ──────────────────────────────────────────────────

  async function handleCreateGroup() {
    if (!state.name.trim()) {
      setError('Group name is required.')
      return
    }
    if (!state.category) {
      setError('Please select a category.')
      return
    }

    const slug = state.slug || toSlug(state.name)
    if (!slug) {
      setError('A group URL is required.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      // Check slug uniqueness
      const { count } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true })
        .eq('slug', slug)

      if (count && count > 0) {
        setError('This URL is already taken. Try editing the group name.')
        setLoading(false)
        return
      }

      // Upload logo if provided
      let logoUrl: string | null = null
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() ?? 'jpg'
        const path = `${slug}/${Date.now()}.${ext}`
        const { data: upload, error: uploadErr } = await supabase.storage
          .from('group-logos')
          .upload(path, logoFile, { upsert: true })

        if (uploadErr) {
          throw new Error(`Logo upload failed: ${uploadErr.message}`)
        } else if (upload) {
          logoUrl = supabase.storage
            .from('group-logos')
            .getPublicUrl(upload.path).data.publicUrl
        }
      }

      // Insert group with migration_source
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .insert({
          name: state.name.trim(),
          slug,
          tagline: state.tagline.trim() || null,
          description: state.description.trim() || null,
          category: state.category,
          location: state.location.trim() || null,
          logo_url: logoUrl,
          primary_colour: state.colour.replace('#', ''),
          is_public: true,
          join_approval_required: false,
          created_by: user.id,
          migration_source: 'whatsapp',
        })
        .select('id, slug')
        .single()

      if (groupErr) throw groupErr

      // Add creator as super_admin
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'super_admin',
        status: 'approved',
      })

      // Initialize member_stats row
      await supabase.from('member_stats').insert({
        user_id: user.id,
        group_id: group.id,
      })

      patch({
        groupId: group.id,
        groupSlug: group.slug,
        groupName: state.name.trim(),
        slug,
      })

      goToStep(3)
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Something went wrong. Please try again.'
      console.error('[migrate] create group error:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 5: Confetti ──────────────────────────────────────────────────────

  useEffect(() => {
    if (state.step === 5 && !confettiFired.current) {
      confettiFired.current = true
      const duration = 2000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#0D7377', '#C9982A', '#DC2626', '#7C3AED'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#0D7377', '#C9982A', '#2563EB', '#059669'],
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }

      frame()
    }
  }, [state.step])

  // ── Logo handler ──────────────────────────────────────────────────────────

  function processLogo(file: File) {
    if (!file.type.startsWith('image/')) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Copy & share ──────────────────────────────────────────────────────────

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Colour handlers ───────────────────────────────────────────────────────

  function handleCustomHex(value: string) {
    setCustomHex(value)
    const clean = value.startsWith('#') ? value : `#${value}`
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      patch({ colour: clean.toUpperCase() })
    }
  }

  // ── Computed values ───────────────────────────────────────────────────────

  const groupUrl =
    typeof window !== 'undefined' && state.groupSlug
      ? `${window.location.origin}/g/${state.groupSlug}`
      : ''

  const migrationMessage = state.groupName
    ? `Hey everyone! I've moved ${state.groupName} to ROVA Crew. It's free and makes organising way easier. Join here: ${groupUrl}`
    : ''

  const whatsAppShareUrl = `https://wa.me/?text=${encodeURIComponent(migrationMessage)}`

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-[#0D7377]" />
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link
            href="/home"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft />
          </Link>
          <Link href="/home" className="select-none">
            <span
              className="text-lg font-black tracking-[0.14em]"
              style={{ color: '#0D7377' }}
            >
              ROVA
            </span>
            <span
              className="text-lg font-black tracking-[0.14em]"
              style={{ color: '#C9982A' }}
            >
              CREW
            </span>
          </Link>
          <span className="text-gray-300 text-lg">·</span>
          <span className="text-sm font-semibold text-gray-600">
            Migration Wizard
          </span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-20">
        <StepIndicator current={state.step} total={5} colour={state.colour} />

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STEP 1 — Group Name
        ════════════════════════════════════════════════════════════════ */}
        {state.step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl"
                style={{ backgroundColor: state.colour + '15' }}
              >
                📱
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                What&apos;s your WhatsApp group called?
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                We&apos;ll use AI to draft your group profile. You can edit
                everything afterwards.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              {/* Name input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Group name <span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => {
                    patch({ name: e.target.value })
                    setError('')
                  }}
                  placeholder="e.g. Clapham Running Crew"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-base font-medium placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
                />
              </div>

              {/* Context textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tell us a bit more about your group{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={state.context}
                  onChange={(e) => patch({ context: e.target.value })}
                  placeholder="e.g. We meet every Saturday at 9am in Clapham Common for a 5k run, followed by coffee. Mix of beginners and experienced runners."
                  rows={4}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition resize-none"
                />
              </div>

              {/* Generate button */}
              <button
                type="button"
                onClick={handleGenerateProfile}
                disabled={!state.name || state.name.trim().length < 3}
                className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2.5"
                style={{ backgroundColor: state.colour }}
              >
                Generate profile
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STEP 2 — Edit Profile
        ════════════════════════════════════════════════════════════════ */}
        {state.step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl"
                style={{ backgroundColor: state.colour + '15' }}
              >
                {aiLoading ? (
                  <Spinner className="w-8 h-8 text-[#0D7377]" />
                ) : (
                  '✨'
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {aiLoading
                  ? 'Drafting your profile...'
                  : "Here's your group profile"}
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                {aiLoading
                  ? 'Our AI is creating a profile based on your group name.'
                  : 'Review and edit anything below before creating your group.'}
              </p>
            </div>

            {aiLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-4">
                <Spinner className="w-10 h-10 text-[#0D7377]" />
                <p className="text-sm text-gray-500">
                  Generating description, tagline, and category...
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                {/* Group name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Group name{' '}
                    <span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    value={state.name}
                    onChange={(e) =>
                      patch({
                        name: e.target.value,
                        slug: toSlug(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
                  />
                  {/* Slug preview */}
                  <p className="text-xs text-gray-400 mt-1.5 font-mono">
                    rovacrew.com/
                    <span style={{ color: state.colour }}>
                      {state.slug || toSlug(state.name) || 'your-group'}
                    </span>
                  </p>
                </div>

                {/* Tagline */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Tagline
                    </label>
                    <span
                      className={`text-xs ${state.tagline.length > 50 ? 'text-amber-500' : 'text-gray-400'}`}
                    >
                      {state.tagline.length}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    value={state.tagline}
                    onChange={(e) =>
                      patch({ tagline: e.target.value.slice(0, 60) })
                    }
                    placeholder="A catchy one-liner for your group"
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
                  />
                </div>

                {/* Description */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <span
                      className={`text-xs ${state.description.length > 270 ? 'text-amber-500' : 'text-gray-400'}`}
                    >
                      {state.description.length}/300
                    </span>
                  </div>
                  <textarea
                    value={state.description}
                    onChange={(e) =>
                      patch({ description: e.target.value.slice(0, 300) })
                    }
                    placeholder="Tell people what your group is about..."
                    rows={4}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition resize-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Category <span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(({ label, emoji }) => {
                      const active = state.category === label
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => patch({ category: label })}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-medium transition-all duration-150 active:scale-95"
                          style={{
                            borderColor: active ? state.colour : '#E5E7EB',
                            backgroundColor: active ? state.colour : '#fff',
                            color: active ? '#fff' : '#4B5563',
                          }}
                        >
                          <span className="text-base leading-none">
                            {emoji}
                          </span>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Location
                  </label>
                  <input
                    type="text"
                    value={state.location}
                    onChange={(e) =>
                      patch({ location: e.target.value.slice(0, 100) })
                    }
                    placeholder="e.g. London, UK"
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
                  />
                </div>

                {/* Colour picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand colour
                  </label>
                  <div className="flex items-center gap-3 flex-wrap">
                    {PRESET_COLOURS.map((c) => {
                      const active =
                        state.colour.toUpperCase() === c.toUpperCase()
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            patch({ colour: c })
                            setCustomHex('')
                          }}
                          aria-label={`Select ${c}`}
                          className="relative w-9 h-9 rounded-full focus:outline-none transition-transform duration-150 hover:scale-110 active:scale-95 flex items-center justify-center"
                          style={{
                            backgroundColor: c,
                            boxShadow: active
                              ? `0 0 0 2.5px white, 0 0 0 4.5px ${c}`
                              : 'none',
                            transform: active ? 'scale(1.12)' : undefined,
                          }}
                        >
                          {active && (
                            <span className="text-white">
                              <CheckIcon />
                            </span>
                          )}
                        </button>
                      )
                    })}

                    {/* Custom hex */}
                    <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm">
                      <div
                        className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                        style={{
                          backgroundColor: state.colour,
                          transition: 'background-color 0.35s ease',
                        }}
                      />
                      <input
                        type="text"
                        value={customHex}
                        onChange={(e) => handleCustomHex(e.target.value)}
                        placeholder="#HEX"
                        maxLength={7}
                        className="w-16 text-sm font-mono text-gray-700 focus:outline-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo{' '}
                    <span className="text-gray-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <div className="flex items-center gap-4">
                    <div
                      onClick={() => logoRef.current?.click()}
                      className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-gray-400 transition-colors flex-shrink-0"
                      style={
                        logoPreview
                          ? { borderStyle: 'solid', borderColor: state.colour }
                          : {}
                      }
                    >
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg
                          className="w-6 h-6 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                          />
                        </svg>
                      )}
                    </div>
                    <input
                      ref={logoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) processLogo(f)
                      }}
                    />
                    <div className="text-sm text-gray-500">
                      <p>PNG, JPG or GIF. Square works best.</p>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoFile(null)
                            setLogoPreview(null)
                          }}
                          className="text-red-400 hover:text-red-600 text-xs mt-1"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="flex-1 py-3.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={loading}
                    className="flex-[2] py-3.5 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: state.colour }}
                  >
                    {loading ? (
                      <>
                        <Spinner className="w-4 h-4" />
                        Creating group...
                      </>
                    ) : (
                      'Create group'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STEP 3 — Migration Message
        ════════════════════════════════════════════════════════════════ */}
        {state.step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl"
                style={{ backgroundColor: state.colour + '15' }}
              >
                ✅
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {state.groupName} is live!
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                Share this message with your WhatsApp group to invite everyone
                over.
              </p>
            </div>

            {/* Migration message box */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suggested message for your WhatsApp group
              </label>
              <div
                className="rounded-xl p-4 text-sm text-gray-800 leading-relaxed"
                style={{ backgroundColor: state.colour + '08', border: `1px solid ${state.colour}25` }}
              >
                {migrationMessage}
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => copyToClipboard(migrationMessage)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <CopyIcon />
                  {copied ? 'Copied!' : 'Copy message'}
                </button>
                <a
                  href={whatsAppShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl text-white text-sm font-semibold text-center transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <WhatsAppIcon />
                  Share on WhatsApp
                </a>
              </div>
            </div>

            {/* Group link card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Your group link
              </p>
              <p className="text-sm font-mono text-gray-600 break-all">
                {groupUrl}
              </p>
            </div>

            {/* Next button */}
            <button
              type="button"
              onClick={() => goToStep(4)}
              className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-opacity hover:opacity-90"
              style={{ backgroundColor: state.colour }}
            >
              Next
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STEP 4 — First Event
        ════════════════════════════════════════════════════════════════ */}
        {state.step === 4 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl"
                style={{ backgroundColor: state.colour + '15' }}
              >
                📅
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Create your first event
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                Events are the heart of ROVA Crew. Create one now to give your
                members something to RSVP to.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="text-center space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Set up your first run, walk, meetup or social. It only takes
                    a minute.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    clearState()
                    router.push(
                      `/g/${state.groupSlug}/admin/events/new`
                    )
                  }}
                  className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ backgroundColor: state.colour }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Create an event
                </button>

                <button
                  type="button"
                  onClick={() => goToStep(5)}
                  className="w-full py-3 text-sm font-semibold transition-opacity hover:opacity-75"
                  style={{ color: state.colour }}
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STEP 5 — Celebration
        ════════════════════════════════════════════════════════════════ */}
        {state.step === 5 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl"
                style={{ backgroundColor: state.colour + '15' }}
              >
                🎉
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                You&apos;re all set!
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                Your group has been migrated to ROVA Crew. Welcome aboard.
              </p>
            </div>

            {/* Group preview card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100/60">
              <div
                className="h-20 w-full"
                style={{ backgroundColor: state.colour }}
              />
              <div className="px-5 pb-6">
                <div className="-mt-8 mb-4">
                  <div
                    className="w-16 h-16 rounded-2xl ring-4 ring-white shadow-lg flex items-center justify-center text-white font-black text-2xl overflow-hidden"
                    style={{ backgroundColor: state.colour }}
                  >
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoPreview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>
                        {(state.groupName?.[0] ?? 'G').toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 text-lg leading-snug">
                  {state.groupName}
                </h3>
                {state.tagline && (
                  <p className="text-gray-500 text-sm mt-0.5">{state.tagline}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {state.category && (
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{
                        backgroundColor: state.colour + '22',
                        color: state.colour,
                      }}
                    >
                      {state.category}
                    </span>
                  )}
                  {state.location && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                      {state.location}
                    </span>
                  )}
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                    Migrated from WhatsApp
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  clearState()
                  router.push(`/g/${state.groupSlug}`)
                }}
                className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-opacity hover:opacity-90"
                style={{ backgroundColor: state.colour }}
              >
                View your group
              </button>

              <button
                type="button"
                onClick={() => {
                  clearState()
                  router.push(`/g/${state.groupSlug}/admin`)
                }}
                className="w-full py-3.5 rounded-xl text-sm font-semibold border-2 transition-colors"
                style={{
                  borderColor: state.colour,
                  color: state.colour,
                }}
              >
                Admin dashboard
              </button>

              <button
                type="button"
                onClick={() => {
                  if (groupUrl) {
                    copyToClipboard(groupUrl)
                  }
                }}
                className="w-full py-3.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <CopyIcon />
                {copied ? 'Copied!' : 'Copy invite link'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
