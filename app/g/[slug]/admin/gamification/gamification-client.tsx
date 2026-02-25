'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TIER_THEMES } from '@/lib/tier-themes'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  group: {
    id: string
    name: string
    slug: string
    colour: string
  }
  settings: {
    boardMonthly: boolean
    boardAlltime: boolean
    boardSpirit: boolean
    boardStreak: boolean
    crewScoreVisible: boolean
    badgeAnnouncements: boolean
    hallOfFameVisibility: string
    tierTheme: string
    customTierNames: string[] | null
  }
}

// ─── Spirit Points table data ───────────────────────────────────────────────

const SPIRIT_ACTIONS = [
  { action: 'Event attendance', points: 20, cap: 'No cap' },
  { action: 'Weather bonus', points: 5, cap: 'No cap' },
  { action: 'First to RSVP', points: 10, cap: '10 pts/wk' },
  { action: 'Event chat', points: 3, cap: '15 pts/wk' },
  { action: 'Photo upload', points: 5, cap: '20 pts/wk' },
  { action: 'Co-organising', points: 25, cap: '25 pts/wk' },
  { action: 'Welcome DM', points: 5, cap: '15 pts/wk' },
  { action: 'Flyer sharing', points: 5, cap: '15 pts/wk' },
  { action: 'Guest conversion', points: 30, cap: 'No cap' },
]

// ─── Theme labels ───────────────────────────────────────────────────────────

const THEME_LABELS: Record<string, string> = {
  generic: 'General',
  running: 'Running',
  cycling: 'Cycling',
  hiking: 'Hiking',
  book_club: 'Book Club',
  knitting: 'Knitting',
  yoga: 'Yoga',
  football: 'Football',
  social: 'Social',
  volunteering: 'Volunteering',
  photography: 'Photography',
}

