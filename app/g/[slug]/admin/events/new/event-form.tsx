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
  hasStripeAccount: boolean
}

type StripeScenario = 'none' | 'incomplete' | 'not_enabled' | 'ready'

type PaymentType = 'free' | 'fixed' | 'shared_cost'

interface EventFormData {
  title: string
  description: string
  paymentType: PaymentType
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
  plusOnesAllowed: boolean
  maxPlusOnesPerMember: string
  plusOnesCountTowardCapacity: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_OPTIONS: string[] = []
for (let h = 6; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

const PAYMENT_TYPES: { key: PaymentType; label: string; sub: string }[] = [
  { key: 'free', label: 'Free', sub: 'No payment required to RSVP' },
  { key: 'fixed', label: 'Paid ticket', sub: 'Each person pays a set price' },
  { key: 'shared_cost', label: 'Split the cost', sub: 'Total cost divided equally among attendees' },
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

function GiftIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  )
}

function TicketIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  )
}

function UsersGroupIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  )
}

function StripeLinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
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

// ─── Payment Type Card ───────────────────────────────────────────────────────

const PAYMENT_ICONS: Record<PaymentType, (props: { className?: string }) => React.ReactElement> = {
  free: GiftIcon,
  fixed: TicketIcon,
  shared_cost: UsersGroupIcon,
}

