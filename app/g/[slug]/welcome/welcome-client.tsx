'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import type { WarmConnection } from '@/lib/warm-introductions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupData {
  id: string
  name: string
  slug: string
  colour: string
  logoUrl: string | null
}

interface NextEventData {
  id: string
  title: string
  startsAt: string
  location: string | null
}

interface Props {
  group: GroupData
  userName: string
  connections: WarmConnection[]
  nextEvent: NextEventData | null
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ChatBubbleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  )
}

function CalendarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}

function MapPinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}

function ShareIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function firstInitial(name: string) {
  return (name[0] ?? '?').toUpperCase()
}

// ─── Confetti Particles ──────────────────────────────────────────────────────

function ConfettiCanvas({ colour }: { colour: string }) {
  const [particles, setParticles] = useState<
    Array<{
      id: number
      x: number
      delay: number
      duration: number
      size: number
      color: string
      rotation: number
    }>
  >([])

  useEffect(() => {
    const confettiColors = [colour, '#C9982A', '#F59E0B', '#10B981', '#6366F1', '#EC4899']
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2.5 + Math.random() * 2,
      size: 4 + Math.random() * 6,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      rotation: Math.random() * 360,
    }))
    setParticles(items)
  }, [colour])

  if (particles.length === 0) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.color,
            borderRadius: '1px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Connection Card ─────────────────────────────────────────────────────────

