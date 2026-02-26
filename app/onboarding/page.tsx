'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  fullName: string
  bio: string
  location: string
  interests: string[]
  avatarFile: File | null
  avatarPreview: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTERESTS = [
  { label: 'Running', emoji: '🏃' },
  { label: 'Cycling', emoji: '🚴' },
  { label: 'Walking & Hiking', emoji: '🥾' },
  { label: 'Yoga & Fitness', emoji: '🧘' },
  { label: 'Football & Sport', emoji: '⚽' },
  { label: 'Book Club', emoji: '📚' },
  { label: 'Social & Supper Club', emoji: '🍽️' },
  { label: 'Photography', emoji: '📷' },
  { label: 'Volunteering', emoji: '🤝' },
  { label: 'Dog Walking', emoji: '🐕' },
  { label: 'Knitting & Crafts', emoji: '🧶' },
  { label: 'Music', emoji: '🎵' },
  { label: 'Other', emoji: '✨' },
]

/** Map onboarding interest labels → group category values */
const INTEREST_TO_CATEGORY: Record<string, string> = {
  'Running': 'Running',
  'Cycling': 'Cycling',
  'Walking & Hiking': 'Walking',
  'Yoga & Fitness': 'Yoga',
  'Football & Sport': 'Football',
  'Book Club': 'Book Club',
  'Social & Supper Club': 'Social',
  'Photography': 'Photography',
  'Volunteering': 'Volunteer',
  'Dog Walking': 'Dog Walking',
  'Knitting & Crafts': 'Knitting',
  'Music': 'Other',
  'Other': 'Other',
}

interface SuggestedGroup {
  id: string
  name: string
  slug: string
  tagline: string | null
  category: string
  primaryColour: string
  memberCount: number
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CameraIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

// ─── Step 1: Profile ──────────────────────────────────────────────────────────

interface Step1Props {
  data: FormData
  onChange: (updates: Partial<FormData>) => void
  onContinue: () => void
}

function Step1Profile({ data, onChange, onContinue }: Step1Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const canContinue = data.fullName.trim().length > 0

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) =>
      onChange({ avatarFile: file, avatarPreview: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div className="px-5 pt-2 pb-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Your Profile</h1>
      <p className="text-gray-500 text-sm mb-8">Tell the crew a bit about yourself</p>

      {/* Avatar upload */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative w-28 h-28 rounded-full overflow-hidden focus:outline-none group"
            aria-label="Upload profile photo"
          >
            {data.avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.avatarPreview}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center group-hover:border-gray-300 group-hover:bg-gray-100 transition-colors">
                <UserIcon />
              </div>
            )}
          </button>

          {/* Camera badge */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0.5 right-0.5 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md ring-2 ring-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#0D7377' }}
            aria-label="Change photo"
          >
            <CameraIcon />
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Full name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            placeholder="Jane Smith"
            autoComplete="name"
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
          <textarea
            value={data.bio}
            onChange={(e) => onChange({ bio: e.target.value })}
            placeholder="Tell the community a bit about yourself..."
            rows={3}
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
          <input
            type="text"
            value={data.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="City or area (e.g. Brighton, South Coast)"
            autoComplete="address-level2"
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full mt-8 py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: '#0D7377' }}
      >
        Continue
      </button>
    </div>
  )
}

// ─── Step 2: Interests ────────────────────────────────────────────────────────

interface Step2Props {
  data: FormData
  onToggle: (label: string) => void
  onContinue: () => void
}

