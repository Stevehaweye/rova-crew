'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { TierBadge } from '@/components/gamification/TierBadge'
import { StreakDisplay } from '@/components/gamification/StreakDisplay'
import { BadgeGallery } from '@/components/gamification/BadgeGallery'
import type { MyStatsData, PillarData } from '@/lib/my-stats'

interface MyStatsClientProps {
  data: MyStatsData
  groupName: string
  groupSlug: string
  colour: string
}

// ─── Section 1: Crew Score Hero ─────────────────────────────────────────────

function CrewScoreHero({
  crewScore,
  tierLevel,
  tierName,
  colour,
}: {
  crewScore: number
  tierLevel: 1 | 2 | 3 | 4 | 5
  tierName: string
  colour: string
}) {
  const [showExplainer, setShowExplainer] = useState(false)
  const pct = Math.round((crewScore / 1000) * 100)
  const deg = Math.round((crewScore / 1000) * 360)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col items-center">
        {/* Circular score */}
        <div
          className="relative w-32 h-32 rounded-full flex items-center justify-center"
          style={{
            background: `conic-gradient(${colour} ${deg}deg, #f3f4f6 ${deg}deg)`,
          }}
        >
          <div className="absolute inset-2 rounded-full bg-white flex flex-col items-center justify-center">
            <span className="text-3xl font-black" style={{ color: colour }}>
              {crewScore}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">/ 1,000</span>
          </div>
        </div>

        {/* Tier badge */}
        <div className="mt-4">
          <TierBadge tierLevel={tierLevel} tierName={tierName} size="lg" />
        </div>

        {/* Explainer toggle */}
        <button
          onClick={() => setShowExplainer((v) => !v)}
          className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          How is this calculated?
        </button>

        {showExplainer && (
          <div className="mt-3 p-4 bg-gray-50 rounded-xl text-xs text-gray-600 leading-relaxed">
            Your Crew Score is made up of four pillars: <strong>Loyalty (40%)</strong>,{' '}
            <strong>Spirit (30%)</strong>, <strong>Adventure (15%)</strong>, and{' '}
            <strong>Legacy (15%)</strong>. Each is your percentile rank in this group.
            Rate, not volume &mdash; attending every event in a low-frequency group counts
            the same as attending every event in a high-frequency one.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section 2: Four Pillar Breakdown ───────────────────────────────────────

function PillarBar({ pillar }: { pillar: PillarData }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">
          {pillar.emoji} {pillar.label} ({pillar.weight})
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: pillar.colour + '15', color: pillar.colour }}
        >
          {pillar.percentile}th
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(pillar.percentile, 2)}%`,
            backgroundColor: pillar.colour,
          }}
        />
      </div>
      <p className="text-[11px] text-gray-400">{pillar.detail}</p>
    </div>
  )
}

function PillarBreakdown({ pillars }: { pillars: PillarData[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <h3 className="text-sm font-bold text-gray-900">Score Breakdown</h3>
      {pillars.map((p) => (
        <PillarBar key={p.label} pillar={p} />
      ))}
    </div>
  )
}

// ─── Section 3: This Month ──────────────────────────────────────────────────

function ThisMonth({
  monthEventsAttended,
  monthEventsAvailable,
  monthRate,
  boardRank,
  boardTotal,
  groupAvgRate,
  spiritPointsThisMonth,
  spiritBreakdown,
  colour,
}: {
  monthEventsAttended: number
  monthEventsAvailable: number
  monthRate: number
  boardRank: number | null
  boardTotal: number
  groupAvgRate: number
  spiritPointsThisMonth: number
  spiritBreakdown: { actionType: string; label: string; points: number }[]
  colour: string
}) {
  const deg = monthEventsAvailable > 0
    ? Math.round((monthEventsAttended / monthEventsAvailable) * 360)
    : 0
  const diff = monthRate - groupAvgRate

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <h3 className="text-sm font-bold text-gray-900">This Month</h3>

      <div className="flex items-center gap-6">
        {/* Donut */}
        <div
          className="relative w-20 h-20 rounded-full flex-shrink-0"
          style={{
            background: monthEventsAvailable > 0
              ? `conic-gradient(${colour} ${deg}deg, #f3f4f6 ${deg}deg)`
              : '#f3f4f6',
          }}
        >
          <div className="absolute inset-2 rounded-full bg-white flex flex-col items-center justify-center">
            <span className="text-lg font-black" style={{ color: colour }}>
              {monthRate}%
            </span>
          </div>
        </div>

        <div className="space-y-1.5 min-w-0">
          <p className="text-sm text-gray-700">
            <span className="font-bold">{monthEventsAttended}</span> / {monthEventsAvailable} events
          </p>
          {boardRank !== null && (
            <p className="text-xs text-gray-500">
              You are <span className="font-semibold">#{boardRank}</span> of {boardTotal} this month
              {diff !== 0 && (
                <span className={diff > 0 ? 'text-emerald-600' : 'text-amber-600'}>
                  {' '}&mdash; {Math.abs(diff)}% {diff > 0 ? 'above' : 'below'} average
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Spirit points breakdown */}
      {spiritPointsThisMonth > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">
            {spiritPointsThisMonth} spirit pts this month
          </p>
          <div className="space-y-1">
            {spiritBreakdown.map((s) => (
              <div key={s.actionType} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{s.label}</span>
                <span className="font-medium text-gray-700">+{s.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section 6: Next Milestone ──────────────────────────────────────────────

function NextMilestoneCard({
  nextMilestone,
  nextEvent,
  colour,
}: {
  nextMilestone: MyStatsData['nextMilestone']
  nextEvent: MyStatsData['nextEvent']
  colour: string
}) {
  if (!nextMilestone && !nextEvent) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      {nextMilestone && (
        <div>
          <p className="text-sm font-bold text-gray-900">
            {nextMilestone.target - nextMilestone.current} more events to reach{' '}
            {nextMilestone.badgeName} {nextMilestone.badgeEmoji}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(nextMilestone.progressPercent, 3)}%`,
                  backgroundColor: colour,
                }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-500 flex-shrink-0">
              {nextMilestone.current}/{nextMilestone.target}
            </span>
          </div>
        </div>
      )}

      {nextEvent && (
        <Link
          href={`/events/${nextEvent.id}`}
          className="block p-3 -mx-1 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <p className="text-xs text-gray-500">Your next upcoming event</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">
            {nextEvent.title} &mdash;{' '}
            {format(new Date(nextEvent.startsAt), 'EEE d MMM')}
            <span className="ml-1" style={{ color: colour }}>&rarr;</span>
          </p>
        </Link>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MyStatsClient({
  data,
  groupName,
  groupSlug,
  colour,
}: MyStatsClientProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/g/${groupSlug}`}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">My Stats</h1>
            <p className="text-xs text-gray-500">{groupName}</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Section 1: Crew Score Hero */}
        <CrewScoreHero
          crewScore={data.crewScore}
          tierLevel={data.tierLevel as 1 | 2 | 3 | 4 | 5}
          tierName={data.tierName}
          colour={colour}
        />

        {/* Section 2: Pillar Breakdown */}
        <PillarBreakdown pillars={data.pillars} />

        {/* Section 3: This Month */}
        <ThisMonth
          monthEventsAttended={data.monthEventsAttended}
          monthEventsAvailable={data.monthEventsAvailable}
          monthRate={data.monthRate}
          boardRank={data.boardRank}
          boardTotal={data.boardTotal}
          groupAvgRate={data.groupAvgRate}
          spiritPointsThisMonth={data.spiritPointsThisMonth}
          spiritBreakdown={data.spiritBreakdown}
          colour={colour}
        />

        {/* Section 4: Streak */}
        <StreakDisplay
          currentStreak={data.currentStreak}
          personalBest={data.bestStreak}
        />

        {/* Section 5: Badges */}
        <BadgeGallery
          badges={data.badges}
          showAll={true}
          groupColour={colour}
          groupName={groupName}
        />

        {/* Section 6: Next Milestone */}
        <NextMilestoneCard
          nextMilestone={data.nextMilestone}
          nextEvent={data.nextEvent}
          colour={colour}
        />
      </div>
    </div>
  )
}
