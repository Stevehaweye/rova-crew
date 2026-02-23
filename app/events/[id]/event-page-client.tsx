'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

const EventChat = dynamic(() => import('@/components/EventChat'), {
  loading: () => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="flex items-center justify-center h-[300px] sm:h-[400px]">
        <svg className="w-5 h-5 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    </div>
  ),
  ssr: false,
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventData {
  id: string
  title: string
  description: string | null
  location: string | null
  startsAt: string
  endsAt: string
  coverUrl: string | null
  maxCapacity: number | null
  createdBy: string
}

interface GroupData {
  name: string
  slug: string
  logoUrl: string | null
  primaryColour: string
}

interface MemberRsvp {
  id: string
  userId: string
  status: 'going' | 'maybe'
  createdAt: string
  profile: { full_name: string; avatar_url: string | null }
}

interface GuestRsvp {
  id: string
  name: string
  status: 'going' | 'maybe'
  createdAt: string
}

type RsvpStatus = 'idle' | 'loading' | 'going' | 'maybe' | 'not_going' | 'error'
type GuestRsvpStatus = 'idle' | 'loading' | 'done' | 'already_rsvped' | 'error'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface CurrentUserProfile {
  id: string
  fullName: string
  avatarUrl: string | null
}

interface Props {
  event: EventData
  group: GroupData
  initialMemberRsvps: MemberRsvp[]
  initialGuestRsvps: GuestRsvp[]
  totalGoingCount: number
  currentUser: CurrentUserProfile | null
  currentUserRsvp: { id: string; status: 'going' | 'maybe' | 'not_going' } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hex(c: string) {
  return c.startsWith('#') ? c : `#${c}`
}

function firstInitial(name: string) {
  return (name[0] ?? '?').toUpperCase()
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
    </svg>
  )
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero({
  event,
  group,
  colour,
}: {
  event: EventData
  group: GroupData
  colour: string
}) {
  return (
    <section className="relative h-64 sm:h-80 overflow-hidden">
      {event.coverUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ backgroundColor: colour }} />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.28) 100%)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </>
      )}

      {/* Nav */}
      <div className="absolute top-0 left-0 right-0 z-10 px-5 sm:px-10 pt-5 flex items-center justify-between">
        <Link href={`/g/${group.slug}`} className="select-none">
          <span className="text-base font-black tracking-[0.14em] text-white/90 drop-shadow">ROVA</span>
          <span className="text-base font-black tracking-[0.14em] drop-shadow" style={{ color: '#C9982A' }}>CREW</span>
        </Link>
        <Link
          href={`/g/${group.slug}`}
          className="text-white/70 hover:text-white text-xs font-semibold transition-colors drop-shadow"
        >
          &larr; {group.name}
        </Link>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-10 pb-6 max-w-5xl">
        {/* Group identity */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0 ring-2 ring-white/20"
            style={{ backgroundColor: colour + 'cc' }}
          >
            {group.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              firstInitial(group.name)
            )}
          </div>
          <span className="text-white/70 text-sm font-medium drop-shadow">{group.name}</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight tracking-tight drop-shadow-lg">
          {event.title}
        </h1>
      </div>
    </section>
  )
}

// ─── Info Bar ────────────────────────────────────────────────────────────────