// ─── Toggle component ───────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-teal-500' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function GamificationClient({ group, settings }: Props) {
  const [toast, setToast] = useState('')

  // Board toggles
  const [boardMonthly, setBoardMonthly] = useState(settings.boardMonthly)
  const [boardAlltime, setBoardAlltime] = useState(settings.boardAlltime)
  const [boardSpirit, setBoardSpirit] = useState(settings.boardSpirit)
  const [boardStreak, setBoardStreak] = useState(settings.boardStreak)

  // Recognition
  const [crewScoreVisible, setCrewScoreVisible] = useState(settings.crewScoreVisible)
  const [badgeAnnouncements, setBadgeAnnouncements] = useState(settings.badgeAnnouncements)
  const [hofVisibility, setHofVisibility] = useState(settings.hallOfFameVisibility)

  // Tier theme
  const [theme, setTheme] = useState(settings.tierTheme)
  const [customNames, setCustomNames] = useState<string[]>(
    settings.customTierNames ?? ['', '', '', '', 'Legend']
  )

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Save helper ─────────────────────────────────────────────────────────

  async function save(updates: Record<string, unknown>, label: string) {
    try {
      const res = await fetch(`/api/groups/${group.slug}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast(data.error || 'Failed to save')
      } else {
        setToast(label)
      }
    } catch {
      setToast('Network error. Please try again.')
    }
  }

  // ── Toggle handlers (optimistic) ───────────────────────────────────────

  function toggleBoard(key: string, current: boolean, setter: (v: boolean) => void, label: string) {
    setter(!current)
    save({ [key]: !current }, `${label} ${!current ? 'enabled' : 'disabled'}`)
  }

  function toggleBool(key: string, current: boolean, setter: (v: boolean) => void, label: string) {
    setter(!current)
    save({ [key]: !current }, `${label} ${!current ? 'enabled' : 'disabled'}`)
  }

  function handleHofChange(value: string) {
    setHofVisibility(value)
    const labels: Record<string, string> = {
      public: 'Hall of Fame set to Public',
      members_only: 'Hall of Fame set to Members Only',
      hidden: 'Hall of Fame hidden',
    }
    save({ hall_of_fame_visibility: value }, labels[value] ?? 'Saved')
  }

  function handleThemeSelect(key: string) {
    setTheme(key)
    if (key === 'custom') {
      // Just switch to custom mode — don't save until names are set
      return
    }
    save({ tier_theme: key }, `Tier theme set to ${THEME_LABELS[key] ?? key}`)
  }

  function handleCustomNameChange(index: number, value: string) {
    const next = [...customNames]
    next[index] = value
    setCustomNames(next)
  }

  function saveCustomNames() {
    const names = [...customNames]
    names[4] = 'Legend' // Always enforce
    save({ tier_theme: 'custom', custom_tier_names: names }, 'Custom tier names saved')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href={`/g/${group.slug}/admin`}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900">Gamification</h1>
            <p className="text-[11px] text-gray-500">{group.name}</p>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-2.5 text-sm text-teal-800 font-medium shadow-lg">
            {toast}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ═══ SECTION A: Boards & Competition ═══ */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Boards &amp; Competition</p>
            <p className="text-xs text-gray-500 mt-0.5">Control which leaderboards are visible to members</p>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Monthly Board */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Monthly Attendance Rate Board</p>
                <p className="text-xs text-gray-400 mt-0.5">Recommended for all groups. Resets on the 1st. Fair for all group types.</p>
              </div>
              <Toggle checked={boardMonthly} onChange={() => toggleBoard('board_monthly_enabled', boardMonthly, setBoardMonthly, 'Monthly board')} />
            </div>

            <div className="border-t border-gray-50" />

            {/* All-Time Board */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">All-Time Events Board</p>
                <p className="text-xs text-gray-400 mt-0.5">Shows raw event counts. Favours longer-serving members &mdash; use alongside Monthly Rate.</p>
              </div>
              <Toggle checked={boardAlltime} onChange={() => toggleBoard('board_alltime_enabled', boardAlltime, setBoardAlltime, 'All-time board')} />
            </div>

            <div className="border-t border-gray-50" />

            {/* Spirit Board */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Spirit Points Board</p>
                <p className="text-xs text-gray-400 mt-0.5">Shows community contribution &mdash; who is the most active builder this month?</p>
              </div>
              <Toggle checked={boardSpirit} onChange={() => toggleBoard('board_spirit_enabled', boardSpirit, setBoardSpirit, 'Spirit board')} />
            </div>

            <div className="border-t border-gray-50" />

            {/* Streak Board */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Streak Board</p>
                <p className="text-xs text-gray-400 mt-0.5">Shows longest current streak. Best for high-frequency groups (3+ events/week).</p>
              </div>
              <Toggle checked={boardStreak} onChange={() => toggleBoard('board_streak_enabled', boardStreak, setBoardStreak, 'Streak board')} />
            </div>
          </div>
        </section>

        {/* ═══ SECTION B: Recognition ═══ */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Recognition</p>
            <p className="text-xs text-gray-500 mt-0.5">How members see scores, badges, and achievements</p>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Crew Score visible */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Crew Score visible to other members</p>
                <p className="text-xs text-gray-400 mt-0.5">Members can always see their own score. This setting controls visibility to others.</p>
              </div>
              <Toggle checked={crewScoreVisible} onChange={() => toggleBool('crew_score_visible', crewScoreVisible, setCrewScoreVisible, 'Crew Score visibility')} />
            </div>

            <div className="border-t border-gray-50" />

            {/* Badge announcements */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Badge announcements in chat</p>
                <p className="text-xs text-gray-400 mt-0.5">Posts a message when members earn milestone badges. Turn off for quieter groups.</p>
              </div>
              <Toggle checked={badgeAnnouncements} onChange={() => toggleBool('badge_announcements_enabled', badgeAnnouncements, setBadgeAnnouncements, 'Badge announcements')} />
            </div>

            <div className="border-t border-gray-50" />

            {/* Hall of Fame visibility */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Hall of Fame</p>
                <p className="text-xs text-gray-400 mt-0.5">Who can see the Hall of Fame records</p>
              </div>
              <select
                value={hofVisibility}
                onChange={(e) => handleHofChange(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="public">Public</option>
                <option value="members_only">Members Only</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>

            <div className="border-t border-gray-50" />

            {/* Tier Theme Picker */}
            <div>
              <p className="text-sm font-medium text-gray-800 mb-1">Tier Naming Theme</p>
              <p className="text-xs text-gray-400 mb-3">Choose how tier levels are named for your group</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(TIER_THEMES).map(([key, tiers]) => (
                  <button
                    key={key}
                    onClick={() => handleThemeSelect(key)}
                    className="text-left p-3 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: theme === key ? group.colour : '#f3f4f6',
                      backgroundColor: theme === key ? group.colour + '08' : 'transparent',
                    }}
                  >
                    <p className="text-xs font-semibold text-gray-700">{THEME_LABELS[key] ?? key}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                      {tiers.join(' \u2192 ')}
                    </p>
                  </button>
                ))}

                {/* Custom option */}
                <button
                  onClick={() => handleThemeSelect('custom')}
                  className="text-left p-3 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: theme === 'custom' ? group.colour : '#f3f4f6',
                    backgroundColor: theme === 'custom' ? group.colour + '08' : 'transparent',
                  }}
                >
                  <p className="text-xs font-semibold text-gray-700">Custom</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Define your own tier names</p>
                </button>
              </div>

              {/* Custom tier name inputs */}
              {theme === 'custom' && (
                <div className="mt-4 space-y-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-400 w-10 text-right">T{i + 1}</span>
                      {i < 4 ? (
                        <input
                          type="text"
                          value={customNames[i]}
                          onChange={(e) => handleCustomNameChange(i, e.target.value)}
                          placeholder={`Tier ${i + 1} name`}
                          maxLength={20}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value="Legend"
                          disabled
                          className="flex-1 text-sm border border-gray-100 rounded-lg px-3 py-1.5 text-gray-400 bg-gray-50 cursor-not-allowed"
                        />
                      )}
                    </div>
                  ))}
                  <button
                    onClick={saveCustomNames}
                    className="mt-2 text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors"
                    style={{ backgroundColor: group.colour }}
                  >
                    Save tier names
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══ SECTION C: Spirit Points (Read-Only) ═══ */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Spirit Points</p>
            <p className="text-xs text-gray-500 mt-0.5">How members earn community contribution points</p>
          </div>

          <div className="px-5 py-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 pb-2">Action</th>
                    <th className="text-right text-xs font-semibold text-gray-500 pb-2">Points</th>
                    <th className="text-right text-xs font-semibold text-gray-500 pb-2">Weekly Cap</th>
                  </tr>
                </thead>
                <tbody>
                  {SPIRIT_ACTIONS.map((row) => (
                    <tr key={row.action} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-700">{row.action}</td>
                      <td className="py-2 text-right font-medium text-gray-900">+{row.points}</td>
                      <td className="py-2 text-right text-gray-400">{row.cap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              Global weekly cap: <span className="font-semibold">100 pts</span>.
              Spirit Points are awarded automatically. They cannot be turned off individually,
              but you can disable the Spirit Points Board above if you prefer not to show rankings.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
