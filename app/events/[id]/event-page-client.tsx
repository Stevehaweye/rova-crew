'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import ContactOrganiserModal from '@/components/ContactOrganiserModal'

const SharedCostTicker = dynamic(() => import('@/components/events/SharedCostTicker'), { ssr: false })

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
  eventType: 'free' | 'paid' | 'shared_cost'
  priceAmount: number | null
  totalCost: number | null
  minParticipants: number | null
  stripePriceId: string | null
  paymentType: 'free' | 'fixed' | 'shared_cost'
  totalCostPence: number | null
  allowGuestRsvp: boolean
  pricePence: number | null
}

interface GroupData {
  id: string
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
  firstName: string
  lastName: string
  status: 'confirmed'
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

interface OrganiserData {
  name: string
  avatarUrl: string | null
}

interface Props {
  event: EventData
  group: GroupData
  initialMemberRsvps: MemberRsvp[]
  initialGuestRsvps: GuestRsvp[]
  memberGoingCount: number
  guestGoingCount: number
  currentUser: CurrentUserProfile | null
  currentUserRsvp: { id: string; status: 'going' | 'maybe' | 'not_going' } | null
  organiser: OrganiserData | null
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
  organiser,
}: {
  event: EventData
  group: GroupData
  colour: string
  organiser: OrganiserData | null
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
          {organiser && (
            <>
              <span className="text-white/40 text-sm">·</span>
              <span className="text-white/60 text-xs font-medium drop-shadow">by {organiser.name}</span>
            </>
          )}
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
  memberCount,
  guestCount,
}: {
  event: EventData
  colour: string
  memberCount: number
  guestCount: number
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
              {guestCount > 0 ? (
                <>
                  <strong className="text-gray-900">{memberCount}</strong>
                  {memberCount === 1 ? ' member' : ' members'}
                  <span className="text-gray-400"> + </span>
                  <strong className="text-gray-900">{guestCount}</strong>
                  {guestCount === 1 ? ' guest' : ' guests'}
                </>
              ) : (
                <>
                  <strong className="text-gray-900">{memberCount}</strong> going
                </>
              )}
              {event.maxCapacity && (
                <span className="text-gray-400"> / {event.maxCapacity}</span>
              )}
            </span>
          </div>

          {(() => {
            const totalCount = memberCount + guestCount
            const badge =
              event.paymentType === 'fixed' && event.pricePence
                ? { bg: '#D97706', label: `\u00a3${(event.pricePence / 100).toFixed(2)}` }
                : event.paymentType === 'shared_cost' && event.totalCostPence && event.minParticipants
                  ? { bg: '#2563EB', label: `\u00a3${(event.totalCostPence / 100 / Math.max(totalCount, event.minParticipants)).toFixed(2)} each` }
                  : { bg: '#059669', label: 'FREE' }
            return (
              <span
                className="px-3 py-1 rounded-full text-[10px] font-black tracking-wider text-white"
                style={{ backgroundColor: badge.bg }}
              >
                {badge.label}
              </span>
            )
          })()}
        </div>

        {/* Capacity bar */}
        {event.maxCapacity && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(((memberCount + guestCount) / event.maxCapacity) * 100, 100)}%`,
                  backgroundColor: colour,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {Math.max(event.maxCapacity - memberCount - guestCount, 0)} spot{event.maxCapacity - memberCount - guestCount !== 1 ? 's' : ''} remaining
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
      name: `${r.firstName} ${r.lastName[0]}.`,
      avatarUrl: null as string | null,
      status: 'going' as const,
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

// ─── Guest Confirmation (two-stage) ─────────────────────────────────────────

function GuestConfirmation({
  eventTitle,
  guestEmail,
  groupName,
  groupSlug,
  colour,
  onDismiss,
}: {
  eventTitle: string
  guestEmail: string
  groupName: string
  groupSlug: string
  colour: string
  onDismiss: () => void
}) {
  const [stage, setStage] = useState<1 | 2>(1)

  useEffect(() => {
    const timer = setTimeout(() => setStage(2), 2000)
    return () => clearTimeout(timer)
  }, [])

  const signUpUrl = `/auth?next=/g/${groupSlug}&email=${encodeURIComponent(guestEmail)}`

  return (
    <div className="overflow-hidden">
      {/* Stage 1 — Confirmation */}
      <div
        className="transition-all duration-500 ease-in-out"
        style={{
          maxHeight: stage === 1 ? '300px' : '0px',
          opacity: stage === 1 ? 1 : 0,
          transform: stage === 1 ? 'translateY(0)' : 'translateY(-8px)',
        }}
      >
        <div className="text-center py-6">
          {/* Animated tick */}
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-emerald-500">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
                style={{
                  strokeDasharray: 30,
                  strokeDashoffset: 0,
                  animation: 'guest-tick-draw 0.5s cubic-bezier(0.65, 0, 0.35, 1) 0.15s both',
                }}
              />
            </svg>
          </div>
          <p className="font-bold text-gray-900 text-sm leading-snug">
            You&apos;re on the list for {eventTitle}!
          </p>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            A confirmation email is on its way to{' '}
            <span className="font-medium text-gray-700">{guestEmail}</span>.
          </p>
        </div>
      </div>

      {/* Stage 2 — Conversion prompt */}
      <div
        className="transition-all duration-500 ease-out"
        style={{
          maxHeight: stage === 2 ? '400px' : '0px',
          opacity: stage === 2 ? 1 : 0,
          transform: stage === 2 ? 'translateY(0)' : 'translateY(12px)',
        }}
      >
        <div className="text-center py-5">
          <div className="w-10 h-10 rounded-full mx-auto mb-3 bg-gray-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <p className="font-bold text-gray-900 text-sm mb-1.5">
            Want to see who else is going?
          </p>
          <p className="text-xs text-gray-500 leading-relaxed mb-5 px-1">
            Members see the full attendee list, group chat, and upcoming events. It takes 30 seconds.
          </p>
          <Link
            href={signUpUrl}
            className="block w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 text-center"
            style={{ backgroundColor: colour }}
          >
            Join {groupName} &rarr;
          </Link>
          <button
            onClick={onDismiss}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            No thanks, just attending this event
          </button>
        </div>
      </div>

      <style>{`
        @keyframes guest-tick-draw {
          from { stroke-dashoffset: 30; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── RSVP Card (Two-path: Member + Guest) ───────────────────────────────────

function RsvpCard({
  event,
  group,
  colour,
  currentUser,
  rsvpStatus,
  onRsvp,
  guestExpanded,
  onToggleGuest,
  guestStatus,
  guestDismissed,
  onGuestDismiss,
  guestFirstName,
  guestLastName,
  guestEmail,
  onGuestFirstNameChange,
  onGuestLastNameChange,
  onGuestEmailChange,
  onGuestRsvp,
  guestError,
  guestFieldErrors,
}: {
  event: EventData
  group: GroupData
  colour: string
  currentUser: CurrentUserProfile | null
  rsvpStatus: RsvpStatus
  onRsvp: (status: 'going' | 'maybe' | 'not_going') => void
  guestExpanded: boolean
  onToggleGuest: () => void
  guestStatus: GuestRsvpStatus
  guestDismissed: boolean
  onGuestDismiss: () => void
  guestFirstName: string
  guestLastName: string
  guestEmail: string
  onGuestFirstNameChange: (v: string) => void
  onGuestLastNameChange: (v: string) => void
  onGuestEmailChange: (v: string) => void
  onGuestRsvp: () => void
  guestError: string
  guestFieldErrors: { firstName?: string; lastName?: string; email?: string }
}) {
  const priceLabel = event.pricePence ? `\u00a3${(event.pricePence / 100).toFixed(2)}` : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-1">RSVP</h3>
      <p className="text-xs text-gray-400 mb-4">
        {format(new Date(event.startsAt), 'EEE d MMM · h:mm a')}
      </p>

      {/* ── Member section ─────────────────────────────────────── */}
      {currentUser ? (
        event.paymentType === 'fixed' && priceLabel ? (
          <div className="space-y-2.5">
            <button
              onClick={() => onRsvp('going')}
              disabled={rsvpStatus === 'loading' || rsvpStatus === 'going'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50"
              style={{ backgroundColor: rsvpStatus === 'going' ? '#059669' : colour }}
            >
              {rsvpStatus === 'loading' ? (
                <Spinner />
              ) : rsvpStatus === 'going' ? (
                <><CheckIcon /> Ticket purchased</>
              ) : (
                <>Buy ticket &mdash; {priceLabel}</>
              )}
            </button>
            {rsvpStatus === 'error' && (
              <p className="text-red-500 text-xs mt-1">Something went wrong. Try again.</p>
            )}
          </div>
        ) : (
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
        )
      ) : (
        <Link
          href={`/auth?next=/events/${event.id}`}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: colour }}
        >
          Sign in to RSVP &rarr;
        </Link>
      )}

      {/* ── Divider + Guest section ─────────────────────────────── */}
      {event.allowGuestRsvp && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {guestStatus === 'done' ? (
            guestDismissed ? (
              <div className="text-center py-4">
                <div className="w-8 h-8 rounded-full mx-auto mb-2 bg-emerald-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500">You&apos;re confirmed. See you there!</p>
              </div>
            ) : (
              <GuestConfirmation
                eventTitle={event.title}
                guestEmail={guestEmail}
                groupName={group.name}
                groupSlug={group.slug}
                colour={colour}
                onDismiss={onGuestDismiss}
              />
            )
          ) : guestStatus === 'already_rsvped' ? (
            <div className="text-center py-5">
              <div className="text-3xl mb-2">📬</div>
              <p className="font-bold text-gray-900 text-sm">You&apos;ve already RSVPed!</p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Check your inbox for the confirmation email with your QR code.
              </p>
            </div>
          ) : !guestExpanded ? (
            <button
              onClick={onToggleGuest}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              Just want to come? RSVP as a guest
              <svg className="w-3.5 h-3.5 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                RSVP as a guest — no account needed.
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={guestFirstName}
                    onChange={(e) => onGuestFirstNameChange(e.target.value)}
                    placeholder="First name"
                    className={`w-full px-3.5 py-3 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${guestFieldErrors.firstName ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}
                    style={{ '--tw-ring-color': colour } as React.CSSProperties}
                  />
                  {guestFieldErrors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{guestFieldErrors.firstName}</p>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={guestLastName}
                    onChange={(e) => onGuestLastNameChange(e.target.value)}
                    placeholder="Last name"
                    className={`w-full px-3.5 py-3 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${guestFieldErrors.lastName ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}
                    style={{ '--tw-ring-color': colour } as React.CSSProperties}
                  />
                  {guestFieldErrors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{guestFieldErrors.lastName}</p>
                  )}
                </div>
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
              {event.paymentType === 'fixed' && priceLabel && (
                <p className="text-xs text-gray-400 text-center">
                  You&apos;ll pay {priceLabel} after submitting.
                </p>
              )}
              <button
                onClick={onGuestRsvp}
                disabled={guestStatus === 'loading'}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: colour }}
              >
                {guestStatus === 'loading' ? (
                  <><Spinner /> Sending confirmation&hellip;</>
                ) : (
                  "I'm coming \u2192"
                )}
              </button>
              {guestError && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2">
                  <p className="text-red-600 text-xs">{guestError}</p>
                </div>
              )}
            </div>
          )}
        </>
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
  memberGoingCount,
  guestGoingCount,
  currentUser,
  currentUserRsvp,
  organiser,
}: Props) {
  const router = useRouter()
  const colour = hex(group.primaryColour)

  // ── State ──────────────────────────────────────────────────────────────────

  const [memberRsvps, setMemberRsvps] = useState<MemberRsvp[]>(initialMemberRsvps)
  const [guestRsvps, setGuestRsvps] = useState<GuestRsvp[]>(initialGuestRsvps)
  const [memberCount, setMemberCount] = useState(memberGoingCount)
  const [guestCount, setGuestCount] = useState(guestGoingCount)
  const goingCount = memberCount + guestCount

  // Member RSVP state
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>(
    currentUserRsvp ? currentUserRsvp.status : 'idle'
  )

  // Guest RSVP state
  const [guestRsvpState, setGuestRsvpState] = useState<GuestRsvpStatus>('idle')
  const [guestExpanded, setGuestExpanded] = useState(false)
  const [guestDismissed, setGuestDismissed] = useState(false)
  const [guestFirstName, setGuestFirstName] = useState('')
  const [guestLastName, setGuestLastName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestError, setGuestError] = useState('')
  const [guestFieldErrors, setGuestFieldErrors] = useState<{ firstName?: string; lastName?: string; email?: string }>({})
  const [contactModalOpen, setContactModalOpen] = useState(false)

  // ── Payment success handler ───────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      window.history.replaceState({}, '', `/events/${event.id}`)
      router.refresh()
    }
  }, [event.id, router])

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
            setMemberCount((c) => c + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guest_rsvps', filter: `event_id=eq.${event.id}` },
        (payload) => {
          const newGuest = payload.new as { id: string; first_name: string; last_name: string; status: string; created_at: string }
          if (newGuest.status === 'confirmed') {
            const rsvp: GuestRsvp = {
              id: newGuest.id,
              firstName: newGuest.first_name,
              lastName: newGuest.last_name,
              status: 'confirmed',
              createdAt: newGuest.created_at,
            }
            setGuestRsvps((prev) => {
              if (prev.some((r) => r.id === rsvp.id)) return prev
              return [...prev, rsvp]
            })
            setGuestCount((c) => c + 1)
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

    // For PAID events, "going" triggers Stripe Checkout
    if (event.paymentType === 'fixed' && status === 'going' && event.pricePence) {
      setRsvpStatus('loading')
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: event.id, user_id: currentUser.id }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
          return
        }
        setRsvpStatus('error')
      } catch (err) {
        console.error('[rsvp] checkout error:', err)
        setRsvpStatus('error')
      }
      return
    }

    setRsvpStatus('loading')

    try {
      const res = await fetch(`/api/events/${event.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        console.error('[rsvp] error:', await res.text())
        setRsvpStatus('error')
        return
      }
    } catch (err) {
      console.error('[rsvp] error:', err)
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
      // Update member count if transitioning to going/maybe from idle or not_going
      if (rsvpStatus === 'idle' || rsvpStatus === 'not_going') {
        setMemberCount((c) => c + 1)
      }
    } else if (status === 'not_going') {
      setMemberRsvps((prev) => prev.filter((r) => r.userId !== currentUser.id))
      if (rsvpStatus !== 'idle' && rsvpStatus !== 'not_going' && rsvpStatus !== 'error') {
        setMemberCount((c) => Math.max(c - 1, 0))
      }
    }

    setRsvpStatus(status)
    router.refresh()
  }

  // ── Guest RSVP handler ─────────────────────────────────────────────────────

  async function handleGuestRsvp() {
    // Client-side validation
    const fieldErrs: { firstName?: string; lastName?: string; email?: string } = {}
    if (!guestFirstName.trim() || guestFirstName.trim().length < 1) {
      fieldErrs.firstName = 'First name is required.'
    }
    if (!guestLastName.trim() || guestLastName.trim().length < 1) {
      fieldErrs.lastName = 'Last name is required.'
    }
    if (!guestEmail.trim() || !EMAIL_RE.test(guestEmail.trim())) {
      fieldErrs.email = 'Please enter a valid email address.'
    }
    setGuestFieldErrors(fieldErrs)
    if (Object.keys(fieldErrs).length > 0) return

    setGuestRsvpState('loading')
    setGuestError('')

    // For PAID events, redirect guests to Stripe Checkout
    if (event.paymentType === 'fixed' && event.pricePence) {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: event.id,
            guest_email: guestEmail.trim(),
            guest_first_name: guestFirstName.trim(),
            guest_last_name: guestLastName.trim(),
          }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
          return
        }
        setGuestError('Payment setup failed. Please try again.')
        setGuestRsvpState('error')
      } catch (err) {
        console.error('[guest-rsvp] checkout error:', err)
        setGuestError('Payment setup failed. Please try again.')
        setGuestRsvpState('error')
      }
      return
    }

    try {
      const res = await fetch(`/api/events/${event.id}/guest-rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: guestFirstName.trim(),
          last_name: guestLastName.trim(),
          email: guestEmail.trim(),
        }),
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
        firstName: guestFirstName.trim(),
        lastName: guestLastName.trim(),
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      }
      setGuestRsvps((prev) => {
        if (prev.some((r) => r.id === optimisticGuest.id)) return prev
        return [...prev, optimisticGuest]
      })
      setGuestCount((c) => c + 1)
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
      <Hero event={event} group={group} colour={colour} organiser={organiser} />

      {/* Info bar */}
      <InfoBar event={event} colour={colour} memberCount={memberCount} guestCount={guestCount} />

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

            {/* Contact organiser */}
            {organiser && (
              <button
                onClick={() => setContactModalOpen(true)}
                className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-75"
                style={{ color: colour }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                Contact organiser
              </button>
            )}

            {/* Shared Cost Ticker — mobile only */}
            {event.paymentType === 'shared_cost' && event.totalCostPence && event.minParticipants && (
              <div className="lg:hidden">
                <SharedCostTicker
                  eventId={event.id}
                  totalCostPence={event.totalCostPence}
                  minParticipants={event.minParticipants}
                  maxParticipants={event.maxCapacity ?? event.minParticipants * 3}
                  currentRsvpCount={goingCount}
                />
              </div>
            )}

            {/* RSVP Card — mobile only (shows in sidebar on desktop) */}
            <div className="lg:hidden">
              <RsvpCard
                event={event}
                group={group}
                colour={colour}
                currentUser={currentUser}
                rsvpStatus={rsvpStatus}
                onRsvp={handleMemberRsvp}
                guestExpanded={guestExpanded}
                onToggleGuest={() => setGuestExpanded(true)}
                guestStatus={guestRsvpState}
                guestDismissed={guestDismissed}
                onGuestDismiss={() => setGuestDismissed(true)}
                guestFirstName={guestFirstName}
                guestLastName={guestLastName}
                guestEmail={guestEmail}
                onGuestFirstNameChange={(v) => { setGuestFirstName(v); setGuestFieldErrors((p) => ({ ...p, firstName: undefined })) }}
                onGuestLastNameChange={(v) => { setGuestLastName(v); setGuestFieldErrors((p) => ({ ...p, lastName: undefined })) }}
                onGuestEmailChange={(v) => { setGuestEmail(v); setGuestFieldErrors((p) => ({ ...p, email: undefined })) }}
                onGuestRsvp={handleGuestRsvp}
                guestError={guestError}
                guestFieldErrors={guestFieldErrors}
              />
            </div>

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
            {event.paymentType === 'shared_cost' && event.totalCostPence && event.minParticipants && (
              <SharedCostTicker
                eventId={event.id}
                totalCostPence={event.totalCostPence}
                minParticipants={event.minParticipants}
                maxParticipants={event.maxCapacity ?? event.minParticipants * 3}
                currentRsvpCount={goingCount}
              />
            )}
            <RsvpCard
              event={event}
              group={group}
              colour={colour}
              currentUser={currentUser}
              rsvpStatus={rsvpStatus}
              onRsvp={handleMemberRsvp}
              guestExpanded={guestExpanded}
              onToggleGuest={() => setGuestExpanded(true)}
              guestStatus={guestRsvpState}
              guestDismissed={guestDismissed}
              onGuestDismiss={() => setGuestDismissed(true)}
              guestFirstName={guestFirstName}
              guestLastName={guestLastName}
              guestEmail={guestEmail}
              onGuestFirstNameChange={(v) => { setGuestFirstName(v); setGuestFieldErrors((p) => ({ ...p, firstName: undefined })) }}
              onGuestLastNameChange={(v) => { setGuestLastName(v); setGuestFieldErrors((p) => ({ ...p, lastName: undefined })) }}
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
            event.paymentType === 'fixed' && event.pricePence ? (
              <button
                onClick={() => handleMemberRsvp('going')}
                disabled={rsvpStatus === 'loading' || rsvpStatus === 'going'}
                className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: rsvpStatus === 'going' ? '#059669' : colour }}
              >
                {rsvpStatus === 'loading' ? <Spinner /> :
                 rsvpStatus === 'going' ? <><CheckIcon /> Ticket purchased</> :
                 <>Buy ticket &mdash; &pound;{(event.pricePence / 100).toFixed(2)}</>}
              </button>
            ) : (
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
            )
          ) : (
            <Link
              href={`/auth?next=/events/${event.id}`}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm"
              style={{ backgroundColor: colour }}
            >
              Sign in to RSVP &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Mobile share FAB (only shows on mobile) */}
      <div className="lg:hidden">
        <ShareButton eventId={event.id} title={event.title} colour={colour} />
      </div>

      {/* Contact organiser modal */}
      {contactModalOpen && (
        <ContactOrganiserModal
          groupId={group.id}
          groupName={group.name}
          colour={colour}
          currentUser={currentUser ? { name: currentUser.fullName, email: '' } : null}
          onClose={() => setContactModalOpen(false)}
        />
      )}
    </div>
  )
}