function InfoBar({
  event,
  colour,
  goingCount,
}: {
  event: EventData
  colour: string
  goingCount: number
}) {
  const startDate = new Date(event.startsAt)
  const endDate = new Date(event.endsAt)
  const dateStr = format(startDate, 'EEEE d MMMM')
  const timeStr = `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`

  return (
    <div className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-5 sm:px-10 py-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarIcon />
            <div>
              <span className="font-semibold text-gray-900">{dateStr}</span>
              <span className="text-gray-400 mx-1.5">·</span>
              <span>{timeStr}</span>
            </div>
          </div>

          {event.location && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MapPinIcon />
              <span>{event.location}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <UsersIcon />
            <span>
              <strong className="text-gray-900">{goingCount}</strong> going
              {event.maxCapacity && (
                <span className="text-gray-400"> / {event.maxCapacity}</span>
              )}
            </span>
          </div>

          <span
            className="px-3 py-1 rounded-full text-[10px] font-black tracking-wider text-white"
            style={{ backgroundColor: '#059669' }}
          >
            FREE
          </span>
        </div>

        {/* Capacity bar */}
        {event.maxCapacity && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((goingCount / event.maxCapacity) * 100, 100)}%`,
                  backgroundColor: colour,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {Math.max(event.maxCapacity - goingCount, 0)} spot{event.maxCapacity - goingCount !== 1 ? 's' : ''} remaining
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Social Snowball ─────────────────────────────────────────────────────────

function SocialSnowball({
  memberRsvps,
  guestRsvps,
  goingCount,
  colour,
}: {
  memberRsvps: MemberRsvp[]
  guestRsvps: GuestRsvp[]
  goingCount: number
  colour: string
}) {
  const maxVisible = 8
  const allRsvps = [
    ...memberRsvps.map((r) => ({
      id: r.id,
      name: r.profile.full_name,
      avatarUrl: r.profile.avatar_url,
      status: r.status,
      isGuest: false,
    })),
    ...guestRsvps.map((r) => ({
      id: r.id,
      name: r.name,
      avatarUrl: null as string | null,
      status: r.status,
      isGuest: true,
    })),
  ]
  const visible = allRsvps.slice(0, maxVisible)
  const overflow = Math.max(goingCount - maxVisible, 0)

  const goingOnly = allRsvps.filter((r) => r.status === 'going').length
  const maybeOnly = allRsvps.filter((r) => r.status === 'maybe').length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Who&apos;s coming</h3>

      {visible.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          No RSVPs yet. Be the first!
        </p>
      ) : (
        <>
          {/* Avatar bubbles */}
          <div className="flex items-center -space-x-2 mb-4">
            {visible.map((r) => (
              <div
                key={r.id}
                className="relative w-10 h-10 rounded-full ring-2 ring-white overflow-hidden flex-shrink-0 transition-transform duration-300"
                title={r.name}
              >
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatarUrl} alt={r.name} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: r.isGuest ? '#6B7280' : colour }}
                  >
                    {initials(r.name)}
                  </div>
                )}
              </div>
            ))}
            {overflow > 0 && (
              <div className="w-10 h-10 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-gray-500">+{overflow}</span>
              </div>
            )}
          </div>

          {/* Name list with Guest chips */}
          <div className="space-y-2 mb-4">
            {visible.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 truncate">{r.name}</span>
                {r.isGuest && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                    Guest
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Counts */}
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-gray-900">{goingOnly} going</span>
            {maybeOnly > 0 && (
              <span className="text-gray-400">{maybeOnly} maybe</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── RSVP Card (Member) ─────────────────────────────────────────────────────

function RsvpCard({
  event,
  colour,
  currentUser,
  rsvpStatus,
  onRsvp,
  guestStatus,
  guestName,
  guestEmail,
  onGuestNameChange,
  onGuestEmailChange,
  onGuestRsvp,
  guestError,
  guestFieldErrors,
}: {
  event: EventData
  colour: string
  currentUser: { id: string } | null
  rsvpStatus: RsvpStatus
  onRsvp: (status: 'going' | 'maybe' | 'not_going') => void
  guestStatus: GuestRsvpStatus
  guestName: string
  guestEmail: string
  onGuestNameChange: (v: string) => void
  onGuestEmailChange: (v: string) => void
  onGuestRsvp: () => void
  guestError: string
  guestFieldErrors: { name?: string; email?: string }
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-1">RSVP</h3>
      <p className="text-xs text-gray-400 mb-4">
        {format(new Date(event.startsAt), 'EEE d MMM · h:mm a')}
      </p>

      {/* Logged-in member RSVP */}
      {currentUser ? (
        <div className="space-y-2.5">
          {(['going', 'maybe', 'not_going'] as const).map((status) => {
            const active = rsvpStatus === status
            const label = status === 'going' ? "I'm going" : status === 'maybe' ? 'Maybe' : "Can't make it"
            const emoji = status === 'going' ? '🎉' : status === 'maybe' ? '🤔' : '😢'

            return (
              <button
                key={status}
                onClick={() => onRsvp(status)}
                disabled={rsvpStatus === 'loading'}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 disabled:opacity-50"
                style={{
                  borderColor: active ? colour : '#E5E7EB',
                  backgroundColor: active ? colour + '0A' : '#fff',
                  color: active ? colour : '#374151',
                }}
              >
                {rsvpStatus === 'loading' ? (
                  <Spinner />
                ) : active ? (
                  <CheckIcon />
                ) : (
                  <span className="text-base">{emoji}</span>
                )}
                {label}
              </button>
            )
          })}

          {rsvpStatus === 'error' && (
            <p className="text-red-500 text-xs mt-1">Something went wrong. Try again.</p>
          )}
        </div>
      ) : (
        /* Guest RSVP form */
        <div className="space-y-3">
          {guestStatus === 'done' ? (
            <div className="text-center py-5">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#059669' }}>
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" style={{ strokeDasharray: 30, strokeDashoffset: 0, transition: 'stroke-dashoffset 0.55s cubic-bezier(0.65, 0, 0.35, 1) 0.1s' }} />
                </svg>
              </div>
              <p className="font-bold text-gray-900 text-sm">You&apos;re on the list, {guestName.split(' ')[0]}!</p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Check your email — your confirmation and check-in QR code are on their way.
              </p>
            </div>
          ) : guestStatus === 'already_rsvped' ? (
            <div className="text-center py-5">
              <div className="text-3xl mb-2">📬</div>
              <p className="font-bold text-gray-900 text-sm">You&apos;ve already RSVPed!</p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Check your inbox for the confirmation email with your QR code.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                RSVP as a guest — no account needed.
              </p>
              <div>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => onGuestNameChange(e.target.value)}
                  placeholder="Your name"
                  className={`w-full px-3.5 py-3 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${guestFieldErrors.name ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}
                  style={{ '--tw-ring-color': colour } as React.CSSProperties}
                />
                {guestFieldErrors.name && (
                  <p className="text-red-500 text-xs mt-1">{guestFieldErrors.name}</p>
                )}
              </div>
              <div>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => onGuestEmailChange(e.target.value)}
                  placeholder="Email address"
                  className={`w-full px-3.5 py-3 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${guestFieldErrors.email ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}
                  style={{ '--tw-ring-color': colour } as React.CSSProperties}
                />
                {guestFieldErrors.email && (
                  <p className="text-red-500 text-xs mt-1">{guestFieldErrors.email}</p>
                )}
              </div>
              <button
                onClick={onGuestRsvp}
                disabled={guestStatus === 'loading'}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: colour }}
              >
                {guestStatus === 'loading' ? (
                  <><Spinner /> Sending confirmation&hellip;</>
                ) : (
                  "Count me in \u2192"
                )}
              </button>
              {guestError && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2">
                  <p className="text-red-600 text-xs">{guestError}</p>
                </div>
              )}
              <p className="text-[11px] text-gray-400 text-center">
                Already have an account?{' '}
                <Link href={`/auth?next=/events/${event.id}`} className="font-semibold" style={{ color: colour }}>
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Share Button ────────────────────────────────────────────────────────────

function ShareButton({ eventId, title, colour }: { eventId: string; title: string; colour: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/events/${eventId}`

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className="fixed bottom-24 right-5 lg:static lg:inline-flex items-center gap-2 w-12 h-12 lg:w-auto lg:h-auto lg:px-4 lg:py-2.5 rounded-full lg:rounded-xl shadow-lg lg:shadow-sm text-white text-sm font-semibold transition-all hover:opacity-90 flex justify-center z-20"
      style={{ backgroundColor: colour }}
    >
      {copied ? <CheckIcon /> : <ShareIcon />}
      <span className="hidden lg:inline">{copied ? 'Copied!' : 'Share'}</span>
    </button>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EventPageClient({
  event,
  group,
  initialMemberRsvps,
  initialGuestRsvps,
  totalGoingCount,
  currentUser,
  currentUserRsvp,
}: Props) {
  const router = useRouter()
  const colour = hex(group.primaryColour)

  // ── State ──────────────────────────────────────────────────────────────────

  const [memberRsvps, setMemberRsvps] = useState<MemberRsvp[]>(initialMemberRsvps)
  const [guestRsvps, setGuestRsvps] = useState<GuestRsvp[]>(initialGuestRsvps)
  const [goingCount, setGoingCount] = useState(totalGoingCount)

  // Member RSVP state
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>(
    currentUserRsvp ? currentUserRsvp.status : 'idle'
  )

  // Guest RSVP state
  const [guestRsvpState, setGuestRsvpState] = useState<GuestRsvpStatus>('idle')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestError, setGuestError] = useState('')
  const [guestFieldErrors, setGuestFieldErrors] = useState<{ name?: string; email?: string }>({})

  // ── Supabase Realtime ──────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`event-${event.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rsvps', filter: `event_id=eq.${event.id}` },
        async (payload) => {
          const newRsvp = payload.new as { id: string; user_id: string; status: string; created_at: string }
          if (newRsvp.status === 'going' || newRsvp.status === 'maybe') {
            // Fetch profile for this user
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', newRsvp.user_id)
              .maybeSingle()

            const rsvp: MemberRsvp = {
              id: newRsvp.id,
              userId: newRsvp.user_id,
              status: newRsvp.status as 'going' | 'maybe',
              createdAt: newRsvp.created_at,
              profile: profile ?? { full_name: 'Member', avatar_url: null },
            }

            setMemberRsvps((prev) => {
              if (prev.some((r) => r.id === rsvp.id || r.userId === rsvp.userId)) return prev
              return [...prev, rsvp]
            })
            setGoingCount((c) => c + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guest_rsvps', filter: `event_id=eq.${event.id}` },
        (payload) => {
          const newGuest = payload.new as { id: string; name: string; status: string; created_at: string }
          if (newGuest.status === 'going' || newGuest.status === 'maybe') {
            const rsvp: GuestRsvp = {
              id: newGuest.id,
              name: newGuest.name,
              status: newGuest.status as 'going' | 'maybe',
              createdAt: newGuest.created_at,
            }
            setGuestRsvps((prev) => {
              if (prev.some((r) => r.id === rsvp.id)) return prev
              return [...prev, rsvp]
            })
            setGoingCount((c) => c + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [event.id])

  // ── RSVP handler (member) ──────────────────────────────────────────────────

  async function handleMemberRsvp(status: 'going' | 'maybe' | 'not_going') {
    if (!currentUser) {
      router.push(`/auth?next=/events/${event.id}`)
      return
    }

    if (rsvpStatus === status) return // Already selected
    setRsvpStatus('loading')

    const supabase = createClient()

    const { error } = await supabase
      .from('rsvps')
      .upsert(
        { event_id: event.id, user_id: currentUser.id, status },
        { onConflict: 'event_id,user_id' }
      )

    if (error) {
      console.error('[rsvp] error:', error)
      setRsvpStatus('error')
      return
    }

    // Optimistic update: add/update this user in the Who's Going list
    if (status === 'going' || status === 'maybe') {
      setMemberRsvps((prev) => {
        const existing = prev.find((r) => r.userId === currentUser.id)
        if (existing) {
          return prev.map((r) => r.userId === currentUser.id ? { ...r, status } : r)
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            userId: currentUser.id,
            status,
            createdAt: new Date().toISOString(),
            profile: { full_name: currentUser.fullName, avatar_url: currentUser.avatarUrl },
          },
        ]
      })
      // Update going count if transitioning to going/maybe from idle or not_going
      if (rsvpStatus === 'idle' || rsvpStatus === 'not_going') {
        setGoingCount((c) => c + 1)
      }
    } else if (status === 'not_going') {
      setMemberRsvps((prev) => prev.filter((r) => r.userId !== currentUser.id))
      if (rsvpStatus !== 'idle' && rsvpStatus !== 'not_going' && rsvpStatus !== 'error') {
        setGoingCount((c) => Math.max(c - 1, 0))
      }
    }

    setRsvpStatus(status)
    router.refresh()
  }

  // ── Guest RSVP handler ─────────────────────────────────────────────────────

  async function handleGuestRsvp() {
    // Client-side validation
    const fieldErrs: { name?: string; email?: string } = {}
    if (!guestName.trim() || guestName.trim().length < 2) {
      fieldErrs.name = 'Name is required (min 2 characters).'
    }
    if (!guestEmail.trim() || !EMAIL_RE.test(guestEmail.trim())) {
      fieldErrs.email = 'Please enter a valid email address.'
    }
    setGuestFieldErrors(fieldErrs)
    if (Object.keys(fieldErrs).length > 0) return

    setGuestRsvpState('loading')
    setGuestError('')

    try {
      const res = await fetch(`/api/events/${event.id}/guest-rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestName.trim(), email: guestEmail.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setGuestError(data.error ?? 'Something went wrong. Please try again.')
        setGuestRsvpState('error')
        return
      }

      if (data.alreadyRsvped) {
        setGuestRsvpState('already_rsvped')
        return
      }

      // Optimistic update: add guest to the Who's Going list immediately
      const optimisticGuest: GuestRsvp = {
        id: data.guestRsvpId ?? crypto.randomUUID(),
        name: guestName.trim(),
        status: 'going',
        createdAt: new Date().toISOString(),
      }
      setGuestRsvps((prev) => {
        if (prev.some((r) => r.id === optimisticGuest.id)) return prev
        return [...prev, optimisticGuest]
      })
      setGoingCount((c) => c + 1)
      setGuestRsvpState('done')
    } catch (err) {
      console.error('[guest_rsvp] error:', err)
      setGuestError('Something went wrong. Please try again.')
      setGuestRsvpState('error')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-32 lg:pb-10">
      {/* Hero */}
      <Hero event={event} group={group} colour={colour} />

      {/* Info bar */}
      <InfoBar event={event} colour={colour} goingCount={goingCount} />

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">

          {/* ── Left column ──────────────────────────────────────── */}
          <div className="space-y-8 min-w-0">
            {/* Event details */}
            {event.description && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-base font-bold text-gray-900 mb-3">About this event</h2>
                <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                  {event.description}
                </div>
              </div>
            )}

            {/* Social Snowball — mobile only (shows in sidebar on desktop) */}
            <div className="lg:hidden">
              <SocialSnowball
                memberRsvps={memberRsvps}
                guestRsvps={guestRsvps}
                goingCount={goingCount}
                colour={colour}
              />
            </div>

            {/* Event Chat */}
            <EventChat
              eventId={event.id}
              currentUser={currentUser ? { id: currentUser.id, full_name: currentUser.fullName, avatar_url: currentUser.avatarUrl } : null}
              isRsvped={rsvpStatus === 'going' || rsvpStatus === 'maybe'}
            />
          </div>

          {/* ── Right column (sticky sidebar) ────────────────────── */}
          <div className="hidden lg:block space-y-5 lg:sticky lg:top-8">
            <RsvpCard
              event={event}
              colour={colour}
              currentUser={currentUser}
              rsvpStatus={rsvpStatus}
              onRsvp={handleMemberRsvp}
              guestStatus={guestRsvpState}
              guestName={guestName}
              guestEmail={guestEmail}
              onGuestNameChange={(v) => { setGuestName(v); setGuestFieldErrors((p) => ({ ...p, name: undefined })) }}
              onGuestEmailChange={(v) => { setGuestEmail(v); setGuestFieldErrors((p) => ({ ...p, email: undefined })) }}
              onGuestRsvp={handleGuestRsvp}
              guestError={guestError}
              guestFieldErrors={guestFieldErrors}
            />
            <SocialSnowball
              memberRsvps={memberRsvps}
              guestRsvps={guestRsvps}
              goingCount={goingCount}
              colour={colour}
            />
            <ShareButton eventId={event.id} title={event.title} colour={colour} />
          </div>
        </div>
      </main>

      {/* ── Mobile sticky bottom RSVP bar ────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-30">
        <div className="px-4 py-3">
          {currentUser ? (
            <div className="flex items-center gap-2">
              {(['going', 'maybe', 'not_going'] as const).map((status) => {
                const active = rsvpStatus === status
                const label = status === 'going' ? "Going" : status === 'maybe' ? 'Maybe' : "Can't"
                const emoji = status === 'going' ? '🎉' : status === 'maybe' ? '🤔' : '😢'

                return (
                  <button
                    key={status}
                    onClick={() => handleMemberRsvp(status)}
                    disabled={rsvpStatus === 'loading'}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 text-sm font-semibold transition-all disabled:opacity-50"
                    style={{
                      borderColor: active ? colour : '#E5E7EB',
                      backgroundColor: active ? colour + '0A' : '#fff',
                      color: active ? colour : '#374151',
                    }}
                  >
                    {active ? <CheckIcon /> : <span className="text-sm">{emoji}</span>}
                    {label}
                  </button>
                )
              })}
            </div>
          ) : guestRsvpState === 'done' ? (
            <div className="flex items-center justify-center gap-2 py-2.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#059669' }}>
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <span className="font-semibold text-sm text-gray-900">You&apos;re on the list, {guestName.split(' ')[0]}!</span>
            </div>
          ) : guestRsvpState === 'already_rsvped' ? (
            <div className="flex items-center justify-center gap-2 py-2.5">
              <span className="text-sm">📬</span>
              <span className="font-semibold text-sm text-gray-900">Already RSVPed — check your inbox!</span>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => { setGuestName(e.target.value); setGuestFieldErrors((p) => ({ ...p, name: undefined })) }}
                  placeholder="Name"
                  className={`flex-1 px-3 py-2.5 rounded-xl border text-sm ${guestFieldErrors.name ? 'border-red-300' : 'border-gray-200'}`}
                />
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => { setGuestEmail(e.target.value); setGuestFieldErrors((p) => ({ ...p, email: undefined })) }}
                  placeholder="Email"
                  className={`flex-1 px-3 py-2.5 rounded-xl border text-sm ${guestFieldErrors.email ? 'border-red-300' : 'border-gray-200'}`}
                />
                <button
                  onClick={handleGuestRsvp}
                  disabled={guestRsvpState === 'loading'}
                  className="px-4 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundColor: colour }}
                >
                  {guestRsvpState === 'loading' ? <Spinner /> : 'RSVP'}
                </button>
              </div>
              {(guestFieldErrors.name || guestFieldErrors.email || guestError) && (
                <p className="text-red-500 text-xs mt-1.5">
                  {guestFieldErrors.name || guestFieldErrors.email || guestError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile share FAB (only shows on mobile) */}
      <div className="lg:hidden">
        <ShareButton eventId={event.id} title={event.title} colour={colour} />
      </div>
    </div>
  )
}
