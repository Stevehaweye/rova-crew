'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UpcomingEvent {
  id: string
  title: string
  startsAt: string
  location: string | null
  groupName: string
  groupColour: string
}

interface Props {
  userId: string
  fullName: string
  avatarUrl: string | null
  groupName: string
  groupSlug: string
  groupLogoUrl: string | null
  colour: string
  tier: { label: string; colour: string }
  memberSince: string | null
  appUrl: string
  upcomingEvents: UpcomingEvent[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function darken(hex: string, amount = 0.25): string {
  const c = hex.replace('#', '')
  const r = Math.round(parseInt(c.substring(0, 2), 16) * (1 - amount))
  const g = Math.round(parseInt(c.substring(2, 4), 16) * (1 - amount))
  const b = Math.round(parseInt(c.substring(4, 6), 16) * (1 - amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
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
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CrewCardClient({
  userId,
  fullName,
  avatarUrl,
  groupName,
  groupSlug,
  groupLogoUrl,
  colour,
  tier,
  memberSince,
  appUrl,
  upcomingEvents,
}: Props) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    upcomingEvents[0]?.id ?? null
  )
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Generate QR code whenever selection changes
  useEffect(() => {
    const checkinUrl = selectedEventId
      ? `${appUrl}/checkin/${userId}/${selectedEventId}`
      : `${appUrl}/checkin/${userId}`

    QRCode.toDataURL(checkinUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#111827', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('[wallet] QR generation error:', err))
  }, [selectedEventId, userId, appUrl])

  const selectedEvent = upcomingEvents.find((e) => e.id === selectedEventId)
  const darkColour = darken(colour)

  return (
    <div className="space-y-6">
      {/* ── Crew Card ──────────────────────────────────────────── */}
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: `linear-gradient(145deg, ${colour} 0%, ${darkColour} 100%)`,
        }}
      >
        {/* Decorative pattern */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 40%, rgba(0,0,0,0.15) 100%)',
          }}
        />

        <div className="relative z-10 px-6 pt-5 pb-6">
          {/* Header row: wordmark + group */}
          <div className="flex items-center justify-between mb-6">
            <div className="select-none">
              <span className="text-sm font-black tracking-[0.18em] text-white/90">ROVA</span>
              <span className="text-sm font-black tracking-[0.18em]" style={{ color: '#C9982A' }}>CREW</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden ring-1 ring-white/20"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                {groupLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={groupLogoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9px] font-bold text-white/80">
                    {groupName[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-white/60">{groupName}</span>
            </div>
          </div>

          {/* Member identity row */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-white leading-tight tracking-tight truncate">
                {fullName}
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: tier.colour + '30',
                    color: tier.colour === '#6B7280' ? 'rgba(255,255,255,0.7)' : tier.colour,
                    border: `1px solid ${tier.colour}40`,
                  }}
                >
                  {tier.label}
                </span>
                {memberSince && (
                  <span className="text-[11px] text-white/40 font-medium">
                    Since {memberSince}
                  </span>
                )}
              </div>
            </div>
            <div
              className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden ring-2 ring-white/25 flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-white/70">
                  {initials(fullName)}
                </span>
              )}
            </div>
          </div>

          {/* QR code area */}
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-2xl p-3 shadow-lg">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Check-in QR code"
                  className="w-48 h-48 sm:w-56 sm:h-56"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 bg-gray-50 rounded-xl animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-white/50 font-medium mt-3 text-center tracking-wide">
              {selectedEvent
                ? `Check-in for ${selectedEvent.title}`
                : 'Show this screen to check in'}
            </p>
          </div>
        </div>

        {/* Bottom edge accent */}
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, #C9982A, ${colour}, #C9982A)` }} />
      </div>

      {/* ── Upcoming Events ────────────────────────────────────── */}
      {upcomingEvents.length > 0 ? (
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3 px-1">Your upcoming events</h2>
          <div className="space-y-2.5">
            {upcomingEvents.map((ev) => {
              const isSelected = ev.id === selectedEventId
              const start = new Date(ev.startsAt)

              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className="w-full text-left bg-white rounded-2xl border-2 p-4 transition-all duration-200"
                  style={{
                    borderColor: isSelected ? colour : '#F3F4F6',
                    boxShadow: isSelected
                      ? `0 0 0 1px ${colour}20, 0 4px 12px ${colour}15`
                      : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Date badge */}
                    <div
                      className="flex-shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center text-white"
                      style={{ backgroundColor: isSelected ? colour : ev.groupColour }}
                    >
                      <span className="text-[8px] font-bold uppercase leading-none">
                        {format(start, 'MMM')}
                      </span>
                      <span className="text-base font-black leading-none">
                        {format(start, 'd')}
                      </span>
                    </div>

                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                        {isSelected && (
                          <span style={{ color: colour }}>
                            <CheckCircleIcon />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <CalendarIcon />
                          {format(start, 'EEE · h:mm a')}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 truncate">
                            <MapPinIcon />
                            <span className="truncate">{ev.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      className="mt-3 pt-3 border-t flex items-center gap-1.5 text-xs font-semibold"
                      style={{ borderColor: colour + '20', color: colour }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z" />
                      </svg>
                      QR code updated for this event
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-10 text-center">
          <div className="text-4xl mb-3 select-none">📅</div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No upcoming events</p>
          <p className="text-xs text-gray-400 mb-4">
            RSVP to an event to get your check-in QR code.
          </p>
          <Link
            href={`/g/${groupSlug}`}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: colour }}
          >
            Browse events &rarr;
          </Link>
        </div>
      )}

      {/* Footer hint */}
      <p className="text-center text-[11px] text-gray-400 pb-4">
        Your QR code is unique to you. Don&apos;t share it.
      </p>
    </div>
  )
}
