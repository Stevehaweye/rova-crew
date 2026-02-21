'use client'

import { useState, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLOURS = [
  '#0D7377',
  '#C9982A',
  '#DC2626',
  '#7C3AED',
  '#2563EB',
  '#059669',
  '#F59E0B',
  '#374151',
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

interface GroupForm {
  name: string
  slug: string
  tagline: string
  category: string
  description: string
  logoFile: File | null
  logoPreview: string | null
  colour: string
  isPublic: boolean
  requireApproval: boolean
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────

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

function sanitiseSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-/, '')
    .slice(0, 50)
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Reusable micro-components ────────────────────────────────────────────────

function SectionHeader({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 mb-7">
      <span
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white mt-0.5"
        style={{ backgroundColor: '#0D7377' }}
      >
        {n}
      </span>
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-gray-100 my-10" />
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-red-500 text-xs mt-1.5">{msg}</p>
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-sm text-gray-500 mt-0.5 leading-snug">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 w-12 h-6 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0D7377] transition-colors duration-200"
        style={{ backgroundColor: checked ? '#0D7377' : '#D1D5DB' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
          style={{ transform: checked ? 'translateX(24px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function LivePreview({ form }: { form: GroupForm }) {
  const displayName = form.name || 'Your Group Name'
  const displayTagline = form.tagline || 'A tagline for your community'
  const initial = (form.name[0] ?? 'G').toUpperCase()
  const c = form.colour

  return (
    <div>
      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Live preview
        </span>
      </div>

      {/* Group card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100/60">
        {/* Hero banner */}
        <div
          className="h-20 w-full"
          style={{ backgroundColor: c, transition: 'background-color 0.35s ease' }}
        />

        <div className="px-5 pb-6">
          {/* Logo overlapping banner */}
          <div className="-mt-8 mb-4">
            <div
              className="w-16 h-16 rounded-2xl ring-4 ring-white shadow-lg flex items-center justify-center text-white font-black text-2xl overflow-hidden"
              style={{ backgroundColor: c, transition: 'background-color 0.35s ease' }}
            >
              {form.logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{initial}</span>
              )}
            </div>
          </div>

          <h3 className="font-bold text-gray-900 text-lg leading-snug truncate">
            {displayName}
          </h3>
          <p className="text-gray-500 text-sm mt-0.5 leading-snug line-clamp-2">
            {displayTagline}
          </p>

          {/* Chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {form.category && (
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  backgroundColor: c + '22',
                  color: c,
                  transition: 'background-color 0.35s ease, color 0.35s ease',
                }}
              >
                {form.category}
              </span>
            )}
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium flex items-center gap-1">
              {form.isPublic ? <><GlobeIcon /> Public</> : <><LockIcon /> Private</>}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
              1 member
            </span>
          </div>
        </div>
      </div>

      {/* URL card */}
      <div className="mt-4 px-4 py-3.5 bg-white rounded-xl border border-gray-200 shadow-sm">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          Group URL
        </p>
        <p className="text-sm font-mono text-gray-600">
          rovacrew.com/
          <span style={{ color: c, transition: 'color 0.35s ease' }}>
            {form.slug || 'your-group'}
          </span>
        </p>
      </div>

      {/* Tips */}
      <ul className="mt-5 space-y-2">
        {[
          'Colour updates reflect across all group pages',
          'A great tagline attracts the right members',
          'Everything can be changed from the admin panel',
        ].map((tip) => (
          <li key={tip} className="flex items-start gap-2">
            <span
              className="mt-1 w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: c + '22' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: c, transition: 'background-color 0.35s ease' }}
              />
            </span>
            <p className="text-xs text-gray-400 leading-snug">{tip}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Migrate placeholder ──────────────────────────────────────────────────────

function MigratePlaceholder() {
  return (
    <div className="max-w-lg mx-auto text-center py-20 px-6">
      <div className="text-7xl mb-6 select-none">📱</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        AI Migration — Coming in Week 6
      </h2>
      <p className="text-gray-500 leading-relaxed">
        We&apos;re building an AI-powered tool to automatically import your WhatsApp group
        history, member list, and files into ROVA Crew — with zero manual work.
      </p>
      <div
        className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
        style={{ backgroundColor: '#0D7377' + '15', color: '#0D7377' }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: '#0D7377' }}
        />
        Coming soon
      </div>
      <div className="mt-10">
        <button
          type="button"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          onClick={() => window.history.back()}
        >
          ← Go back
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewGroupPage() {
  const router = useRouter()
  const logoRef = useRef<HTMLInputElement>(null)
  const slugInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'fresh' | 'migrate'>('fresh')
  const [slugManual, setSlugManual] = useState(false)
  const [slugEditing, setSlugEditing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [customHex, setCustomHex] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<GroupForm>({
    name: '',
    slug: '',
    tagline: '',
    category: '',
    description: '',
    logoFile: null,
    logoPreview: null,
    colour: '#0D7377',
    isPublic: true,
    requireApproval: false,
  })

  // ── Patch helper ──────────────────────────────────────────────────────────

  function patch(updates: Partial<GroupForm>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  // ── Field handlers ────────────────────────────────────────────────────────

  function handleNameChange(name: string) {
    patch({ name, slug: slugManual ? form.slug : toSlug(name) })
    if (errors.name) setErrors((e) => ({ ...e, name: '' }))
  }

  function handleSlugChange(value: string) {
    setSlugManual(true)
    patch({ slug: sanitiseSlug(value) })
    if (errors.slug) setErrors((e) => ({ ...e, slug: '' }))
  }

  function handleCustomHex(value: string) {
    setCustomHex(value)
    const clean = value.startsWith('#') ? value : `#${value}`
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      patch({ colour: clean.toUpperCase() })
    }
  }

  function selectPreset(c: string) {
    patch({ colour: c })
    setCustomHex('')
  }

  // ── Logo handlers ─────────────────────────────────────────────────────────

  function processLogo(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) =>
      patch({ logoFile: file, logoPreview: e.target?.result as string })
    reader.readAsDataURL(file)
  }

  function handleLogoDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processLogo(file)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Group name is required.'
    if (!form.category) errs.category = 'Please select a category.'
    if (!form.slug) errs.slug = 'A group URL is required.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)

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
        .eq('slug', form.slug)

      if (count && count > 0) {
        setErrors({ slug: 'This URL is already taken — try a different name.' })
        setSubmitting(false)
        return
      }

      // Upload logo
      let logoUrl: string | null = null
      if (form.logoFile) {
        const ext = form.logoFile.name.split('.').pop() ?? 'jpg'
        const path = `${form.slug}/${Date.now()}.${ext}`
        const { data: upload, error: uploadErr } = await supabase.storage
          .from('group-logos')
          .upload(path, form.logoFile, { upsert: true })
        if (uploadErr) {
          throw new Error(`Logo upload failed: ${uploadErr.message}`)
        } else if (upload) {
          logoUrl = supabase.storage
            .from('group-logos')
            .getPublicUrl(upload.path).data.publicUrl
        }
      }

      // Insert group
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .insert({
          name: form.name.trim(),
          slug: form.slug,
          tagline: form.tagline.trim() || null,
          description: form.description.trim() || null,
          category: form.category,
          logo_url: logoUrl,
          primary_colour: form.colour.replace('#', ''),
          is_public: form.isPublic,
          join_approval_required: form.requireApproval,
          created_by: user.id,
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

      // Initialise member_stats row
      await supabase.from('member_stats').insert({
        user_id: user.id,
        group_id: group.id,
      })

      router.push(`/g/${group.slug}/admin`)
    } catch (err: unknown) {
      const message =
        (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string')
          ? (err as { message: string }).message
          : 'Something went wrong. Please try again.'
      console.error('[groups/new] submit error:', err)
      setErrors({ submit: message })
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link
            href="/home"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft />
          </Link>
          <Link href="/home" className="select-none">
            <span className="text-lg font-black tracking-[0.14em]" style={{ color: '#0D7377' }}>
              ROVA
            </span>
            <span className="text-lg font-black tracking-[0.14em]" style={{ color: '#C9982A' }}>
              CREW
            </span>
          </Link>
          <span className="text-gray-300 text-lg">·</span>
          <span className="text-sm font-semibold text-gray-600">Create a group</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-20">

        {/* Page heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Start your community</h1>
          <p className="text-gray-500 mt-1.5 text-sm">
            Launch in under 3 minutes. You can edit everything later.
          </p>
        </div>

        {/* ── Entry tabs ─────────────────────────────────────────────────── */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-10 max-w-xs">
          {(['fresh', 'migrate'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                'flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
                tab === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {t === 'fresh' ? '✨ Start fresh' : '📱 Migrate'}
            </button>
          ))}
        </div>

        {tab === 'migrate' ? (
          <MigratePlaceholder />
        ) : (
          <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-16 xl:gap-20 lg:items-start">

            {/* ════════════════════════════════════════════════════════════
                FORM
            ════════════════════════════════════════════════════════════ */}
            <form onSubmit={handleSubmit} noValidate>

              {/* ── Section 01: Identity ─────────────────────────────── */}
              <SectionHeader n="01" title="Identity" sub="The basics of your community" />

              <div className="space-y-6">

                {/* Group name + slug */}
                <div>
                  <FieldLabel required>Group name</FieldLabel>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Brighton Running Crew"
                    className={[
                      'w-full px-4 py-3.5 rounded-xl border text-gray-900 text-base font-medium placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition',
                      errors.name ? 'border-red-300 bg-red-50/50' : 'border-gray-200',
                    ].join(' ')}
                  />
                  <FieldError msg={errors.name} />

                  {/* Slug row */}
                  <div className="flex items-center gap-1.5 mt-2.5 text-sm min-w-0">
                    <span className="text-gray-400 font-mono flex-shrink-0">
                      rovacrew.com/
                    </span>
                    {slugEditing ? (
                      <input
                        ref={slugInputRef}
                        type="text"
                        value={form.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        onBlur={() => setSlugEditing(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            setSlugEditing(false)
                          }
                        }}
                        autoFocus
                        className="flex-1 min-w-0 px-2 py-0.5 rounded-lg border border-[#0D7377]/40 bg-[#0D7377]/5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#0D7377]"
                        style={{ color: '#0D7377' }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSlugEditing(true)
                          setTimeout(() => slugInputRef.current?.select(), 10)
                        }}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-gray-100 transition-colors group min-w-0"
                      >
                        <span
                          className="font-mono truncate"
                          style={{ color: '#0D7377' }}
                        >
                          {form.slug || 'your-group-name'}
                        </span>
                        <span className="text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0">
                          <PencilIcon />
                        </span>
                      </button>
                    )}
                  </div>
                  <FieldError msg={errors.slug} />
                </div>

                {/* Tagline */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <FieldLabel>Tagline</FieldLabel>
                    <span
                      className={`text-xs ${
                        form.tagline.length > 50 ? 'text-amber-500' : 'text-gray-400'
                      }`}
                    >
                      {form.tagline.length}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={(e) => patch({ tagline: e.target.value.slice(0, 60) })}
                    placeholder="One line that sells your community"
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
                  />
                </div>

                {/* Category */}
                <div>
                  <FieldLabel required>Category</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(({ label, emoji }) => {
                      const active = form.category === label
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            patch({ category: label })
                            setErrors((e) => ({ ...e, category: '' }))
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-medium transition-all duration-150 active:scale-95"
                          style={{
                            borderColor: active ? form.colour : '#E5E7EB',
                            backgroundColor: active ? form.colour : '#fff',
                            color: active ? '#fff' : '#4B5563',
                          }}
                        >
                          <span className="text-base leading-none">{emoji}</span>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <FieldError msg={errors.category} />
                </div>

                {/* Description */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <FieldLabel>Description</FieldLabel>
                    <span
                      className={`text-xs ${
                        form.description.length > 270 ? 'text-amber-500' : 'text-gray-400'
                      }`}
                    >
                      {form.description.length}/300
                    </span>
                  </div>
                  <textarea
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value.slice(0, 300) })}
                    placeholder="Tell potential members what your group is about, who it's for, and what to expect..."
                    rows={4}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition resize-none"
                  />
                </div>
              </div>

              <Divider />

              {/* ── Section 02: Appearance ───────────────────────────── */}
              <SectionHeader n="02" title="Appearance" sub="Make it feel like yours" />

              <div className="space-y-8">

                {/* Logo upload */}
                <div>
                  <FieldLabel>Logo</FieldLabel>
                  <div className="flex items-center gap-6">
                    {/* Drop zone */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleLogoDrop}
                      onClick={() => logoRef.current?.click()}
                      className="relative w-24 h-24 rounded-full border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-200 flex-shrink-0"
                      style={{
                        borderColor: dragOver ? form.colour : '#D1D5DB',
                        backgroundColor: dragOver ? form.colour + '10' : '#F9FAFB',
                        transform: dragOver ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      {form.logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.logoPreview}
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <UploadIcon />
                          <span className="text-[10px] text-gray-400 mt-1 text-center leading-tight px-2">
                            Drop or click
                          </span>
                        </>
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

                    {/* Logo meta */}
                    <div className="text-sm text-gray-500 space-y-1">
                      <p className="font-medium text-gray-700">Upload a logo</p>
                      <p>PNG, JPG or GIF</p>
                      <p>Square works best</p>
                      {form.logoPreview && (
                        <button
                          type="button"
                          onClick={() => patch({ logoFile: null, logoPreview: null })}
                          className="text-red-400 hover:text-red-600 text-xs transition-colors mt-1"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Colour picker */}
                <div>
                  <FieldLabel>Brand colour</FieldLabel>
                  <div className="flex items-center gap-3 flex-wrap">
                    {PRESET_COLOURS.map((c) => {
                      const active = form.colour.toUpperCase() === c.toUpperCase()
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => selectPreset(c)}
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

                    {/* Custom hex input */}
                    <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm">
                      <div
                        className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                        style={{
                          backgroundColor: form.colour,
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

                  {/* Current colour label */}
                  <p className="text-xs text-gray-400 mt-2.5 font-mono">
                    Selected:{' '}
                    <span style={{ color: form.colour }}>{form.colour}</span>
                  </p>
                </div>
              </div>

              <Divider />

              {/* ── Section 03: Settings ─────────────────────────────── */}
              <SectionHeader n="03" title="Settings" sub="Privacy and access controls" />

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 divide-y divide-gray-100">
                <Toggle
                  checked={form.isPublic}
                  onChange={(v) => patch({ isPublic: v })}
                  label="Public group"
                  description="Public groups appear in discovery and can be found by anyone searching ROVA Crew."
                />
                <Toggle
                  checked={form.requireApproval}
                  onChange={(v) => patch({ requireApproval: v })}
                  label="Require approval to join"
                  description="New members must be approved by an admin before they can access group content."
                />
              </div>

              {/* ── Submit ───────────────────────────────────────────── */}
              <div className="mt-10">
                {errors.submit && (
                  <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                    <p className="text-red-600 text-sm">{errors.submit}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-xl text-white font-bold text-base tracking-wide transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2.5"
                  style={{ backgroundColor: form.colour, transition: 'background-color 0.35s ease, opacity 0.2s ease' }}
                >
                  {submitting ? (
                    <>
                      <Spinner />
                      Creating your group&hellip;
                    </>
                  ) : (
                    'Create my group →'
                  )}
                </button>

                <p className="text-center text-xs text-gray-400 mt-3">
                  You can edit all of this from the admin panel after creation.
                </p>
              </div>

              {/* Mobile preview — below form */}
              <div className="mt-14 lg:hidden">
                <div className="border-t border-gray-200 pt-10">
                  <LivePreview form={form} />
                </div>
              </div>
            </form>

            {/* ════════════════════════════════════════════════════════════
                DESKTOP STICKY PREVIEW
            ════════════════════════════════════════════════════════════ */}
            <div className="hidden lg:block lg:sticky lg:top-28">
              <LivePreview form={form} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
