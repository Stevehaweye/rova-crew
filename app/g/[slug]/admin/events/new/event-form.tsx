'use client'

import { useState, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DayPicker } from 'react-day-picker'
import { format, differenceInMinutes, set } from 'date-fns'
import 'react-day-picker/style.css'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupProps {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  primaryColour: string
}

type EventType = 'free' | 'paid' | 'shared_cost'

interface EventFormData {
  title: string
  description: string
  eventType: EventType
  ticketPrice: string
  totalCost: string
  minParticipants: string
  startDate: Date | undefined
  startTime: string
  endDate: Date | undefined
  endTime: string
  locationName: string
  mapsUrl: string
  capacityEnabled: boolean
  capacity: string
  coverFile: File | null
  coverPreview: string | null
  membersOnly: boolean
  allowGuests: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_OPTIONS: string[] = []
for (let h = 6; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

const EVENT_TYPES: { key: EventType; emoji: string; label: string; desc: string }[] = [
  { key: 'free', emoji: '🎉', label: 'FREE', desc: 'No charge. Open to all members.' },
  { key: 'paid', emoji: '🎟️', label: 'PAID', desc: 'Set a ticket price per person.' },
  { key: 'shared_cost', emoji: '🤝', label: 'SHARED COST', desc: 'Split total cost equally. Price drops as people join.' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hex(c: string) {
  return c.startsWith('#') ? c : `#${c}`
}

function firstInitial(name: string) {
  return (name[0] ?? '?').toUpperCase()
}

function formatTime12(time24: string): string {
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  return set(date, { hours: h, minutes: m, seconds: 0, milliseconds: 0 })
}

function durationLabel(startDate: Date | undefined, startTime: string, endDate: Date | undefined, endTime: string): string | null {
  if (!startDate || !startTime || !endDate || !endTime) return null
  const start = combineDateAndTime(startDate, startTime)
  const end = combineDateAndTime(endDate, endTime)
  const mins = differenceInMinutes(end, start)
  if (mins <= 0) return null
  const hours = Math.floor(mins / 60)
  const remaining = mins % 60
  if (hours === 0) return `${remaining} min`
  if (remaining === 0) return `${hours} hour${hours > 1 ? 's' : ''}`
  return `${hours}h ${remaining}m`
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

function MapPinIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
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

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────

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
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
  disabled?: boolean
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
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className="relative flex-shrink-0 w-12 h-6 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0D7377] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
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

// ─── Event Type Card ──────────────────────────────────────────────────────────

function EventTypeCard({
  emoji,
  label,
  desc,
  active,
  colour,
  onClick,
}: {
  emoji: string
  label: string
  desc: string
  active: boolean
  colour: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-[140px] rounded-2xl border-2 p-5 text-left transition-all duration-200 hover:shadow-md active:scale-[0.98]"
      style={{
        borderColor: active ? colour : '#E5E7EB',
        backgroundColor: active ? colour + '0A' : '#fff',
        boxShadow: active ? `0 0 0 1px ${colour}40` : undefined,
      }}
    >
      <span className="text-3xl block mb-3">{emoji}</span>
      <p
        className="text-sm font-black tracking-wide"
        style={{ color: active ? colour : '#374151' }}
      >
        {label}
      </p>
      <p className="text-xs text-gray-500 mt-1 leading-snug">{desc}</p>
      {active && (
        <div
          className="mt-3 w-6 h-1 rounded-full"
          style={{ backgroundColor: colour }}
        />
      )}
    </button>
  )
}

// ─── Date Picker Wrapper ──────────────────────────────────────────────────────

function DatePickerField({
  label,
  required,
  selectedDate,
  onSelect,
  selectedTime,
  onTimeChange,
  colour,
  error,
}: {
  label: string
  required?: boolean
  selectedDate: Date | undefined
  onSelect: (d: Date | undefined) => void
  selectedTime: string
  onTimeChange: (t: string) => void
  colour: string
  error?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="flex gap-3">
        {/* Date button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center gap-2 px-4 py-3.5 rounded-xl border text-sm transition-colors"
          style={{
            borderColor: open ? colour : '#E5E7EB',
            backgroundColor: open ? colour + '05' : '#fff',
          }}
        >
          <CalendarIcon />
          <span className={selectedDate ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {selectedDate ? format(selectedDate, 'EEE d MMM yyyy') : 'Select date'}
          </span>
        </button>

        {/* Time select */}
        <select
          value={selectedTime}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-28 px-3 py-3.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent"
        >
          <option value="">Time</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {formatTime12(t)}
            </option>
          ))}
        </select>
      </div>

      {open && (
        <div className="mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg p-3 inline-block">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              onSelect(d)
              setOpen(false)
            }}
            disabled={{ before: new Date() }}
            style={{ '--rdp-accent-color': colour } as React.CSSProperties}
          />
        </div>
      )}
      <FieldError msg={error} />
    </div>
  )
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function LivePreview({
  form,
  group,
}: {
  form: EventFormData
  group: GroupProps
}) {
  const colour = hex(group.primaryColour)
  const displayTitle = form.title || 'Your event title'

  const dateStr =
    form.startDate && form.startTime
      ? format(form.startDate, 'EEEE d MMMM') + ' · ' + formatTime12(form.startTime)
      : 'Date & time'

  const duration = durationLabel(form.startDate, form.startTime, form.endDate, form.endTime)

  const typeChip = {
    free: { bg: '#059669', label: 'FREE' },
    paid: { bg: '#D97706', label: 'PAID' },
    shared_cost: { bg: '#2563EB', label: 'SHARED COST' },
  }[form.eventType]

  const capacityText = form.capacityEnabled && form.capacity
    ? `${form.capacity} spots available`
    : 'Unlimited'

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

      {/* Event card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100/60">
        {/* Cover / colour banner */}
        {form.coverPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverPreview} alt="" className="w-full h-36 object-cover" />
        ) : (
          <div
            className="h-20 w-full"
            style={{ backgroundColor: colour, transition: 'background-color 0.35s ease' }}
          />
        )}

        <div className="px-5 pb-5 pt-4">
          {/* Event type chip */}
          <span
            className="inline-block text-[10px] font-black tracking-wider text-white px-2.5 py-1 rounded-full mb-3"
            style={{ backgroundColor: typeChip.bg }}
          >
            {typeChip.label}
          </span>

          <h3 className="font-bold text-gray-900 text-lg leading-snug">
            {displayTitle}
          </h3>

          {/* Group identity */}
          <div className="flex items-center gap-2 mt-3">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: colour }}
            >
              {group.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                firstInitial(group.name)
              )}
            </div>
            <span className="text-xs text-gray-500 font-medium">{group.name}</span>
          </div>

          {/* Meta rows */}
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarIcon />
              <span>{dateStr}</span>
              {duration && (
                <span className="text-xs text-gray-400 ml-1">({duration})</span>
              )}
            </div>

            {form.locationName && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPinIcon />
                <span>{form.locationName}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UsersIcon />
              <span>{capacityText}</span>
            </div>
          </div>

          {/* RSVP count */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-400">0 going</span>
            <span
              className="text-xs font-bold px-4 py-2 rounded-full text-white"
              style={{ backgroundColor: colour }}
            >
              RSVP
            </span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <ul className="mt-5 space-y-2">
        {[
          'Events appear on your group profile page',
          'Members get notified when you create an event',
          'You can edit or cancel events from the admin panel',
        ].map((tip) => (
          <li key={tip} className="flex items-start gap-2">
            <span
              className="mt-1 w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: colour + '22' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: colour }}
              />
            </span>
            <p className="text-xs text-gray-400 leading-snug">{tip}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Main Form Component ──────────────────────────────────────────────────────

export default function EventForm({
  group,
  userId,
}: {
  group: GroupProps
  userId: string
}) {
  const router = useRouter()
  const coverRef = useRef<HTMLInputElement>(null)
  const colour = hex(group.primaryColour)

  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<EventFormData>({
    title: '',
    description: '',
    eventType: 'free',
    ticketPrice: '',
    totalCost: '',
    minParticipants: '',
    startDate: undefined,
    startTime: '',
    endDate: undefined,
    endTime: '',
    locationName: '',
    mapsUrl: '',
    capacityEnabled: false,
    capacity: '',
    coverFile: null,
    coverPreview: null,
    membersOnly: true,
    allowGuests: true,
  })

  function patch(updates: Partial<EventFormData>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  // ── Auto-set end date/time when start changes ───────────────────────────────

  function handleStartDateChange(d: Date | undefined) {
    const updates: Partial<EventFormData> = { startDate: d }
    if (d && !form.endDate) updates.endDate = d
    patch(updates)
  }

  function handleStartTimeChange(t: string) {
    const updates: Partial<EventFormData> = { startTime: t }
    if (t && !form.endTime) {
      const [h, m] = t.split(':').map(Number)
      const endH = h + 2
      if (endH < 24) {
        updates.endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
      if (!form.endDate && form.startDate) {
        updates.endDate = form.startDate
      }
    }
    patch(updates)
  }

  // ── Cover image handlers ────────────────────────────────────────────────────

  function processCover(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) =>
      patch({ coverFile: file, coverPreview: e.target?.result as string })
    reader.readAsDataURL(file)
  }

  function handleCoverDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processCover(file)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'Event title is required.'
    if (!form.startDate || !form.startTime) errs.start = 'Start date and time are required.'
    if (!form.endDate || !form.endTime) errs.end = 'End date and time are required.'

    if (form.startDate && form.startTime && form.endDate && form.endTime) {
      const start = combineDateAndTime(form.startDate, form.startTime)
      const end = combineDateAndTime(form.endDate, form.endTime)
      if (end <= start) errs.end = 'End time must be after start time.'
    }

    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)

    try {
      const supabase = createClient()

      // Upload cover image
      let coverUrl: string | null = null
      if (form.coverFile) {
        const ext = form.coverFile.name.split('.').pop() ?? 'jpg'
        const path = `events/${group.slug}/${Date.now()}.${ext}`
        const { data: upload, error: uploadErr } = await supabase.storage
          .from('group-logos')
          .upload(path, form.coverFile, { upsert: true })
        if (uploadErr) {
          throw new Error(`Image upload failed: ${uploadErr.message}`)
        } else if (upload) {
          coverUrl = supabase.storage
            .from('group-logos')
            .getPublicUrl(upload.path).data.publicUrl
        }
      }

      const startsAt = combineDateAndTime(form.startDate!, form.startTime).toISOString()
      const endsAt = combineDateAndTime(form.endDate!, form.endTime).toISOString()

      const { error: eventErr } = await supabase
        .from('events')
        .insert({
          group_id: group.id,
          created_by: userId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          location: form.locationName.trim() || null,
          starts_at: startsAt,
          ends_at: endsAt,
          cover_url: coverUrl,
          max_capacity: form.capacityEnabled && form.capacity ? parseInt(form.capacity) : null,
        })
        .select('id')
        .single()

      if (eventErr) throw eventErr

      router.push(`/g/${group.slug}/admin`)
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Something went wrong. Please try again.'
      console.error('[events/new] submit error:', err)
      setErrors({ submit: message })
      setSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link
            href={`/g/${group.slug}/admin`}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="Back to admin"
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
          <span className="text-sm font-semibold text-gray-600">Create event</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-20">

        {/* Page heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create an event</h1>
          <p className="text-gray-500 mt-1.5 text-sm">
            Schedule a meetup, session, or social for <strong>{group.name}</strong>.
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-16 xl:gap-20 lg:items-start">

          {/* ══════════ FORM ══════════ */}
          <form onSubmit={handleSubmit} noValidate>

            {/* ── Section 01: Event Basics ──────────────────────────── */}
            <SectionHeader n="01" title="Event Basics" sub="What kind of event is this?" />

            <div className="space-y-6">
              {/* Title */}
              <div>
                <FieldLabel required>Event title</FieldLabel>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => {
                    patch({ title: e.target.value })
                    if (errors.title) setErrors((prev) => ({ ...prev, title: '' }))
                  }}
                  placeholder="Give your event a great name..."
                  className={[
                    'w-full px-4 py-4 rounded-xl border text-gray-900 text-lg font-semibold placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition',
                    errors.title ? 'border-red-300 bg-red-50/50' : 'border-gray-200',
                  ].join(' ')}
                />
                <FieldError msg={errors.title} />
              </div>

              {/* Event type cards */}
              <div>
                <FieldLabel>Event type</FieldLabel>
                <div className="flex gap-3 flex-wrap">
                  {EVENT_TYPES.map((t) => (
                    <EventTypeCard
                      key={t.key}
                      emoji={t.emoji}
                      label={t.label}
                      desc={t.desc}
                      active={form.eventType === t.key}
                      colour={colour}
                      onClick={() => patch({ eventType: t.key })}
                    />
                  ))}
                </div>
              </div>

              {/* Conditional: PAID fields */}
              {form.eventType === 'paid' && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 space-y-4">
                  <div>
                    <FieldLabel>Ticket price</FieldLabel>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">£</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.ticketPrice}
                        onChange={(e) => patch({ ticketPrice: e.target.value })}
                        placeholder="0.00"
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-amber-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 flex items-center gap-1.5">
                    <span>🔒</span> Stripe payment setup coming in Week 3. For now, this will save as free.
                  </p>
                </div>
              )}

              {/* Conditional: SHARED COST fields */}
              {form.eventType === 'shared_cost' && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Total cost</FieldLabel>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">£</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.totalCost}
                          onChange={(e) => patch({ totalCost: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 rounded-xl border border-blue-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Min. participants</FieldLabel>
                      <input
                        type="number"
                        min="2"
                        value={form.minParticipants}
                        onChange={(e) => patch({ minParticipants: e.target.value })}
                        placeholder="e.g. 5"
                        className="w-full px-4 py-3 rounded-xl border border-blue-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                  {form.totalCost && form.minParticipants && (
                    <p className="text-sm text-blue-700 font-medium">
                      ≈ £{(parseFloat(form.totalCost) / parseInt(form.minParticipants)).toFixed(2)} per person (with {form.minParticipants} people)
                    </p>
                  )}
                  <p className="text-xs text-blue-700 flex items-center gap-1.5">
                    <span>🔒</span> Stripe payment setup coming in Week 3. For now, this will save as free.
                  </p>
                </div>
              )}
            </div>

            <Divider />

            {/* ── Section 02: Date & Time ───────────────────────────── */}
            <SectionHeader n="02" title="Date & Time" sub="When is it happening?" />

            <div className="space-y-6">
              <DatePickerField
                label="Start"
                required
                selectedDate={form.startDate}
                onSelect={handleStartDateChange}
                selectedTime={form.startTime}
                onTimeChange={handleStartTimeChange}
                colour={colour}
                error={errors.start}
              />

              <DatePickerField
                label="End"
                required
                selectedDate={form.endDate}
                onSelect={(d) => patch({ endDate: d })}
                selectedTime={form.endTime}
                onTimeChange={(t) => patch({ endTime: t })}
                colour={colour}
                error={errors.end}
              />

              {/* Duration helper */}
              {(() => {
                const d = durationLabel(form.startDate, form.startTime, form.endDate, form.endTime)
                return d ? (
                  <p className="text-sm font-medium" style={{ color: colour }}>
                    Duration: {d}
                  </p>
                ) : null
              })()}

              {/* Recurring — disabled */}
              <div className="flex items-center gap-3 opacity-50 cursor-not-allowed">
                <input type="checkbox" disabled className="rounded" />
                <span className="text-sm text-gray-500">This is a recurring event</span>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">
                  Coming soon
                </span>
              </div>
            </div>

            <Divider />

            {/* ── Section 03: Location ──────────────────────────────── */}
            <SectionHeader n="03" title="Location" sub="Where should people meet?" />

            <div className="space-y-4">
              <div>
                <FieldLabel>Location name</FieldLabel>
                <input
                  type="text"
                  value={form.locationName}
                  onChange={(e) => patch({ locationName: e.target.value })}
                  placeholder="Where is this happening?"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
                />
              </div>

              <div>
                <FieldLabel>Google Maps link</FieldLabel>
                <input
                  type="url"
                  value={form.mapsUrl}
                  onChange={(e) => patch({ mapsUrl: e.target.value })}
                  placeholder="Paste a Google Maps URL"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
                />
                {form.mapsUrl && /^https?:\/\//.test(form.mapsUrl) && (
                  <a
                    href={form.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold mt-2 transition-opacity hover:opacity-75"
                    style={{ color: colour }}
                  >
                    <MapPinIcon /> Preview map &rarr;
                  </a>
                )}
              </div>
            </div>

            <Divider />

            {/* ── Section 04: Details ───────────────────────────────── */}
            <SectionHeader n="04" title="Details" sub="Describe the event and set limits" />

            <div className="space-y-6">
              {/* Description */}
              <div>
                <div className="flex justify-between items-baseline mb-1.5">
                  <FieldLabel>Description</FieldLabel>
                  <span
                    className={`text-xs ${form.description.length > 450 ? 'text-amber-500' : 'text-gray-400'}`}
                  >
                    {form.description.length}/500
                  </span>
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value.slice(0, 500) })}
                  placeholder="Tell people what to expect, what to bring, and why they should come..."
                  rows={5}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition resize-none"
                />
              </div>

              {/* Capacity */}
              <div>
                <FieldLabel>Capacity</FieldLabel>
                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => patch({ capacityEnabled: false, capacity: '' })}
                    className="px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                    style={{
                      borderColor: !form.capacityEnabled ? colour : '#E5E7EB',
                      backgroundColor: !form.capacityEnabled ? colour + '0A' : '#fff',
                      color: !form.capacityEnabled ? colour : '#6B7280',
                    }}
                  >
                    No limit
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ capacityEnabled: true })}
                    className="px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                    style={{
                      borderColor: form.capacityEnabled ? colour : '#E5E7EB',
                      backgroundColor: form.capacityEnabled ? colour + '0A' : '#fff',
                      color: form.capacityEnabled ? colour : '#6B7280',
                    }}
                  >
                    Set limit
                  </button>
                </div>
                {form.capacityEnabled && (
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      value={form.capacity}
                      onChange={(e) => patch({ capacity: e.target.value })}
                      placeholder="e.g. 30"
                      className="w-32 px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent"
                    />
                    <span className="text-sm text-gray-400">spots</span>
                    {form.capacity && (
                      <span className="text-sm font-medium" style={{ color: colour }}>
                        0 / {form.capacity} taken
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Cover image */}
              <div>
                <FieldLabel>Cover image</FieldLabel>
                <div className="flex items-center gap-6">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleCoverDrop}
                    onClick={() => coverRef.current?.click()}
                    className="relative w-full h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-200"
                    style={{
                      borderColor: dragOver ? colour : '#D1D5DB',
                      backgroundColor: dragOver ? colour + '10' : '#F9FAFB',
                    }}
                  >
                    {form.coverPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.coverPreview} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <UploadIcon />
                        <span className="text-xs text-gray-400 mt-2">
                          Drop an image or click to upload
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    ref={coverRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) processCover(f)
                    }}
                  />
                </div>
                {form.coverPreview && (
                  <button
                    type="button"
                    onClick={() => patch({ coverFile: null, coverPreview: null })}
                    className="text-red-400 hover:text-red-600 text-xs transition-colors mt-2"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>

            <Divider />

            {/* ── Section 05: Visibility ────────────────────────────── */}
            <SectionHeader n="05" title="Visibility" sub="Who can see and RSVP?" />

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 divide-y divide-gray-100">
              <Toggle
                checked={form.membersOnly}
                onChange={(v) => patch({ membersOnly: v })}
                label="Members only"
                description="Only approved group members can see and RSVP to this event."
              />
              <Toggle
                checked={form.allowGuests}
                onChange={(v) => patch({ allowGuests: v })}
                label="Allow guest RSVPs"
                description="Guests RSVP with just a name and email — no account required."
              />
            </div>

            {/* ── Submit ─────────────────────────────────────────────── */}
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
                style={{ backgroundColor: colour, transition: 'background-color 0.35s ease, opacity 0.2s ease' }}
              >
                {submitting ? (
                  <>
                    <Spinner />
                    Creating event&hellip;
                  </>
                ) : (
                  'Create event →'
                )}
              </button>

              <p className="text-center text-xs text-gray-400 mt-3">
                You can edit or cancel this event from the admin panel after creation.
              </p>
            </div>

            {/* Mobile preview */}
            <div className="mt-14 lg:hidden">
              <div className="border-t border-gray-200 pt-10">
                <LivePreview form={form} group={group} />
              </div>
            </div>
          </form>

          {/* ══════════ DESKTOP STICKY PREVIEW ══════════ */}
          <div className="hidden lg:block lg:sticky lg:top-28">
            <LivePreview form={form} group={group} />
          </div>
        </div>
      </main>
    </div>
  )
}
