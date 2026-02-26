'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BadgeData {
  id: string
  slug: string
  name: string
  emoji: string
  description: string
  category: string
  awardedAt: string | null
}

interface BadgeGalleryProps {
  badges: BadgeData[]
  showAll?: boolean
  groupColour: string
  showFirstStepsCelebration?: boolean
  groupName?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Badge card ─────────────────────────────────────────────────────────────

function BadgeCard({
  badge,
  earned,
  compact,
}: {
  badge: BadgeData
  earned: boolean
  compact?: boolean
}) {
  const [showHint, setShowHint] = useState(false)

  if (compact) {
    return (
      <div className="flex flex-col items-center text-center">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-sm ${
            earned ? 'bg-white ring-2 ring-gray-100' : 'bg-gray-100 grayscale opacity-40'
          }`}
        >
          {badge.emoji}
        </div>
        <p className={`text-[10px] font-semibold mt-1.5 leading-tight ${earned ? 'text-gray-700' : 'text-gray-400'}`}>
          {badge.name}
        </p>
      </div>
    )
  }

  return (
    <button
      className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
        earned
          ? 'bg-white border-gray-100 shadow-sm'
          : 'bg-gray-50 border-gray-100 opacity-60'
      }`}
      onClick={() => !earned && setShowHint(!showHint)}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 ${
          earned ? 'bg-white shadow-sm ring-1 ring-gray-100' : 'grayscale'
        }`}
      >
        {badge.emoji}
      </div>
      <p className={`text-xs font-semibold leading-tight ${earned ? 'text-gray-900' : 'text-gray-400'}`}>
        {badge.name}
      </p>
      {earned && badge.awardedAt && (
        <p className="text-[10px] text-gray-400 mt-0.5">
          {formatDate(badge.awardedAt)}
        </p>
      )}
      {!earned && showHint && (
        <p className="text-[10px] text-gray-400 mt-1 leading-snug">
          {badge.description}
        </p>
      )}
      {!earned && !showHint && (
        <p className="text-[10px] text-gray-300 mt-0.5">???</p>
      )}
    </button>
  )
}

// ─── First Steps celebration ────────────────────────────────────────────────

function FirstStepsCelebration({
  groupName,
  onDismiss,
}: {
  groupName: string
  onDismiss: () => void
}) {
  useEffect(() => {
    // Fire confetti (dynamic import to reduce bundle size)
    let cancelled = false

    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return
      const duration = 2000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#0D7377', '#C9982A', '#FFD700', '#FF6B6B', '#4ECDC4'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#0D7377', '#C9982A', '#FFD700', '#FF6B6B', '#4ECDC4'],
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()
    })

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(onDismiss, 3000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-6"
      onClick={onDismiss}
    >
      <div className="text-center animate-bounce-once">
        <div className="text-7xl mb-4 select-none">👟</div>
        <h2 className="text-2xl font-black text-white mb-2">Welcome to the crew!</h2>
        <p className="text-white/70 text-sm">
          {groupName} is glad you&apos;re here.
        </p>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function BadgeGallery({
  badges,
  showAll = false,
  groupColour,
  showFirstStepsCelebration = false,
  groupName = '',
}: BadgeGalleryProps) {
  const [showCelebration, setShowCelebration] = useState(showFirstStepsCelebration)
  const [expanded, setExpanded] = useState(showAll)

  const handleDismiss = useCallback(() => {
    setShowCelebration(false)
  }, [])

  const earnedBadges = badges.filter((b) => b.awardedAt)
  const earnedCount = earnedBadges.length

  // Sort earned badges by most recent first
  const sortedEarned = [...earnedBadges].sort(
    (a, b) => new Date(b.awardedAt!).getTime() - new Date(a.awardedAt!).getTime()
  )

  if (!expanded) {
    // Default view: show 3 most recent earned badges
    const recentThree = sortedEarned.slice(0, 3)

    return (
      <>
        {showCelebration && (
          <FirstStepsCelebration groupName={groupName} onDismiss={handleDismiss} />
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Badges</h3>
            <span className="text-xs text-gray-400">
              {earnedCount}/{badges.length}
            </span>
          </div>

          {recentThree.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              No badges earned yet. Keep going!
            </p>
          ) : (
            <div className="flex items-center justify-center gap-6">
              {recentThree.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} earned compact />
              ))}
            </div>
          )}

          {badges.length > 3 && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-4 w-full text-center text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: groupColour }}
            >
              View all {badges.length} badges &rarr;
            </button>
          )}
        </div>
      </>
    )
  }

  // Full gallery view
  const unearnedBadges = badges.filter((b) => !b.awardedAt)

  return (
    <>
      {showCelebration && (
        <FirstStepsCelebration groupName={groupName} onDismiss={handleDismiss} />
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">
            Badges
            <span className="ml-2 text-xs font-normal text-gray-400">
              {earnedCount}/{badges.length}
            </span>
          </h3>
          {!showAll && (
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Collapse
            </button>
          )}
        </div>

        {/* Earned badges */}
        {sortedEarned.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
            {sortedEarned.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} earned />
            ))}
          </div>
        )}

        {/* Divider */}
        {sortedEarned.length > 0 && unearnedBadges.length > 0 && (
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 border-t border-gray-100" />
            <span className="text-[10px] text-gray-300 uppercase tracking-wider">Locked</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>
        )}

        {/* Unearned badges */}
        {unearnedBadges.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {unearnedBadges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} earned={false} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