function Step2Interests({ data, onToggle, onContinue }: Step2Props) {
  const canContinue = data.interests.length > 0

  return (
    <div className="px-5 pt-2 pb-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">What brings you here?</h1>
      <p className="text-gray-500 text-sm mb-7">Pick all that apply</p>

      {/* Interest chips */}
      <div className="flex flex-wrap gap-2.5">
        {INTERESTS.map(({ label, emoji }) => {
          const selected = data.interests.includes(label)
          return (
            <button
              key={label}
              type="button"
              onClick={() => onToggle(label)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border-2 text-sm font-medium transition-all duration-150 active:scale-95"
              style={{
                borderColor: '#0D7377',
                backgroundColor: selected ? '#0D7377' : '#ffffff',
                color: selected ? '#ffffff' : '#0D7377',
              }}
            >
              <span className="text-base leading-none">{emoji}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Selection count */}
      <p
        className="text-xs mt-5 transition-opacity duration-200"
        style={{ color: '#0D7377', opacity: canContinue ? 1 : 0 }}
      >
        {data.interests.length} interest{data.interests.length !== 1 ? 's' : ''} selected
      </p>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full mt-6 py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: '#0D7377' }}
      >
        Continue
      </button>
    </div>
  )
}

// ─── Step 3: Find Your Crew ───────────────────────────────────────────────────

interface Step3Props {
  groups: SuggestedGroup[]
  groupsLoading: boolean
  loading: boolean
  onFinish: () => void
  onSkip: () => void
}

function Step3Groups({ groups, groupsLoading, loading, onFinish, onSkip }: Step3Props) {
  return (
    <div className="px-5 pt-2 pb-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Groups you might like</h1>
      <p className="text-gray-500 text-sm mb-7">Based on your interests</p>

      {/* Group cards */}
      <div className="space-y-3 mb-8">
        {groupsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : groups.length > 0 ? (
          groups.map((group) => (
            <a
              key={group.id}
              href={`/g/${group.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow"
            >
              {/* Left colour bar */}
              <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: group.primaryColour }} />

              {/* Card body */}
              <div className="flex-1 px-4 py-4 flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{group.name}</h3>
                  {group.tagline && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{group.tagline}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <UsersIcon />
                      {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                    </span>
                    <span
                      className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: group.primaryColour + '1a',
                        color: group.primaryColour,
                      }}
                    >
                      {group.category}
                    </span>
                  </div>
                </div>
              </div>
            </a>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">
              No groups match your interests yet.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              You can explore or start your own later.
            </p>
          </div>
        )}
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onFinish}
        disabled={loading}
        className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-opacity hover:opacity-90 disabled:opacity-60 mb-4 flex items-center justify-center gap-2"
        style={{ backgroundColor: '#0D7377' }}
      >
        {loading ? (
          <>
            <Spinner />
            Setting up your profile&hellip;
          </>
        ) : (
          "Let\u2019s go \u2192"
        )}
      </button>

      {/* Skip link */}
      <button
        type="button"
        onClick={onSkip}
        disabled={loading}
        className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-2 disabled:opacity-40"
      >
        Skip for now &mdash; explore on your own &rarr;
      </button>
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ─── Step names (for screen readers / labels) ─────────────────────────────────

const STEP_LABELS = ['Your Profile', 'Your Interests', 'Find Your Crew']

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [visible, setVisible] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    bio: '',
    location: '',
    interests: [],
    avatarFile: null,
    avatarPreview: null,
  })

  const [suggestedGroups, setSuggestedGroups] = useState<SuggestedGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)

  // Pre-fill full name from Supabase auth metadata
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const name = user?.user_metadata?.full_name as string | undefined
      if (name) {
        setFormData((prev) => ({ ...prev, fullName: prev.fullName || name }))
      }
    })
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateForm(updates: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  function toggleInterest(label: string) {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(label)
        ? prev.interests.filter((i) => i !== label)
        : [...prev.interests, label],
    }))
  }

  // Fade-out → swap step → fade-in
  async function goToStep(next: number) {
    setVisible(false)
    await new Promise((r) => setTimeout(r, 220))
    setStep(next)
    // Allow React to render the new step content before fading back in
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }

  async function goNext() {
    // When moving from step 2 → step 3, fetch real groups matching interests
    if (step === 2) {
      setGroupsLoading(true)
      const categories = formData.interests
        .map((i) => INTEREST_TO_CATEGORY[i])
        .filter((c): c is string => !!c)

      if (categories.length > 0) {
        try {
          const supabase = createClient()
          const uniqueCategories = [...new Set(categories)]
          const { data: groups } = await supabase
            .from('groups')
            .select('id, name, slug, tagline, category, primary_colour')
            .eq('is_public', true)
            .in('category', uniqueCategories)
            .limit(6)

          if (groups && groups.length > 0) {
            const groupIds = groups.map((g: { id: string }) => g.id)
            const { data: memberRows } = await supabase
              .from('group_members')
              .select('group_id')
              .in('group_id', groupIds)
              .eq('status', 'approved')

            const counts: Record<string, number> = {}
            for (const r of memberRows ?? []) {
              counts[r.group_id] = (counts[r.group_id] ?? 0) + 1
            }

            setSuggestedGroups(
              groups
                .map((g: { id: string; name: string; slug: string; tagline: string | null; category: string; primary_colour: string }) => ({
                  id: g.id,
                  name: g.name,
                  slug: g.slug,
                  tagline: g.tagline,
                  category: g.category,
                  primaryColour: g.primary_colour,
                  memberCount: counts[g.id] ?? 0,
                }))
                .sort((a: SuggestedGroup, b: SuggestedGroup) => b.memberCount - a.memberCount)
            )
          } else {
            setSuggestedGroups([])
          }
        } catch {
          setSuggestedGroups([])
        }
      } else {
        setSuggestedGroups([])
      }
      setGroupsLoading(false)
    }

    await goToStep(step + 1)
  }

  async function goBack() {
    await goToStep(step - 1)
  }

  // ── Save & redirect ────────────────────────────────────────────────────────

  async function finish() {
    setSaving(true)
    setSaveError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      let avatarUrl: string | null = null

      // Upload avatar to Supabase Storage
      if (formData.avatarFile) {
        const ext = formData.avatarFile.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`

        const { data: upload, error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, formData.avatarFile, { upsert: true })

        if (uploadErr) {
          // Non-fatal — proceed without avatar
          console.warn('[onboarding] avatar upload failed:', uploadErr.message)
        } else if (upload) {
          avatarUrl = supabase.storage.from('avatars').getPublicUrl(upload.path).data.publicUrl
        }
      }

      // Update profile row
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          bio: formData.bio || null,
          location: formData.location || null,
          interests: formData.interests,
          avatar_url: avatarUrl,
          onboarding_complete: true,
        })
        .eq('id', user.id)

      if (profileErr) throw profileErr

      window.location.href = '/home'
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const progressPct = Math.round((step / 3) * 100)

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ maxWidth: 520, margin: '0 auto' }}>

      {/* ── Sticky progress header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-5 pt-10 pb-4">
        {/* Row: back button + step label + percentage */}
        <div className="flex items-center gap-3 mb-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-40 flex-shrink-0"
              aria-label="Go back"
            >
              <ChevronLeftIcon />
            </button>
          ) : (
            // Placeholder so text stays centred
            <div className="w-9 h-9 flex-shrink-0" />
          )}

          <div className="flex-1 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {STEP_LABELS[step - 1]}
            </p>
          </div>

          <span
            className="text-xs font-bold flex-shrink-0 w-9 text-right"
            style={{ color: '#0D7377' }}
          >
            {progressPct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ backgroundColor: '#0D7377', width: `${progressPct}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-3">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="rounded-full transition-all duration-300"
              style={{
                width: s === step ? 20 : 6,
                height: 6,
                backgroundColor: s <= step ? '#0D7377' : '#E5E7EB',
              }}
            />
          ))}
        </div>
      </header>

      {/* ── Animated step content ──────────────────────────────────────────── */}
      <main
        className="flex-1 pt-6 transition-all duration-[220ms] ease-in-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
        }}
      >
        {step === 1 && (
          <Step1Profile data={formData} onChange={updateForm} onContinue={goNext} />
        )}
        {step === 2 && (
          <Step2Interests data={formData} onToggle={toggleInterest} onContinue={goNext} />
        )}
        {step === 3 && (
          <Step3Groups
            groups={suggestedGroups}
            groupsLoading={groupsLoading}
            loading={saving}
            onFinish={finish}
            onSkip={finish}
          />
        )}
      </main>

      {/* ── Save error banner ──────────────────────────────────────────────── */}
      {saveError && (
        <div className="px-5 pb-6">
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-red-600 text-sm">{saveError}</p>
          </div>
        </div>
      )}
    </div>
  )
}
