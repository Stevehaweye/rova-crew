'use client'

import Link from 'next/link'
import { TierBadge } from '@/components/gamification/TierBadge'
import type { MonthlyBoardData, BoardEntry, CurrentUserBoardEntry } from '@/lib/monthly-board'

// ─── Props ──────────────────────────────────────────────────────────────────

interface BoardClientProps {
  boardData: MonthlyBoardData
  groupColour: string
  groupSlug: string
  groupName: string
  currentUserId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonthName(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  const date = new Date(year, month - 1)
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function getDaysUntilReset(): number {
  const now = new Date()
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 86400000)
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({
  name,
  avatarUrl,
  size,
  colour,
}: {
  name: string
  avatarUrl: string | null
  size: string
  colour: string
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${size} rounded-full object-cover ring-2 ring-white shadow-sm`}
      />
    )
  }

  return (
    <div
      className={`${size} rounded-full flex items-center justify-center text-white font-bold ring-2 ring-white shadow-sm`}
      style={{ backgroundColor: colour, fontSize: size === 'w-16 h-16' ? '1rem' : size === 'w-12 h-12' ? '0.75rem' : '0.625rem' }}
    >
      {initials(name)}
    </div>
  )
}

// ─── Podium card ────────────────────────────────────────────────────────────

function PodiumCard({
  entry,
  rank,
  colour,
}: {
  entry: BoardEntry
  rank: 1 | 2 | 3
  colour: string
}) {
  const configs = {
    1: {
      gradient: 'from-yellow-100 to-yellow-50',
      avatarSize: 'w-16 h-16',
      crown: true,
      order: 'order-2',
      height: 'pt-2',
      ringColour: 'ring-yellow-300',
    },
    2: {
      gradient: 'from-slate-100 to-slate-50',
      avatarSize: 'w-12 h-12',
      crown: false,
      order: 'order-1',
      height: 'pt-6',
      ringColour: 'ring-slate-300',
    },
    3: {
      gradient: 'from-amber-100 to-amber-50',
      avatarSize: 'w-12 h-12',
      crown: false,
      order: 'order-3',
      height: 'pt-6',
      ringColour: 'ring-amber-200',
    },
  } as const

  const config = configs[rank]

  return (
    <div className={`flex-1 ${config.order} ${config.height}`}>
      <div
        className={`bg-gradient-to-b ${config.gradient} rounded-2xl p-4 flex flex-col items-center text-center border border-gray-100`}
      >
        {config.crown && <span className="text-xl mb-1 select-none">👑</span>}

        <div className="relative mb-2">
          <Avatar
            name={entry.fullName}
            avatarUrl={entry.avatarUrl}
            size={config.avatarSize}
            colour={colour}
          />
          <span
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: colour }}
          >
            #{rank}
          </span>
        </div>

        <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-1 w-full">
          {entry.fullName.split(' ')[0]}
        </p>

        <div className="mt-1">
          <TierBadge
            tierLevel={entry.tierLevel as 1 | 2 | 3 | 4 | 5}
            tierName={entry.tierName}
            size="sm"
          />
        </div>

        <p className="text-lg font-black mt-2" style={{ color: colour }}>
          {entry.attendanceRate}%
        </p>
        <p className="text-[10px] text-gray-400">
          {entry.eventsAttended}/{entry.eventsAvailable} events
        </p>
      </div>
    </div>
  )
}

// ─── List row (ranks 4-10) ──────────────────────────────────────────────────

function ListRow({
  entry,
  isCurrentUser,
  colour,
}: {
  entry: BoardEntry
  isCurrentUser: boolean
  colour: string
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
        isCurrentUser ? 'border-l-2 bg-teal-50/50' : 'bg-white'
      }`}
      style={isCurrentUser ? { borderLeftColor: colour } : undefined}
    >
      <span className="w-6 text-center text-xs font-bold text-gray-400">
        #{entry.rank}
      </span>

      <Avatar
        name={entry.fullName}
        avatarUrl={entry.avatarUrl}
        size="w-8 h-8"
        colour={colour}
      />

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {entry.fullName.split(' ')[0]}
        </p>
        <TierBadge
          tierLevel={entry.tierLevel as 1 | 2 | 3 | 4 | 5}
          tierName={entry.tierName}
          size="sm"
        />
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color: colour }}>
          {entry.attendanceRate}%
        </p>
        <p className="text-[10px] text-gray-400">
          {entry.eventsAttended}/{entry.eventsAvailable}
        </p>
      </div>
    </div>
  )
}