function PaymentTypeCard({
  type,
  label,
  sub,
  active,
  colour,
  onClick,
}: {
  type: PaymentType
  label: string
  sub: string
  active: boolean
  colour: string
  onClick: () => void
}) {
  const Icon = PAYMENT_ICONS[type]
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-[140px] rounded-2xl border-2 p-5 text-left transition-all duration-200 hover:shadow-md active:scale-[0.98]"
      style={{
        borderColor: active ? colour : '#E5E7EB',
        backgroundColor: active ? colour + '08' : '#fff',
        boxShadow: active ? `0 0 0 1px ${colour}40` : undefined,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: active ? colour + '18' : '#F3F4F6' }}
      >
        <Icon className={`w-5 h-5 ${active ? '' : 'text-gray-400'}`} />
      </div>
      <p
        className="text-sm font-bold"
        style={{ color: active ? colour : '#374151' }}
      >
        {label}
      </p>
      <p className="text-xs text-gray-500 mt-1 leading-snug">{sub}</p>
      {active && (
        <div className="mt-3 flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: colour }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colour }} />
          </div>
          <span className="text-[10px] font-semibold" style={{ color: colour }}>Selected</span>
        </div>
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
    fixed: { bg: '#D97706', label: form.ticketPrice ? `£${parseFloat(form.ticketPrice).toFixed(2)}` : 'PAID' },
    shared_cost: { bg: '#2563EB', label: 'SPLIT COST' },
  }[form.paymentType]

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
  eventId,
  initialData,
  stripeScenario = 'none',
}: {
  group: GroupProps
  userId: string
  eventId?: string
  initialData?: Partial<EventFormData> & { existingCoverUrl?: string | null }
  stripeScenario?: StripeScenario
}) {
  const isEditMode = !!eventId
  const router = useRouter()
  const coverRef = useRef<HTMLInputElement>(null)
  const colour = hex(group.primaryColour)

  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [currentStripeScenario, setCurrentStripeScenario] = useState(stripeScenario)
  const [enablingPayments, setEnablingPayments] = useState(false)

  const [form, setForm] = useState<EventFormData>({
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    paymentType: initialData?.paymentType ?? 'free',
    ticketPrice: initialData?.ticketPrice ?? '',
    totalCost: initialData?.totalCost ?? '',
    minParticipants: initialData?.minParticipants ?? '',
    startDate: initialData?.startDate,
    startTime: initialData?.startTime ?? '',
    endDate: initialData?.endDate,
    endTime: initialData?.endTime ?? '',
    locationName: initialData?.locationName ?? '',
    mapsUrl: initialData?.mapsUrl ?? '',
    capacityEnabled: initialData?.capacityEnabled ?? false,
    capacity: initialData?.capacity ?? '',
    coverFile: null,
    coverPreview: initialData?.existingCoverUrl ?? null,
    membersOnly: initialData?.membersOnly ?? true,
    allowGuests: initialData?.allowGuests ?? true,
    plusOnesAllowed: initialData?.plusOnesAllowed ?? true,
    maxPlusOnesPerMember: initialData?.maxPlusOnesPerMember ?? '3',
    plusOnesCountTowardCapacity: initialData?.plusOnesCountTowardCapacity ?? true,
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

    if (form.paymentType === 'fixed') {
      const price = parseFloat(form.ticketPrice)
      if (!form.ticketPrice || isNaN(price) || price < 1) {
        errs.ticketPrice = 'Price must be at least £1.00.'
      }
    }

    if (form.paymentType === 'shared_cost') {
      const cost = parseFloat(form.totalCost)
      if (!form.totalCost || isNaN(cost) || cost <= 0) {
        errs.totalCost = 'Total cost must be greater than 0.'
      }
      const minP = parseInt(form.minParticipants)
      if (!form.minParticipants || isNaN(minP) || minP < 2) {
        errs.minParticipants = 'Minimum participants must be at least 2.'
      }
    }

    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)

    try {
      const supabase = createClient()

      // Upload cover image (only if user selected a new file)
      let coverUrl: string | null = initialData?.existingCoverUrl ?? null
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
      } else if (!form.coverPreview) {
        // User removed the cover image
        coverUrl = null
      }

      const startsAt = combineDateAndTime(form.startDate!, form.startTime).toISOString()
      const endsAt = combineDateAndTime(form.endDate!, form.endTime).toISOString()

      const eventPayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.locationName.trim() || null,
        maps_url: form.mapsUrl.trim() || null,
        starts_at: startsAt,
        ends_at: endsAt,
        cover_url: coverUrl,
        max_capacity: form.capacityEnabled && form.capacity ? parseInt(form.capacity) : null,
        payment_type: form.paymentType,
        price_pence: form.paymentType === 'fixed' ? Math.round(parseFloat(form.ticketPrice) * 100) : null,
        total_cost_pence: form.paymentType === 'shared_cost' ? Math.round(parseFloat(form.totalCost) * 100) : null,
        min_participants: form.paymentType === 'shared_cost' ? parseInt(form.minParticipants) : null,
        allow_guest_rsvp: form.allowGuests,
        plus_ones_allowed: form.plusOnesAllowed,
        max_plus_ones_per_member: form.plusOnesAllowed ? parseInt(form.maxPlusOnesPerMember) || 3 : 3,
        plus_ones_count_toward_capacity: form.plusOnesCountTowardCapacity,
      }

      let resultEventId: string

      if (isEditMode) {
        // Update existing event via API (service client bypasses RLS)
        const updateRes = await fetch(`/api/events/${eventId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventPayload),
        })
        const updateData = await updateRes.json()
        if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update event')
        resultEventId = eventId
      } else {
        // Create new event via API (service client bypasses RLS)
        const createRes = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: group.id,
            ...eventPayload,
          }),
        })
        const createData = await createRes.json()
        if (!createRes.ok) throw new Error(createData.error || 'Failed to create event')
        resultEventId = createData.eventId

      }

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
          <span className="text-sm font-semibold text-gray-600">{isEditMode ? 'Edit event' : 'Create event'}</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-20">

        {/* Page heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit event' : 'Create an event'}</h1>
          <p className="text-gray-500 mt-1.5 text-sm">
            {isEditMode
              ? <>Update the details for this event.</>
              : <>Schedule a meetup, session, or social for <strong>{group.name}</strong>.</>
            }
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-16 xl:gap-20 lg:items-start">

          {/* ══════════ FORM ══════════ */}
          <form onSubmit={handleSubmit} noValidate>

            {/* ── Section 01: Event Basics ──────────────────────────── */}
            <SectionHeader n="01" title="Event Basics" sub="Give your event a name" />

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

            <Divider />

            {/* ── Section 02: Payment ────────────────────────────────── */}
            <SectionHeader n="02" title="Payment" sub="How will attendees pay?" />

            <div className="space-y-6">
              {/* Payment type cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PAYMENT_TYPES.map((t) => (
                  <PaymentTypeCard
                    key={t.key}
                    type={t.key}
                    label={t.label}
                    sub={t.sub}
                    active={form.paymentType === t.key}
                    colour={colour}
                    onClick={() => patch({ paymentType: t.key })}
                  />
                ))}
              </div>

              {/* Stripe status banners */}
              {form.paymentType !== 'free' && currentStripeScenario === 'none' && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TicketIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900">To create paid events, connect your bank account first</p>
                    <p className="text-xs text-amber-700 mt-0.5">You only need to do this once — works across all your groups.</p>
                    <Link
                      href="/settings/payments"
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-200/60 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Set up payments (takes 5 minutes) &rarr;
                    </Link>
                  </div>
                </div>
              )}

              {form.paymentType !== 'free' && currentStripeScenario === 'incomplete' && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TicketIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900">Your payment setup is incomplete</p>
                    <p className="text-xs text-amber-700 mt-0.5">Complete your Stripe onboarding to enable paid events.</p>
                    <Link
                      href="/settings/payments"
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-200/60 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Complete setup &rarr;
                    </Link>
                  </div>
                </div>
              )}

              {form.paymentType !== 'free' && currentStripeScenario === 'not_enabled' && (
                <div className="rounded-xl border border-teal-300 bg-teal-50 p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TicketIcon className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-teal-900">Payments are not yet enabled for this group</p>
                    <p className="text-xs text-teal-700 mt-0.5">Your Stripe account is ready. Enable payments for this group to create paid events.</p>
                    <button
                      type="button"
                      disabled={enablingPayments}
                      onClick={async () => {
                        setEnablingPayments(true)
                        try {
                          const res = await fetch(`/api/groups/${group.slug}/settings`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ payments_enabled: true, payment_admin_id: userId }),
                          })
                          if (res.ok) {
                            setCurrentStripeScenario('ready')
                          }
                        } catch (err) {
                          console.error('[event-form] enable payments error:', err)
                        }
                        setEnablingPayments(false)
                      }}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-200/60 hover:bg-teal-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                    >
                      {enablingPayments ? 'Enabling...' : 'Enable payments for this group'}
                    </button>
                  </div>
                </div>
              )}

              {/* Conditional: FIXED PRICE fields */}
              {form.paymentType === 'fixed' && (
                <div className="bg-amber-50/60 rounded-xl border border-amber-200 p-5 space-y-4">
                  <div>
                    <FieldLabel required>Price per person (GBP)</FieldLabel>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">£</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1.00"
                        value={form.ticketPrice}
                        onChange={(e) => {
                          patch({ ticketPrice: e.target.value })
                          if (errors.ticketPrice) setErrors((prev) => ({ ...prev, ticketPrice: '' }))
                        }}
                        placeholder="0.00"
                        className={`w-full pl-8 pr-4 py-3 rounded-xl border text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent ${errors.ticketPrice ? 'border-red-300 bg-red-50/50' : 'border-amber-200'}`}
                      />
                    </div>
                    <FieldError msg={errors.ticketPrice} />
                  </div>
                  {/* Live net estimate */}
                  {(() => {
                    const gross = parseFloat(form.ticketPrice)
                    if (isNaN(gross) || gross < 1) return null
                    const grossPence = Math.round(gross * 100)
                    const stripeFee = Math.round(grossPence * 0.014) + 20
                    const platformFee = Math.max(Math.round(grossPence * 0.05), 30)
                    const netPence = grossPence - stripeFee - platformFee
                    if (netPence <= 0) return null
                    return (
                      <div className="bg-white/70 rounded-lg border border-amber-100 px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-amber-800">You&apos;ll receive approx.</span>
                        <span className="text-lg font-bold text-amber-900">
                          &pound;{(netPence / 100).toFixed(2)}
                        </span>
                      </div>
                    )
                  })()}

                  <p className="text-xs text-amber-700 leading-relaxed">
                    Please note: Stripe processing fees and ROVA&apos;s 5% platform fee
                    are deducted at payment. You will receive the net amount.
                  </p>
                </div>
              )}

              {/* Conditional: SHARED COST fields */}
              {form.paymentType === 'shared_cost' && (
                <div className="bg-blue-50/60 rounded-xl border border-blue-200 p-5 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel required>Total cost (GBP)</FieldLabel>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">£</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.totalCost}
                          onChange={(e) => {
                            patch({ totalCost: e.target.value })
                            if (errors.totalCost) setErrors((prev) => ({ ...prev, totalCost: '' }))
                          }}
                          placeholder="e.g. 60.00"
                          className={`w-full pl-8 pr-4 py-3 rounded-xl border text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${errors.totalCost ? 'border-red-300 bg-red-50/50' : 'border-blue-200'}`}
                        />
                      </div>
                      <FieldError msg={errors.totalCost} />
                    </div>
                    <div>
                      <FieldLabel required>Min. participants</FieldLabel>
                      <input
                        type="number"
                        min="2"
                        value={form.minParticipants}
                        onChange={(e) => {
                          patch({ minParticipants: e.target.value })
                          if (errors.minParticipants) setErrors((prev) => ({ ...prev, minParticipants: '' }))
                        }}
                        placeholder="e.g. 4"
                        className={`w-full px-4 py-3 rounded-xl border text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${errors.minParticipants ? 'border-red-300 bg-red-50/50' : 'border-blue-200'}`}
                      />
                      <FieldError msg={errors.minParticipants} />
                    </div>
                  </div>

                  {/* Live price preview */}
                  {form.totalCost && form.minParticipants && (() => {
                    const total = parseFloat(form.totalCost)
                    const min = parseInt(form.minParticipants)
                    if (isNaN(total) || isNaN(min) || min < 2 || total <= 0) return null
                    const cap = form.capacityEnabled && form.capacity ? parseInt(form.capacity) : null
                    const exampleCounts = [min, Math.ceil(min * 1.5), cap ?? min * 2].filter(
                      (v, i, a) => v >= min && a.indexOf(v) === i
                    ).slice(0, 3)
                    return (
                      <div className="bg-white/70 rounded-lg border border-blue-100 p-3.5 space-y-1.5">
                        <p className="text-xs font-semibold text-blue-800 mb-2">Price preview</p>
                        {exampleCounts.map((n) => (
                          <p key={n} className="text-sm text-blue-700">
                            If <span className="font-bold">{n}</span> people RSVP:{' '}
                            <span className="font-bold">£{(total / n).toFixed(2)}</span> each
                          </p>
                        ))}
                      </div>
                    )
                  })()}

                  <p className="text-xs text-blue-700">
                    Price per person drops as more people RSVP. No upfront payment required.
                  </p>
                </div>
              )}
            </div>

            <Divider />

            {/* ── Section 03: Date & Time ───────────────────────────── */}
            <SectionHeader n="03" title="Date & Time" sub="When is it happening?" />

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

            {/* ── Section 04: Location ──────────────────────────────── */}
            <SectionHeader n="04" title="Location" sub="Where should people meet?" />

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

            {/* ── Section 05: Details ───────────────────────────────── */}
            <SectionHeader n="05" title="Details" sub="Describe the event and set limits" />

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

            {/* ── Section 06: Visibility ────────────────────────────── */}
            <SectionHeader n="06" title="Visibility" sub="Who can see and RSVP?" />

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

            <Divider />

            {/* ── Section 07: Guest Plus-Ones ────────────────────────── */}
            <SectionHeader n="07" title="Guest Plus-Ones" sub="Let members bring friends" />

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 divide-y divide-gray-100">
              <Toggle
                checked={form.plusOnesAllowed}
                onChange={(v) => patch({ plusOnesAllowed: v })}
                label="Allow guest plus-ones"
                description="Members can bring friends who aren't on the platform."
              />
              {form.plusOnesAllowed && (
                <>
                  <div className="py-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">Max guests per member</label>
                    <p className="text-sm text-gray-500 mb-3">How many plus-ones can each member bring?</p>
                    <div className="flex gap-2">
                      {['1', '2', '3', '4', '5'].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => patch({ maxPlusOnesPerMember: n })}
                          className="w-10 h-10 rounded-xl font-bold text-sm transition-all"
                          style={
                            form.maxPlusOnesPerMember === n
                              ? { backgroundColor: colour, color: '#fff' }
                              : { backgroundColor: '#F3F4F6', color: '#4B5563' }
                          }
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Toggle
                    checked={form.plusOnesCountTowardCapacity}
                    onChange={(v) => patch({ plusOnesCountTowardCapacity: v })}
                    label="Guests count toward capacity"
                    description="When enabled, plus-one guests are included in the event capacity limit."
                  />
                </>
              )}
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
                    {isEditMode ? 'Saving changes\u2026' : 'Creating event\u2026'}
                  </>
                ) : (
                  isEditMode ? 'Save changes' : 'Create event \u2192'
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
