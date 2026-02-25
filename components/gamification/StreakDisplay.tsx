'use client'

interface StreakDisplayProps {
  currentStreak: number
  personalBest: number
}

export function StreakDisplay({ currentStreak, personalBest }: StreakDisplayProps) {
  // No current streak and no meaningful history — show nothing
  if (currentStreak === 0 && personalBest < 3) {
    return null
  }

  // No current streak but had a meaningful personal best
  if (currentStreak === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl select-none opacity-60">🔥</span>
          <div>
            <p className="text-sm font-semibold text-gray-700">
              Personal best: {personalBest} in a row
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Attend your next event to start a new streak
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Active streak
  const isNewBest = currentStreak >= personalBest && currentStreak > 1
  const shouldPulse = currentStreak >= 5

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-4">
        <span
          className={`text-4xl select-none ${shouldPulse ? 'animate-pulse' : ''}`}
        >
          🔥
        </span>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">
              {currentStreak}
            </span>
            <span className="text-sm text-gray-500 font-medium">
              events in a row
            </span>
          </div>
          {isNewBest ? (
            <p className="text-xs font-semibold text-amber-600 mt-0.5">
              New personal best!
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">
              Personal best: {personalBest}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
