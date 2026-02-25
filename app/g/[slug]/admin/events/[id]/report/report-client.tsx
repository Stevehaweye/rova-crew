'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { EventReport } from '@/lib/event-report'

interface Props {
  report: EventReport
  groupSlug: string
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
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

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  newcomer: { bg: '#F3F4F6', text: '#6B7280', label: 'Newcomer' },
  regular: { bg: '#DBEAFE', text: '#1D4ED8', label: 'Regular' },
  dedicated: { bg: '#D1FAE5', text: '#065F46', label: 'Dedicated' },
  veteran: { bg: '#EDE9FE', text: '#5B21B6', label: 'Veteran' },
  legend: { bg: '#FEF3C7', text: '#92400E', label: 'Legend' },
}

export default function ReportClient({ report, groupSlug }: Props) {
  const { event, group, attendance, photos, photoContributors, ratings, ratingResponseRate, finance, attendeeDetails, noShows, waitlistCount } = report
  const [attendeesOpen, setAttendeesOpen] = useState(true)
  const [noShowsOpen, setNoShowsOpen] = useState(false)

  const attendanceColour =
    attendance.attendanceRate >= 80
      ? '#16A34A'
      : attendance.attendanceRate >= 60
        ? '#D97706'
        : '#DC2626'

  const maxDistribution = Math.max(...ratings.distribution, 1)

  function exportCSV() {
    const rows: string[][] = [['Name', 'Tier', 'Check-in Time', 'Payment Status']]
    for (const a of attendeeDetails) {
      rows.push([
        a.fullName,
        a.tier,
        a.checkedInAt
          ? new Date(a.checkedInAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Not checked in',
        a.paymentStatus ?? 'N/A',
      ])
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '-')}-attendees.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {event.date}
          {event.location && ` · ${event.location}`}
        </p>
      </div>

      {/* ── Stat Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Card 1: Attendance */}
        <div
          className="bg-white rounded-2xl p-5 shadow-sm border-l-4"
          style={{ borderLeftColor: attendanceColour }}
        >
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Attendance</h3>
          <p className="text-3xl font-bold text-gray-900">
            {attendance.attendedCount}
            <span className="text-lg font-normal text-gray-400">
              /{attendance.rsvpCount}
            </span>
          </p>
          <p className="text-sm mt-1" style={{ color: attendanceColour }}>
            {attendance.attendanceRate}% attendance rate
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {attendance.noShowCount} no-show{attendance.noShowCount !== 1 ? 's' : ''}
            {waitlistCount > 0 && ` · ${waitlistCount} waitlisted`}
          </p>
        </div>

        {/* Card 2: Photos */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Photos</h3>
          <p className="text-3xl font-bold text-gray-900">{photos.count}</p>
          <p className="text-sm text-gray-600 mt-1">
            {photoContributors} member{photoContributors !== 1 ? 's' : ''} contributed
          </p>
          {photos.count > 0 && (
            <Link
              href={`/events/${event.id}/photos`}
              className="inline-block text-sm font-semibold mt-2 hover:underline"
              style={{ color: group.colour }}
            >
              View gallery →
            </Link>
          )}
        </div>

        {/* Card 3: Ratings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Ratings</h3>
          {ratings.ratingCount > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl font-bold text-gray-900">{ratings.avgRating}</span>
                <div>
                  <StarDisplay rating={ratings.avgRating} />
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ratings.ratingCount} rating{ratings.ratingCount !== 1 ? 's' : ''} (
                    {ratingResponseRate}% response rate)
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-3">{star}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(ratings.distribution[star - 1] / maxDistribution) * 100}%`,
                          backgroundColor: '#F59E0B',
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-4 text-right">
                      {ratings.distribution[star - 1]}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">No ratings yet</p>
          )}
        </div>

        {/* Card 4: Payments (conditional) */}
        {finance && finance.isPaidEvent && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Payments</h3>
            <p className="text-3xl font-bold text-gray-900">
              {formatPence(finance.totalCollectedPence)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              from {finance.paymentCount} member{finance.paymentCount !== 1 ? 's' : ''}
            </p>
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Paid out to {group.name}</span>
                <span className="font-semibold text-gray-700">
                  {formatPence(finance.payoutPence)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Platform fee</span>
                <span>{formatPence(finance.platformFeePence)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Attendee List ── */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
        <button
          type="button"
          onClick={() => setAttendeesOpen(!attendeesOpen)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <h2 className="text-base font-bold text-gray-900">
            Attendees ({attendeeDetails.length})
          </h2>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${attendeesOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {attendeesOpen && (
          <div className="border-t border-gray-100">
            {/* Export button */}
            <div className="px-5 py-3 border-b border-gray-50">
              <button
                type="button"
                onClick={exportCSV}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Export as CSV
              </button>
            </div>

            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px] gap-3 px-5 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span>Name</span>
              <span>Tier</span>
              <span>Check-in</span>
              <span>Payment</span>
            </div>

            {/* Rows */}
            {attendeeDetails.map((a) => {
              const tier = TIER_STYLES[a.tier] ?? TIER_STYLES.newcomer
              const checkinTime = a.checkedInAt
                ? new Date(a.checkedInAt).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'

              return (
                <div
                  key={a.userId}
                  className="sm:grid sm:grid-cols-[1fr_100px_100px_100px] gap-3 px-5 py-3 border-b border-gray-50 last:border-0"
                >
                  {/* Name + avatar */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
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
                    <span className="text-sm font-medium text-gray-900 truncate">{a.fullName}</span>
                  </div>

                  {/* Tier */}
                  <div className="flex items-center">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: tier.bg, color: tier.text }}
                    >
                      {tier.label}
                    </span>
                  </div>

                  {/* Check-in time */}
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600">{checkinTime}</span>
                  </div>

                  {/* Payment */}
                  <div className="flex items-center">
                    {a.paymentStatus ? (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          a.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {a.paymentStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </div>
              )
            })}

            {attendeeDetails.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No attendees checked in
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── No-Shows ── */}
      {noShows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setNoShowsOpen(!noShowsOpen)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-base font-bold text-gray-900">
              No-shows ({noShows.length})
            </h2>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${noShowsOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {noShowsOpen && (
            <div className="border-t border-gray-100">
              <p className="px-5 py-3 text-xs text-gray-500 border-b border-gray-50">
                These members RSVPd but did not attend.
              </p>

              {noShows.map((ns) => (
                <div
                  key={ns.userId}
                  className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                      {ns.avatarUrl ? (
                        <img
                          src={ns.avatarUrl}
                          alt={ns.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: group.colour }}
                        >
                          {initials(ns.fullName)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ns.fullName}</p>
                      <p className="text-xs text-gray-400">
                        RSVPd{' '}
                        {new Date(ns.rsvpTime).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/messages?start=${ns.userId}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
                  >
                    Send nudge
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
