'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BadgeGallery, type BadgeData } from '@/components/gamification/BadgeGallery'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Group {
  id: string
  name: string
  slug: string
  primaryColour: string
}

interface MemberData {
  userId: string
  fullName: string
  avatarUrl: string | null
  email: string | null
  role: string
  joinedAt: string
  tier: string
  crewScore: number
  spiritPoints: number
  lastActive: string | null
  attendanceRate: number
  noShowRate: number
  eventsAttended: number
  totalRsvps: number
}

interface RsvpEntry {
  eventId: string
  eventTitle: string
  eventDate: string
  rsvpStatus: string
  checkedIn: boolean
}

interface MemberInsightsClientProps {
  group: Group
  member: MemberData
  rsvpHistory: RsvpEntry[]
  badges: BadgeData[]
  lastNudgeAt: string | null
}

// ─── Tier Config ────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  string,
  { bg: string; text: string; label: string; emoji: string }
> = {
  newcomer: { bg: '#F3F4F6', text: '#6B7280', label: 'Newcomer', emoji: '\u{1F331}' },
  regular: { bg: '#DBEAFE', text: '#1D4ED8', label: 'Regular', emoji: '\u2B50' },
  dedicated: { bg: '#D1FAE5', text: '#065F46', label: 'Dedicated', emoji: '\u{1F4AA}' },
  veteran: { bg: '#EDE9FE', text: '#5B21B6', label: 'Veteran', emoji: '\u{1F3C6}' },
  legend: { bg: '#FEF3C7', text: '#92400E', label: 'Legend', emoji: '\u{1F451}' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hex(c: string) {
  return c.startsWith('#') ? c : `#${c}`
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getActivityStatus(
  lastActive: string | null
): { label: string; colour: string; bg: string } {
  const days = daysSince(lastActive)
  if (days === null) return { label: 'Inactive', colour: '#6B7280', bg: '#F3F4F6' }
  if (days <= 30) return { label: 'Active', colour: '#059669', bg: '#D1FAE5' }
  if (days <= 90) return { label: 'At Risk', colour: '#D97706', bg: '#FEF3C7' }
  return { label: 'Inactive', colour: '#6B7280', bg: '#F3F4F6' }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const days = daysSince(dateStr)
  if (days === null) return 'Never'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
      />
    </svg>
  )
}

function ChatBubbleIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
      />
    </svg>
  )
}

// ─── Nudge Modal ────────────────────────────────────────────────────────────