function ConnectionCard({
  connection,
  colour,
  onSayHello,
  loading,
}: {
  connection: WarmConnection
  colour: string
  onSayHello: () => void
  loading: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      {/* Avatar */}
      {connection.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={connection.avatarUrl}
          alt={connection.fullName}
          className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0"
        />
      ) : (
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-base ring-2 ring-white shadow-sm flex-shrink-0"
          style={{ backgroundColor: colour }}
        >
          {initials(connection.fullName)}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">
          {connection.fullName}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
          {connection.type === 'mutual' ? (
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          )}
          <span className="truncate">{connection.context}</span>
        </p>
      </div>

      {/* Say hello button */}
      <button
        onClick={onSayHello}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 flex-shrink-0"
        style={{ backgroundColor: colour }}
      >
        {loading ? (
          <Spinner className="w-3.5 h-3.5" />
        ) : (
          <ChatBubbleIcon className="w-3.5 h-3.5" />
        )}
        Say hello
      </button>
    </div>
  )
}

// ─── Next Event Card ─────────────────────────────────────────────────────────

function NextEventCard({
  event,
  colour,
}: {
  event: NextEventData
  colour: string
}) {
  const startDate = new Date(event.startsAt)
  const monthStr = format(startDate, 'MMM')
  const dayStr = startDate.getDate().toString()
  const dateTimeStr = format(startDate, 'EEE d MMM \u00B7 h:mm a')

  return (
    <Link
      href={`/events/${event.id}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all"
    >
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        Next Event
      </p>
      <div className="flex items-start gap-4">
        {/* Date block */}
        <div
          className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white"
          style={{ backgroundColor: colour }}
        >
          <span className="text-[10px] font-bold uppercase leading-none">{monthStr}</span>
          <span className="text-xl font-black leading-none">{dayStr}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-snug">{event.title}</p>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
            <CalendarIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{dateTimeStr}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
              <MapPinIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
        </div>
      </div>

      <div
        className="mt-4 w-full py-2.5 rounded-xl text-center text-sm font-bold transition-opacity hover:opacity-90"
        style={{ backgroundColor: colour + '12', color: colour }}
      >
        RSVP now
      </div>
    </Link>
  )
}

// ─── Invite Share Section ────────────────────────────────────────────────────

function InviteShareSection({
  groupSlug,
  groupName,
  colour,
}: {
  groupSlug: string
  groupName: string
  colour: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/g/${groupSlug}`

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Join ${groupName} on ROVA Crew`,
          url,
        })
        return
      } catch {
        // User cancelled or not supported
      }
    }

    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
      <div
        className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ backgroundColor: colour + '15' }}
      >
        <svg className="w-7 h-7" style={{ color: colour }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      </div>
      <p className="font-bold text-gray-900 text-sm mb-1.5">
        Know someone who&apos;d love this group?
      </p>
      <p className="text-xs text-gray-500 leading-relaxed mb-5">
        Invite your friends and build the crew together.
      </p>
      <button
        onClick={handleShare}
        className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
        style={{ backgroundColor: colour }}
      >
        {copied ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Link copied!
          </>
        ) : (
          <>
            <ShareIcon className="w-4 h-4" />
            Share invite link
          </>
        )}
      </button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WelcomeClient({
  group,
  userName,
  connections,
  nextEvent,
}: Props) {
  const router = useRouter()
  const [loadingDmId, setLoadingDmId] = useState<string | null>(null)
  const [showContent, setShowContent] = useState(false)

  // Stagger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 150)
    return () => clearTimeout(timer)
  }, [])

  async function handleSayHello(otherUserId: string) {
    if (loadingDmId) return
    setLoadingDmId(otherUserId)

    try {
      const res = await fetch('/api/messages/dm/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId }),
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('[welcome] DM start error:', data.error)
        setLoadingDmId(null)
        return
      }

      router.push(`/messages/${data.channelId}`)
    } catch (err) {
      console.error('[welcome] DM start error:', err)
      setLoadingDmId(null)
    }
  }

  const hasConnections = connections.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero / Celebration Header ──────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundColor: group.colour }}
      >
        {/* Confetti animation */}
        <ConfettiCanvas colour={group.colour} />

        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.2) 100%)',
          }}
        />

        {/* Nav bar */}
        <div className="relative z-10 px-5 sm:px-10 pt-5 flex items-center justify-between">
          <Link href="/home" className="select-none">
            <span className="text-base font-black tracking-[0.14em] text-white/90 drop-shadow">
              ROVA
            </span>
            <span className="text-base font-black tracking-[0.14em] drop-shadow" style={{ color: '#C9982A' }}>
              CREW
            </span>
          </Link>
        </div>

        {/* Welcome content */}
        <div
          className="relative z-10 px-6 sm:px-10 pt-10 pb-14 max-w-2xl mx-auto text-center transition-all duration-700 ease-out"
          style={{
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(16px)',
          }}
        >
          {/* Group logo */}
          <div
            className="w-20 h-20 rounded-2xl ring-4 ring-white/20 shadow-2xl mx-auto mb-6 flex items-center justify-center text-white font-black text-2xl overflow-hidden"
            style={{ backgroundColor: group.colour + 'cc', backdropFilter: 'blur(4px)' }}
          >
            {group.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.logoUrl} alt={group.name} className="w-full h-full object-cover" />
            ) : (
              <span>{firstInitial(group.name)}</span>
            )}
          </div>

          {/* Celebration text */}
          <div className="text-5xl mb-4 select-none" aria-hidden="true">
            <span className="animate-bounce-gentle inline-block" style={{ animationDelay: '0s' }}>
              &#127881;
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight drop-shadow-lg">
            Welcome to {group.name},
            <br />
            {userName}!
          </h1>
          <p className="text-white/70 text-base sm:text-lg font-light mt-3 drop-shadow max-w-lg mx-auto">
            You&apos;re officially part of the crew. Let&apos;s get you started.
          </p>
        </div>
      </section>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="max-w-xl mx-auto px-5 sm:px-6 -mt-6 pb-24 relative z-10">
        <div
          className="space-y-5 transition-all duration-700 ease-out"
          style={{
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(24px)',
            transitionDelay: '200ms',
          }}
        >
          {/* ── Warm Introductions ─────────────────────────────────── */}
          {hasConnections ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
              <div className="flex items-center gap-2 mb-1">
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color: group.colour }}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
                <h2 className="text-base font-bold text-gray-900">
                  You already know people here!
                </h2>
              </div>
              <p className="text-xs text-gray-500 mb-4 ml-7">
                Say hello and break the ice.
              </p>

              <div className="space-y-3">
                {connections.map((conn) => (
                  <ConnectionCard
                    key={conn.userId}
                    connection={conn}
                    colour={group.colour}
                    onSayHello={() => handleSayHello(conn.userId)}
                    loading={loadingDmId === conn.userId}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 text-center">
              <div className="text-4xl mb-3 select-none" aria-hidden="true">
                &#128038;
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1.5">
                You&apos;re one of the early birds!
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
                The group is still growing. Invite your friends to make it even better.
              </p>
            </div>
          )}

          {/* ── Invite Share (shown when no connections or always as secondary) ─── */}
          {!hasConnections && (
            <InviteShareSection
              groupSlug={group.slug}
              groupName={group.name}
              colour={group.colour}
            />
          )}

          {/* ── Next Event Card ────────────────────────────────────── */}
          {nextEvent && (
            <NextEventCard event={nextEvent} colour={group.colour} />
          )}

          {/* ── Invite friends (when connections exist, show smaller version) ── */}
          {hasConnections && (
            <InviteShareSection
              groupSlug={group.slug}
              groupName={group.name}
              colour={group.colour}
            />
          )}

          {/* ── View Group CTA ─────────────────────────────────────── */}
          <Link
            href={`/g/${group.slug}`}
            className="block w-full py-4 rounded-2xl text-center font-bold text-sm transition-all hover:shadow-md active:scale-[0.98] border-2"
            style={{
              borderColor: group.colour,
              color: group.colour,
              backgroundColor: group.colour + '08',
            }}
          >
            View the group
          </Link>
        </div>
      </main>

      {/* ── Keyframe animations ─────────────────────────────────────── */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(-20px) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translateY(calc(100vh + 20px)) rotate(720deg);
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear both;
        }
        @keyframes bounce-gentle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
