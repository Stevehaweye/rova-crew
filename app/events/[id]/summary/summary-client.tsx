'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { EventSummary } from '@/lib/post-event-summary'

interface Props {
  summary: EventSummary
  currentUserId: string
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= Math.round(rating) ? '#F59E0B' : '#E5E7EB'}
          stroke="none"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function SummaryClient({ summary }: Props) {
  const { event, group, attendance, attendees, milestones, finance, photos, ratings, spiritPoints, nextEvent } = summary
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [celebratedIndex, setCelebratedIndex] = useState<number | null>(null)

  async function handleShare() {
    setSharing(true)
    try {
      const res = await fetch(`/api/events/${event.id}/summary-card`)
      if (!res.ok) throw new Error('Failed to generate card')
      const { url } = await res.json()

      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: `${event.title} — Event Recap`,
            text: `${attendance.attendedCount} people attended ${event.title}`,
            url,
          })
          return
        } catch {
          // User cancelled — fall through to clipboard
        }
      }

      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[summary] share error:', err)
    } finally {
      setSharing(false)
    }
  }

  function handleCelebrate(index: number) {
    setCelebratedIndex(index)
    setTimeout(() => setCelebratedIndex(null), 1500)
  }

  const maxDistribution = Math.max(...ratings.distribution, 1)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── SECTION A: HERO ── */}
      <div className="relative w-full h-64 overflow-hidden">
        {event.coverUrl ? (
          <>
            <img
              src={event.coverUrl}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${group.colour}dd, ${group.colour}44)`,
              backgroundSize: '22px 22px',
              backgroundImage: `linear-gradient(135deg, ${group.colour}dd, ${group.colour}44), radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)`,
            }}
          />
        )}

        {/* Group logo */}
        <div className="absolute top-4 left-4 z-10">
          {group.logoUrl ? (
            <img
              src={group.logoUrl}
              alt={group.name}
              className="w-10 h-10 rounded-xl ring-2 ring-white/20 object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl ring-2 ring-white/20 flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: group.colour }}
            >
              {initials(group.name)}
            </div>
          )}
        </div>

        {/* Photo count badge */}
        {photos.count > 0 && (
          <div className="absolute bottom-4 right-4 z-10 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
            📸 {photos.count} photos
          </div>
        )}

        {/* Event info */}
        <div className="absolute bottom-4 left-4 right-16 z-10">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg leading-tight">
            {event.title}
          </h1>
          <p className="text-sm text-white/80 mt-1 drop-shadow">
            {event.date}
            {event.location && ` · ${event.location}`}
          </p>
        </div>
      </div>

      <div className="px-4 pb-12 space-y-6 -mt-2">
        {/* ── SECTION B: WHO WAS THERE ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            👥 {attendance.attendedCount} people showed up
          </h2>

          {/* Avatar stack */}
          {attendees.length > 0 && (
            <div className="flex items-center mb-3">
              <div className="flex -space-x-2.5">
                {attendees.slice(0, 8).map((a) => (
                  <div key={a.userId} className="w-10 h-10 rounded-full ring-2 ring-white overflow-hidden flex-shrink-0">
                    {a.avatarUrl ? (
                      <img src={a.avatarUrl} alt={a.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: group.colour }}
                      >
                        {initials(a.fullName)}
                      </div>
                    )}
                  </div>
                ))}
                {attendees.length > 8 && (
                  <div className="w-10 h-10 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                    +{attendees.length - 8}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attendance rate */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Attendance rate: {attendance.attendanceRate}%</span>
            {attendance.attendanceRate >= 90 && (
              <span className="text-orange-500 font-semibold">🔥 Outstanding attendance!</span>
            )}
            {attendance.attendanceRate >= 75 && attendance.attendanceRate < 90 && (
              <span className="text-green-600 font-semibold">👍 Great turnout</span>
            )}
          </div>
        </div>

        {/* ── SECTION C: MILESTONES ── */}
        {milestones.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              🏆 Milestones at this event
            </h2>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleCelebrate(i)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors text-left relative overflow-hidden"
                >
                  <span className="text-2xl">{m.badgeEmoji}</span>
                  <span className="text-sm text-gray-900">
                    <span className="font-semibold">{m.memberName}</span> earned{' '}
                    <span className="font-semibold">{m.badgeName}</span>
                  </span>
                  {celebratedIndex === i && <ConfettiOverlay />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION D: PAYMENT SUMMARY ── */}
        {finance && finance.isPaidEvent && finance.totalCollectedPence > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              💰 Payment summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total collected</span>
                <span className="font-semibold text-gray-900">
                  {formatPence(finance.totalCollectedPence)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paid out to {group.name}</span>
                <span className="font-semibold text-gray-900">
                  {formatPence(finance.payoutPence)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Platform fee</span>
                <span className="text-gray-500">{formatPence(finance.platformFeePence)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION E: PHOTOS ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          {photos.count > 0 ? (
            <>
              {photos.topPhotoUrl && (
                <div className="rounded-xl overflow-hidden mb-3 aspect-video">
                  <img
                    src={photos.topPhotoUrl}
                    alt="Top photo"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <Link
                href={`/events/${event.id}/photos`}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 text-white"
                style={{ backgroundColor: group.colour }}
              >
                Browse {photos.count} photos from this event →
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-3">📷 No photos yet — be the first to upload!</p>
              <Link
                href={`/events/${event.id}/photos`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: group.colour }}
              >
                Upload photos
              </Link>
            </div>
          )}
        </div>

        {/* ── SECTION F: RATINGS ── */}
        {ratings.ratingCount > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-3">⭐ Ratings</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{ratings.avgRating}</div>
                <StarDisplay rating={ratings.avgRating} size={14} />
                <div className="text-xs text-gray-500 mt-1">{ratings.ratingCount} ratings</div>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-3">{star}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(ratings.distribution[star - 1] / maxDistribution) * 100}%`,
                          backgroundColor: '#F59E0B',
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-5 text-right">
                      {ratings.distribution[star - 1]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION G: SPIRIT POINTS ── */}
        {spiritPoints.totalAwarded > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              ⚡ {spiritPoints.totalAwarded} Spirit Points earned
            </h2>
            {spiritPoints.topEarners.length > 0 && (
              <div className="space-y-2">
                {spiritPoints.topEarners.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-purple-600 w-5">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {e.name.split(' ')[0]}
                      </span>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: group.colour }}
                    >
                      {e.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION H: NEXT EVENT ── */}
        {nextEvent && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-600 mb-2">📅 Coming up</p>
            <p className="font-semibold text-gray-900 mb-3">
              {nextEvent.title} — {nextEvent.date}
            </p>
            <Link
              href={`/events/${nextEvent.id}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: group.colour }}
            >
              RSVP now →
            </Link>
          </div>
        )}

        {/* ── SECTION I: SHARE ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          <p className="text-sm text-gray-600 mb-3">Share this event recap</p>
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: group.colour }}
          >
            {sharing ? 'Generating...' : copied ? 'Link copied!' : 'Share →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Mini confetti overlay for milestone celebration ─────────────────────────

function ConfettiOverlay() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.3,
    colour: ['#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#3B82F6'][i % 5],
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            left: `${p.x}%`,
            top: '50%',
            backgroundColor: p.colour,
            animation: `confetti-pop 1s ease-out ${p.delay}s forwards`,
            opacity: 0,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-pop {
          0% { transform: translateY(0) scale(0); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateY(-40px) scale(1) rotate(${Math.random() > 0.5 ? '' : '-'}180deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
