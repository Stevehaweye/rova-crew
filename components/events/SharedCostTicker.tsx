'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  totalCostPence: number
  currentRsvpCount: number
  minParticipants: number
  maxParticipants: number
  eventId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPence(pence: number): string {
  return `\u00a3${(pence / 100).toFixed(2)}`
}

function priceAt(totalPence: number, count: number): number {
  return Math.ceil(totalPence / Math.max(count, 1))
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function ArrowDownIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
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

function CheckCircleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
}

// ─── Animated Counter ───────────────────────────────────────────────────────
// Smoothly interpolates between two numbers over ~600ms

function useAnimatedValue(target: number, duration = 600) {
  const [display, setDisplay] = useState(target)
  const rafRef = useRef<number>(0)
  const startRef = useRef({ value: target, time: 0 })

  useEffect(() => {
    const from = display
    if (from === target) return
    startRef.current = { value: from, time: performance.now() }

    function tick(now: number) {
      const elapsed = now - startRef.current.time
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startRef.current.value + (target - startRef.current.value) * eased
      setDisplay(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])

  return display
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SharedCostTicker({
  totalCostPence,
  currentRsvpCount,
  minParticipants,
  maxParticipants,
  eventId,
}: Props) {
  const [count, setCount] = useState(currentRsvpCount)
  const [dropFlash, setDropFlash] = useState(false)
  const prevCountRef = useRef(currentRsvpCount)

  // ── Calculate prices ────────────────────────────────────────────────────
  const currentPricePence = priceAt(totalCostPence, count)
  const animatedPrice = useAnimatedValue(currentPricePence)

  const isBelowMin = count < minParticipants
  const isAtMax = count >= maxParticipants
  const remaining = minParticipants - count

  // ── Progress bar ────────────────────────────────────────────────────────
  const progressPercent = maxParticipants > 0
    ? Math.min((count / maxParticipants) * 100, 100)
    : 0

  const progressColour = isBelowMin
    ? '#EF4444' // red
    : count < Math.ceil((minParticipants + maxParticipants) / 2)
      ? '#F59E0B' // amber
      : '#10B981' // green

  // ── Detect price drops ──────────────────────────────────────────────────
  const handleCountChange = useCallback((newCount: number) => {
    setCount((prev) => {
      if (newCount > prev) {
        setDropFlash(true)
        setTimeout(() => setDropFlash(false), 1000)
      }
      return newCount
    })
  }, [])

  // Sync with prop changes
  useEffect(() => {
    if (currentRsvpCount !== prevCountRef.current) {
      handleCountChange(currentRsvpCount)
      prevCountRef.current = currentRsvpCount
    }
  }, [currentRsvpCount, handleCountChange])

  // ── Supabase Realtime subscription ──────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`ticker-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const rsvp = payload.new as { status: string }
          if (rsvp.status === 'going' || rsvp.status === 'maybe') {
            setCount((c) => {
              const next = c + 1
              setDropFlash(true)
              setTimeout(() => setDropFlash(false), 1000)
              return next
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guest_rsvps', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const rsvp = payload.new as { status: string }
          if (rsvp.status === 'confirmed') {
            setCount((c) => {
              const next = c + 1
              setDropFlash(true)
              setTimeout(() => setDropFlash(false), 1000)
              return next
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` },
        () => setCount((c) => Math.max(c - 1, 0))
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'guest_rsvps', filter: `event_id=eq.${eventId}` },
        () => setCount((c) => Math.max(c - 1, 0))
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId])

  // ── Milestone price points ──────────────────────────────────────────────
  const halfway = Math.ceil((minParticipants + maxParticipants) / 2)
  const milestones = [
    { people: minParticipants, pence: priceAt(totalCostPence, minParticipants) },
    ...(halfway !== minParticipants && halfway !== maxParticipants
      ? [{ people: halfway, pence: priceAt(totalCostPence, halfway) }]
      : []),
    { people: maxParticipants, pence: priceAt(totalCostPence, maxParticipants) },
  ]

  // ── Status message ──────────────────────────────────────────────────────
  let statusIcon: React.ReactNode
  let statusText: string
  let statusColour: string

  if (isAtMax) {
    statusIcon = <LockIcon />
    statusText = 'Full! Every spot taken.'
    statusColour = '#6B7280'
  } else if (isBelowMin) {
    statusIcon = <UsersIcon />
    statusText = `Event needs ${remaining} more ${remaining === 1 ? 'person' : 'people'} to run`
    statusColour = '#EF4444'
  } else {
    statusIcon = <CheckCircleIcon />
    statusText = 'Event is on! Price drops with every RSVP'
    statusColour = '#10B981'
  }

  return (
    <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
      {/* Background pulse on price drop */}
      {dropFlash && (
        <div className="absolute inset-0 pointer-events-none animate-ticker-pulse z-0" />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
            Split the cost
          </p>
          <div className="flex items-center gap-1 text-xs font-semibold text-blue-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            Live
          </div>
        </div>
      </div>

      <div className="bg-white px-5 pt-5 pb-5 relative z-10">
        {/* ── Big price display ───────────────────────────────────── */}
        <div className="text-center mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Per person right now
          </p>
          <div className="relative inline-flex items-center gap-2">
            <span
              className="text-5xl sm:text-6xl font-black tabular-nums transition-all duration-500 ease-out"
              style={{
                color: dropFlash ? '#059669' : '#111827',
                transform: dropFlash ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              {formatPence(Math.round(animatedPrice))}
            </span>
            {dropFlash && (
              <span className="text-emerald-500 animate-bounce">
                <ArrowDownIcon />
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Total: {formatPence(totalCostPence)}
          </p>
        </div>

        {/* ── Progress bar ────────────────────────────────────────── */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs font-medium mb-1.5">
            <span className="text-gray-700">
              <strong>{count}</strong> of {maxParticipants} people committed
            </span>
            {!isBelowMin && !isAtMax && (
              <span className="text-emerald-600 font-semibold">
                {Math.round(progressPercent)}%
              </span>
            )}
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
            {/* Minimum threshold marker */}
            {minParticipants < maxParticipants && (
              <div
                className="absolute top-0 bottom-0 w-px bg-gray-300 z-10"
                style={{ left: `${(minParticipants / maxParticipants) * 100}%` }}
              />
            )}
            <div
              className="h-full rounded-full transition-all duration-700 ease-out relative"
              style={{
                width: `${Math.max(progressPercent, 3)}%`,
                backgroundColor: progressColour,
              }}
            >
              {/* Shimmer on active fill */}
              {!isAtMax && count > 0 && (
                <div className="absolute inset-0 overflow-hidden rounded-full">
                  <div className="animate-ticker-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </div>
              )}
            </div>
          </div>
          {isBelowMin && minParticipants < maxParticipants && (
            <p className="text-[10px] text-gray-400 mt-1" style={{ marginLeft: `${Math.max((minParticipants / maxParticipants) * 100 - 4, 0)}%` }}>
              min: {minParticipants}
            </p>
          )}
        </div>

        {/* ── Milestone price points ──────────────────────────────── */}
        <div className="mt-4 bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
            Price at milestones
          </p>
          <div className="flex items-stretch justify-between gap-1">
            {milestones.map((m, i) => {
              const isActive = count >= m.people
              const isCurrent = count === m.people
              return (
                <div
                  key={m.people}
                  className="flex-1 text-center relative"
                >
                  {i > 0 && (
                    <div className="absolute left-0 top-1 bottom-1 w-px bg-gray-200" />
                  )}
                  <p
                    className="text-lg font-black tabular-nums transition-colors duration-300"
                    style={{ color: isCurrent ? '#059669' : isActive ? '#111827' : '#9CA3AF' }}
                  >
                    {formatPence(m.pence)}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                    {m.people} {m.people === 1 ? 'person' : 'people'}
                  </p>
                  {isCurrent && (
                    <div className="mx-auto mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Status message ──────────────────────────────────────── */}
        <div
          className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg transition-colors duration-300"
          style={{
            color: statusColour,
            backgroundColor: statusColour + '0C',
          }}
        >
          {statusIcon}
          {statusText}
          {!isBelowMin && !isAtMax && (
            <span className="inline-block animate-bounce ml-0.5" style={{ animationDuration: '1.5s' }}>&darr;</span>
          )}
        </div>
      </div>

      {/* ── Animations ────────────────────────────────────────────── */}
      <style>{`
        @keyframes ticker-pulse {
          0% { background-color: rgba(16, 185, 129, 0.12); }
          100% { background-color: transparent; }
        }
        .animate-ticker-pulse {
          animation: ticker-pulse 1s ease-out forwards;
        }
        @keyframes ticker-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-ticker-shimmer {
          animation: ticker-shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