function NudgeModal({
  memberName,
  groupSlug,
  memberId,
  colour,
  onClose,
  canNudge,
  lastNudgeAt,
}: {
  memberName: string
  groupSlug: string
  memberId: string
  colour: string
  onClose: () => void
  canNudge: boolean
  lastNudgeAt: string | null
}) {
  const firstName = memberName.split(' ')[0]
  const [message, setMessage] = useState(
    `Hey ${firstName}! We haven't seen you in a while and would love to have you back at our next event. Let us know if there's anything we can do to help!`
  )
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!canNudge) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/groups/${groupSlug}/members/${memberId}/nudge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, type: 'dm' }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send nudge')
      } else {
        setSent(true)
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            Send nudge to {firstName}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            This will send a direct message to the member.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {sent ? (
            <div className="py-8 text-center">
              <p className="text-4xl mb-3 select-none">{'\u2705'}</p>
              <p className="text-sm font-semibold text-gray-900">Nudge sent!</p>
              <p className="text-xs text-gray-400 mt-1">
                {firstName} will see your message in their DMs.
              </p>
            </div>
          ) : !canNudge ? (
            <div className="py-8 text-center">
              <p className="text-4xl mb-3 select-none">{'\u23F3'}</p>
              <p className="text-sm font-semibold text-gray-900">
                Nudge cooldown active
              </p>
              <p className="text-xs text-gray-400 mt-1">
                A nudge was sent on {lastNudgeAt ? formatDate(lastNudgeAt) : 'recently'}.
                You can send another after 14 days.
              </p>
            </div>
          ) : (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100 resize-none transition-all"
                placeholder="Write your message..."
              />
              {error && (
                <p className="text-xs text-red-600 mt-2">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {sent ? 'Close' : 'Cancel'}
          </button>
          {!sent && canNudge && (
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: colour }}
            >
              <ChatBubbleIcon />
              {sending ? 'Sending...' : 'Send DM'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MemberInsightsClient({
  group,
  member,
  rsvpHistory,
  badges,
  lastNudgeAt,
}: MemberInsightsClientProps) {
  const colour = hex(group.primaryColour)
  const tier = TIER_CONFIG[member.tier] ?? TIER_CONFIG.newcomer
  const activityStatus = getActivityStatus(member.lastActive)
  const [showNudgeModal, setShowNudgeModal] = useState(false)

  // Can nudge: no nudge in last 14 days
  const canNudge = !lastNudgeAt || daysSince(lastNudgeAt)! >= 14

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {/* Back link */}
          <Link
            href={`/g/${group.slug}/admin/members`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-5"
          >
            <ArrowLeftIcon />
            <span className="font-medium">Members</span>
          </Link>

          {/* Profile Header */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.avatarUrl}
                alt={member.fullName}
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0"
                style={{ backgroundColor: colour }}
              >
                {initials(member.fullName)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-gray-900">
                  {member.fullName}
                </h1>
                {/* Tier badge */}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: tier.bg, color: tier.text }}
                >
                  {tier.emoji} {tier.label}
                </span>
                {/* Activity status */}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: activityStatus.bg,
                    color: activityStatus.colour,
                  }}
                >
                  {activityStatus.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Joined {formatDate(member.joinedAt)}
                {member.role !== 'member' && (
                  <span className="ml-2 text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {member.role === 'super_admin' ? 'Admin' : 'Co-admin'}
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Last active: {formatRelativeDate(member.lastActive)}
              </p>
            </div>

            {/* Nudge button */}
            <button
              onClick={() => setShowNudgeModal(true)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 flex items-center gap-2"
              style={{ backgroundColor: colour }}
            >
              <ChatBubbleIcon />
              <span className="hidden sm:inline">Nudge</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Engagement Summary ────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Events Attended"
            value={String(member.eventsAttended)}
            sub={`of ${member.totalRsvps} RSVPs`}
            colour={colour}
          />
          <StatCard
            label="Attendance Rate"
            value={`${member.attendanceRate}%`}
            sub={member.noShowRate > 0 ? `${member.noShowRate}% no-show` : 'No no-shows'}
            colour={member.attendanceRate >= 70 ? '#059669' : member.attendanceRate >= 40 ? '#D97706' : '#DC2626'}
          />
          <StatCard
            label="Spirit Points"
            value={String(member.spiritPoints)}
            sub="total earned"
            colour="#C9982A"
          />
          <StatCard
            label="Crew Score"
            value={String(member.crewScore)}
            sub={`${tier.emoji} ${tier.label}`}
            colour={tier.text}
          />
        </div>

        {/* ── Event History ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-base font-bold text-gray-900">Event History</h2>
          </div>

          {rsvpHistory.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">No event history yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
                    <th className="px-5 py-3">Event</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">RSVP</th>
                    <th className="px-5 py-3">Check-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rsvpHistory.map((r) => {
                    const isPast = new Date(r.eventDate) < new Date()
                    let rsvpColour = '#6B7280'
                    let rsvpBg = '#F3F4F6'
                    if (r.rsvpStatus === 'going') {
                      rsvpColour = '#059669'
                      rsvpBg = '#D1FAE5'
                    } else if (r.rsvpStatus === 'maybe') {
                      rsvpColour = '#D97706'
                      rsvpBg = '#FEF3C7'
                    } else if (r.rsvpStatus === 'cancelled' || r.rsvpStatus === 'not_going') {
                      rsvpColour = '#DC2626'
                      rsvpBg = '#FEE2E2'
                    }

                    let checkinLabel = '-'
                    let checkinColour = '#9CA3AF'
                    let checkinBg = '#F3F4F6'
                    if (r.checkedIn) {
                      checkinLabel = 'Checked in'
                      checkinColour = '#059669'
                      checkinBg = '#D1FAE5'
                    } else if (isPast && r.rsvpStatus === 'going') {
                      checkinLabel = 'No-show'
                      checkinColour = '#D97706'
                      checkinBg = '#FEF3C7'
                    } else if (!isPast) {
                      checkinLabel = 'Upcoming'
                      checkinColour = '#6B7280'
                      checkinBg = '#F3F4F6'
                    }

                    return (
                      <tr key={r.eventId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                            {r.eventTitle}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-gray-600">
                            {formatShortDate(r.eventDate)}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                            style={{ backgroundColor: rsvpBg, color: rsvpColour }}
                          >
                            {r.rsvpStatus.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: checkinBg, color: checkinColour }}
                          >
                            {checkinLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Badges ───────────────────────────────────────────────── */}
        <BadgeGallery
          badges={badges}
          showAll
          groupColour={colour}
        />
      </div>

      {/* Nudge Modal */}
      {showNudgeModal && (
        <NudgeModal
          memberName={member.fullName}
          groupSlug={group.slug}
          memberId={member.userId}
          colour={colour}
          onClose={() => setShowNudgeModal(false)}
          canNudge={canNudge}
          lastNudgeAt={lastNudgeAt}
        />
      )}
    </div>
  )
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  colour,
}: {
  label: string
  value: string
  sub: string
  colour: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-2xl font-black" style={{ color: colour }}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}
