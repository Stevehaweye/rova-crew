'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  event: {
    id: string
    title: string
    description: string | null
    location: string | null
    startsAt: string
    endsAt: string
    coverUrl: string | null
    amountPence: number
  }
  group: {
    name: string
    slug: string
    logoUrl: string | null
    colour: string
  }
  isGuest: boolean
  guestEmail: string | null
  isLoggedIn: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPence(pence: number): string {
  return `\u00a3${(pence / 100).toFixed(2)}`
}

function generateIcsContent(event: Props['event'], groupName: string): string {
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
  const uid = `${event.id}@rovacrew.com`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ROVA Crew//Event//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${groupName} event`,
    event.location ? `LOCATION:${event.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
  return lines
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function CalendarPlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
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

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

// ─── Confetti Burst ─────────────────────────────────────────────────────────

function ConfettiBurst() {
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; rotation: number; colour: string; delay: number; size: number }[]
  >([])

  useEffect(() => {
    const colours = ['#059669', '#0D7377', '#C9982A', '#2563EB', '#D97706', '#EC4899', '#8B5CF6']
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      rotation: Math.random() * 360,
      colour: colours[Math.floor(Math.random() * colours.length)],
      delay: Math.random() * 0.6,
      size: 4 + Math.random() * 6,
    }))
    setParticles(items)
  }, [])

  if (particles.length === 0) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm animate-confetti-fall opacity-0"
          style={{
            left: `${p.x}%`,
            top: `-8px`,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.colour,
            transform: `rotate(${p.rotation}deg)`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translateY(70vh) rotate(720deg) scale(0.3); }
        }
        .animate-confetti-fall {
          animation: confetti-fall 2.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>
    </div>
  )
}

// ─── Animated Checkmark ─────────────────────────────────────────────────────

function AnimatedCheckmark({ colour }: { colour: string }) {
  return (
    <div className="relative w-24 h-24 mx-auto">
      {/* Pulse rings */}
      <div
        className="absolute inset-0 rounded-full animate-ping-slow opacity-20"
        style={{ backgroundColor: colour }}
      />
      <div
        className="absolute inset-2 rounded-full animate-ping-slower opacity-15"
        style={{ backgroundColor: colour }}
      />
      {/* Circle + check */}
      <div
        className="relative w-24 h-24 rounded-full flex items-center justify-center animate-scale-in"
        style={{ backgroundColor: colour }}
      >
        <svg
          className="w-12 h-12 text-white animate-draw-check"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={3}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
            strokeDasharray="30"
            strokeDashoffset="30"
            style={{ animation: 'draw-check 0.5s ease 0.4s forwards' }}
          />
        </svg>
      </div>
      <style>{`
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 0.2; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes ping-slower { 0% { transform: scale(1); opacity: 0.15; } 100% { transform: scale(2); opacity: 0; } }
        @keyframes scale-in { 0% { transform: scale(0); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes draw-check { to { stroke-dashoffset: 0; } }
        .animate-ping-slow { animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-ping-slower { animation: ping-slower 2.5s cubic-bezier(0, 0, 0.2, 1) infinite 0.3s; }
        .animate-scale-in { animation: scale-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-draw-check path { stroke-dashoffset: 30; }
      `}</style>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PaymentSuccessClient({
  event,
  group,
  isGuest,
  guestEmail,
  isLoggedIn,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3500)
    return () => clearTimeout(timer)
  }, [])

  const startDate = new Date(event.startsAt)
  const endDate = new Date(event.endsAt)
  const eventUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/events/${event.id}`
      : `/events/${event.id}`

  function handleAddToCalendar() {
    const ics = generateIcsContent(event, group.name)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(eventUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for non-HTTPS
      const input = document.createElement('input')
      input.value = eventUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <Link href="/home" className="select-none">
            <span className="text-lg font-black tracking-[0.14em]" style={{ color: '#0D7377' }}>
              ROVA
            </span>
            <span className="text-lg font-black tracking-[0.14em]" style={{ color: '#C9982A' }}>
              CREW
            </span>
          </Link>
        </div>
      </nav>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md relative">
          {/* Confetti layer */}
          {showConfetti && <ConfettiBurst />}

          {/* Success card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100/60 overflow-hidden">
            {/* Coloured banner */}
            <div
              className="h-2 w-full"
              style={{ backgroundColor: group.colour }}
            />

            <div className="px-6 pt-8 pb-8 sm:px-8">
              {/* Checkmark */}
              <AnimatedCheckmark colour="#059669" />

              {/* Heading */}
              <div className="text-center mt-6 mb-2">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
                  You&apos;re going!
                </h1>
                <p className="text-gray-500 text-sm mt-1.5">
                  Payment confirmed &mdash; your spot is locked in.
                </p>
              </div>

              {/* Payment amount */}
              {event.amountPence > 0 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                    <CheckCircleIcon />
                    {formatPence(event.amountPence)} paid
                  </div>
                </div>
              )}

              {/* Event details card */}
              <div
                className="mt-7 rounded-2xl border p-5"
                style={{
                  borderColor: group.colour + '30',
                  backgroundColor: group.colour + '06',
                }}
              >
                {/* Group badge */}
                <div className="flex items-center gap-2 mb-3">
                  {group.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={group.logoUrl}
                      alt=""
                      className="w-5 h-5 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: group.colour }}
                    >
                      {group.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-gray-500">
                    {group.name}
                  </span>
                </div>

                {/* Event title */}
                <h2 className="text-lg font-bold text-gray-900 leading-snug">
                  {event.title}
                </h2>

                {/* Meta rows */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <ClockIcon />
                    <span>
                      {format(startDate, 'EEEE d MMMM')}
                      <span className="text-gray-400 mx-1">&middot;</span>
                      {format(startDate, 'h:mm a')} &ndash; {format(endDate, 'h:mm a')}
                    </span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <MapPinIcon />
                      <span>{event.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={handleAddToCalendar}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: group.colour }}
                >
                  <CalendarPlusIcon />
                  Add to calendar
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 font-semibold text-sm transition-all active:scale-[0.98]"
                  style={{
                    borderColor: copied ? '#059669' : group.colour + '40',
                    color: copied ? '#059669' : group.colour,
                    backgroundColor: copied ? '#05966908' : 'transparent',
                  }}
                >
                  {copied ? (
                    <>
                      <CheckCircleIcon />
                      Link copied!
                    </>
                  ) : (
                    <>
                      <ShareIcon />
                      Share this event
                    </>
                  )}
                </button>
              </div>

              {/* Back to event link */}
              <div className="mt-6 text-center">
                <Link
                  href={`/events/${event.id}`}
                  className="text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: group.colour }}
                >
                  View event page &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* ── Guest conversion prompt (WOW 1) ───────────────────────────── */}
          {isGuest && !isLoggedIn && (
            <div className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-100/60 px-6 py-6 sm:px-8 text-center">
              <div className="text-3xl mb-3 select-none" aria-hidden>
                &#x1F91D;
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Loved the vibe?
              </h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Join the crew &mdash; it only takes 30 seconds.
                <br />
                Get event updates, chat with the group, and never miss out.
              </p>
              <Link
                href={`/auth?next=/events/${event.id}`}
                className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: '#0D7377' }}
              >
                Sign up free &rarr;
              </Link>
              {guestEmail && (
                <p className="text-xs text-gray-400 mt-3">
                  We&apos;ll link your ticket to your new account.
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            A confirmation has been sent to your email.
          </p>
        </div>
      </main>
    </div>
  )
}