// ─── Info tooltip ───────────────────────────────────────────────────────────

function InfoTooltip() {
  return (
    <div className="group relative inline-flex">
      <button className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs hover:bg-gray-200 transition-colors">
        ?
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-56 text-center z-10">
        Ranked by attendance rate, not raw count. A member attending 3/3 events scores the same as one attending 12/12.
      </div>
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ groupName }: { groupName: string }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="text-5xl mb-4 select-none">📊</div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">No board data yet</h2>
      <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
        The board will populate once {groupName} has events this month and members check in.
      </p>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function BoardClient({
  boardData,
  groupColour,
  groupSlug,
  groupName,
  currentUserId,
}: BoardClientProps) {
  const daysLeft = getDaysUntilReset()

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href={`/g/${groupSlug}`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <Link href="/home" className="select-none">
            <span className="text-base font-black tracking-[0.14em]" style={{ color: '#0D7377' }}>ROVA</span>
            <span className="text-base font-black tracking-[0.14em]" style={{ color: '#C9982A' }}>CREW</span>
          </Link>
          <span className="text-gray-300 text-lg">&middot;</span>
          <span className="text-sm font-semibold text-gray-600">Board</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {getMonthName(boardData.month)} Board
            </h1>
            <InfoTooltip />
          </div>
          <p className="text-gray-500 text-sm">
            Resets in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-8">
          <button
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white shadow-sm"
            style={{ color: groupColour }}
          >
            Monthly Rate
          </button>
          <button
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 opacity-50 cursor-not-allowed"
            disabled
          >
            All-Time <span className="text-[10px]">Soon</span>
          </button>
          <button
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 opacity-50 cursor-not-allowed"
            disabled
          >
            Spirit Points <span className="text-[10px]">Soon</span>
          </button>
        </div>

        {boardData.totalQualifyingMembers === 0 ? (
          <EmptyState groupName={groupName} />
        ) : (
          <>
            {/* Podium — Top 3 */}
            {boardData.topTen.length >= 3 && (
              <div className="flex gap-3 mb-6">
                <PodiumCard entry={boardData.topTen[1]} rank={2} colour={groupColour} />
                <PodiumCard entry={boardData.topTen[0]} rank={1} colour={groupColour} />
                <PodiumCard entry={boardData.topTen[2]} rank={3} colour={groupColour} />
              </div>
            )}

            {/* If fewer than 3, show as list instead */}
            {boardData.topTen.length > 0 && boardData.topTen.length < 3 && (
              <div className="space-y-2 mb-6">
                {boardData.topTen.map((entry) => (
                  <ListRow
                    key={entry.userId}
                    entry={entry}
                    isCurrentUser={entry.userId === currentUserId}
                    colour={groupColour}
                  />
                ))}
              </div>
            )}

            {/* List — Ranks 4-10 */}
            {boardData.topTen.length > 3 && (
              <div className="space-y-2 mb-4">
                {boardData.topTen.slice(3).map((entry) => (
                  <ListRow
                    key={entry.userId}
                    entry={entry}
                    isCurrentUser={entry.userId === currentUserId}
                    colour={groupColour}
                  />
                ))}
              </div>
            )}

            {/* Gap indicator */}
            {boardData.membersBelowTopTen > 0 && (
              <p className="text-center text-xs text-gray-400 py-3">
                ... and {boardData.membersBelowTopTen} more member{boardData.membersBelowTopTen !== 1 ? 's' : ''}
              </p>
            )}
          </>
        )}
      </main>

      {/* Current user sticky footer */}
      {boardData.currentUserEntry && (
        <CurrentUserFooter entry={boardData.currentUserEntry} colour={groupColour} />
      )}
    </div>
  )
}

// ─── Current user footer ────────────────────────────────────────────────────

function CurrentUserFooter({
  entry,
  colour,
}: {
  entry: CurrentUserBoardEntry
  colour: string
}) {
  const diff = entry.comparedToAverage
  const diffStr = diff > 0 ? `+${diff}%` : `${diff}%`
  const diffColour = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-500'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <span
          className="text-xs font-bold px-2 py-1 rounded-lg text-white"
          style={{ backgroundColor: colour }}
        >
          #{entry.rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">You</p>
          <p className="text-[10px] text-gray-400">
            {entry.eventsAttended}/{entry.eventsAvailable} events
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black" style={{ color: colour }}>
            {entry.attendanceRate}%
          </p>
          <p className={`text-[10px] font-semibold ${diffColour}`}>
            {diffStr} vs avg
          </p>
        </div>
      </div>
    </div>
  )
}
