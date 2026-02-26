'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Group {
  id: string
  name: string
  slug: string
  primaryColour: string
}

interface Member {
  userId: string
  role: string
  joinedAt: string
  fullName: string
  avatarUrl: string | null
  email: string | null
  tier: string
  crewScore: number
  spiritPoints: number
  lastActive: string | null
}

interface PendingMember {
  userId: string
  fullName: string
  avatarUrl: string | null
  email: string | null
  requestedAt: string
}

interface MembersListClientProps {
  group: Group
  members: Member[]
  pendingMembers?: PendingMember[]
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

// ─── Filter / Sort ──────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'at_risk' | 'inactive'
type SortKey = 'most_active' | 'recently_joined' | 'crew_score' | 'alphabetical'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'at_risk', label: 'At Risk' },
  { key: 'inactive', label: 'Inactive' },
]

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'most_active', label: 'Most active' },
  { key: 'recently_joined', label: 'Recently joined' },
  { key: 'crew_score', label: 'Crew score' },
  { key: 'alphabetical', label: 'Alphabetical' },
]

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getActivityStatus(lastActive: string | null): 'active' | 'at_risk' | 'inactive' {
  const days = daysSince(lastActive)
  if (days === null) return 'inactive'
  if (days <= 30) return 'active'
  if (days <= 90) return 'at_risk'
  return 'inactive'
}

function filterMembers(members: Member[], tab: FilterTab): Member[] {
  if (tab === 'all') return members
  return members.filter((m) => getActivityStatus(m.lastActive) === tab)
}

function sortMembers(members: Member[], sort: SortKey): Member[] {
  const sorted = [...members]
  switch (sort) {
    case 'most_active':
      return sorted.sort((a, b) => {
        if (!a.lastActive && !b.lastActive) return 0
        if (!a.lastActive) return 1
        if (!b.lastActive) return -1
        return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
      })
    case 'recently_joined':
      return sorted.sort(
        (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
      )
    case 'crew_score':
      return sorted.sort((a, b) => b.crewScore - a.crewScore)
    case 'alphabetical':
      return sorted.sort((a, b) => a.fullName.localeCompare(b.fullName))
    default:
      return sorted
  }
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MembersListClient({ group, members, pendingMembers = [] }: MembersListClientProps) {
  const router = useRouter()
  const colour = hex(group.primaryColour)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [sortKey, setSortKey] = useState<SortKey>('most_active')
  const [search, setSearch] = useState('')
  const [showPending, setShowPending] = useState(false)
  const [pendingList, setPendingList] = useState(pendingMembers)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const filteredMembers = useMemo(() => {
    let result = filterMembers(members, filterTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          (m.email && m.email.toLowerCase().includes(q))
      )
    }
    return sortMembers(result, sortKey)
  }, [members, filterTab, sortKey, search])

  // Count per tab
  const counts = useMemo(() => {
    const all = members.length
    const active = members.filter((m) => getActivityStatus(m.lastActive) === 'active').length
    const atRisk = members.filter((m) => getActivityStatus(m.lastActive) === 'at_risk').length
    const inactive = members.filter((m) => getActivityStatus(m.lastActive) === 'inactive').length
    return { all, active, at_risk: atRisk, inactive }
  }, [members])

  async function handleMemberAction(userId: string, action: 'approved' | 'blocked') {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/groups/${group.slug}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      })

      if (!res.ok) {
        const data = await res.json()
        setToast(data.error || 'Failed to update member')
        setActionLoading(null)
        return
      }

      setPendingList((prev) => prev.filter((m) => m.userId !== userId))
      setToast(action === 'approved' ? 'Member approved' : 'Request declined')
      setTimeout(() => setToast(null), 4000)
    } catch {
      setToast('Network error. Please try again.')
    }
    setActionLoading(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-[#0D7377] text-white text-sm font-semibold shadow-lg animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href={`/g/${group.slug}/admin`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <ArrowLeftIcon />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Members</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {members.length} member{members.length !== 1 ? 's' : ''} in{' '}
                <span className="font-semibold text-gray-700">{group.name}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Members / Pending toggle */}
        {pendingList.length > 0 && (
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setShowPending(false)}
              className={`flex-1 text-sm font-semibold py-2.5 px-3 rounded-lg transition-all ${
                !showPending ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Members
              <span className="ml-1.5 text-xs text-gray-400">{members.length}</span>
            </button>
            <button
              onClick={() => setShowPending(true)}
              className={`flex-1 text-sm font-semibold py-2.5 px-3 rounded-lg transition-all relative ${
                showPending ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                {pendingList.length}
              </span>
            </button>
          </div>
        )}

        {showPending && pendingList.length > 0 ? (
          /* Pending Members List */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {pendingList.map((pm) => (
                <div key={pm.userId} className="flex items-center gap-3 px-4 sm:px-5 py-4">
                  {/* Avatar */}
                  {pm.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pm.avatarUrl} alt={pm.fullName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: colour }}
                    >
                      {initials(pm.fullName)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{pm.fullName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {pm.email || 'No email'}
                      {' \u00B7 '}
                      Requested {formatDate(pm.requestedAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleMemberAction(pm.userId, 'approved')}
                      disabled={actionLoading === pm.userId}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold text-white transition-all hover:shadow-md disabled:opacity-50"
                      style={{ backgroundColor: '#0D7377' }}
                    >
                      {actionLoading === pm.userId ? 'Saving\u2026' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleMemberAction(pm.userId, 'blocked')}
                      disabled={actionLoading === pm.userId}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
        <>
        {/* Filter Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`flex-1 text-sm font-semibold py-2 px-3 rounded-lg transition-all ${
                filterTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-gray-400">
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Sort row */}
        <div className="flex gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100 transition-all"
            />
          </div>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:border-gray-300 cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Member List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {filteredMembers.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3 select-none">{'\u{1F50D}'}</p>
              <p className="text-sm text-gray-400">
                {search ? 'No members match your search.' : 'No members in this category.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredMembers.map((member) => {
                const tier = TIER_CONFIG[member.tier] ?? TIER_CONFIG.newcomer
                const activity = getActivityStatus(member.lastActive)
                const statusDot =
                  activity === 'active'
                    ? 'bg-green-500'
                    : activity === 'at_risk'
                      ? 'bg-amber-500'
                      : 'bg-gray-300'

                return (
                  <button
                    key={member.userId}
                    onClick={() =>
                      router.push(
                        `/g/${group.slug}/admin/members/${member.userId}`
                      )
                    }
                    className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {member.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.avatarUrl}
                          alt={member.fullName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: colour }}
                        >
                          {initials(member.fullName)}
                        </div>
                      )}
                      {/* Activity dot */}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot}`}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {member.fullName}
                        </p>
                        {member.role !== 'member' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                            {member.role === 'super_admin' ? 'Admin' : 'Co-admin'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Last active: {formatRelativeDate(member.lastActive)}
                        {' \u00B7 '}
                        Joined {formatDate(member.joinedAt)}
                      </p>
                    </div>

                    {/* Tier badge */}
                    <div
                      className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: tier.bg, color: tier.text }}
                    >
                      <span>{tier.emoji}</span>
                      <span>{tier.label}</span>
                    </div>

                    {/* Crew score */}
                    <div className="hidden sm:block text-right flex-shrink-0 w-14">
                      <p className="text-sm font-bold text-gray-900">
                        {member.crewScore}
                      </p>
                      <p className="text-[10px] text-gray-400">score</p>
                    </div>

                    {/* Chevron */}
                    <div className="text-gray-300 flex-shrink-0">
                      <ChevronRightIcon />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}
