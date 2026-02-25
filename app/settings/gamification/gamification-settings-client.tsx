'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

type PrefKey = 'hide_from_board' | 'private_crew_score' | 'mute_badge_announcements' | 'mute_gamification_push'

interface GroupInfo {
  id: string
  name: string
  slug: string
  colour: string
}

interface Props {
  groups: GroupInfo[]
  initialPrefs: Record<string, Record<PrefKey, boolean>>
}

interface ToggleItem {
  key: PrefKey
  label: string
  description: string
}

const GAMIFICATION_PREFS: ToggleItem[] = [
  {
    key: 'hide_from_board',
    label: 'Hide from leaderboards',
    description: 'Your stats are tracked but you won\'t appear on boards',
  },
  {
    key: 'private_crew_score',
    label: 'Keep Crew Score private',
    description: 'Other members won\'t see your score or tier',
  },
  {
    key: 'mute_badge_announcements',
    label: 'Mute badge announcements',
    description: 'Your badges won\'t be announced in group chat',
  },
  {
    key: 'mute_gamification_push',
    label: 'Mute gamification notifications',
    description: 'No push notifications for badges or milestones',
  },
]

// ─── Toggle component ────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer ${
        checked ? '' : 'bg-gray-200'
      }`}
      style={checked ? { backgroundColor: '#0D7377' } : undefined}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GamificationSettingsClient({ groups, initialPrefs }: Props) {
  const [prefs, setPrefs] = useState(initialPrefs)

  async function handleToggle(groupId: string, key: PrefKey) {
    const current = prefs[groupId]?.[key] ?? false
    const newValue = !current

    // Optimistic update
    setPrefs((prev) => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        [key]: newValue,
      },
    }))

    try {
      const res = await fetch('/api/gamification/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, key, value: newValue }),
      })

      if (!res.ok) {
        // Revert on error
        setPrefs((prev) => ({
          ...prev,
          [groupId]: {
            ...prev[groupId],
            [key]: current,
          },
        }))
      }
    } catch {
      // Revert on error
      setPrefs((prev) => ({
        ...prev,
        [groupId]: {
          ...prev[groupId],
          [key]: current,
        },
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <p className="text-sm font-bold tracking-[0.14em] select-none">
            <span style={{ color: '#0D7377' }}>ROVA</span>
            <span style={{ color: '#C9982A' }}>CREW</span>
          </p>
          <p className="text-sm font-semibold text-gray-400">Gamification</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to profile
        </Link>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Gamification settings</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your stats are always tracked. These settings only control what other members can see.
        </p>

        {groups.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">Join a group to manage gamification settings.</p>
            <Link
              href="/home"
              className="text-sm font-medium transition-colors"
              style={{ color: '#0D7377' }}
            >
              Go to home
            </Link>
          </div>
        ) : (
          /* Per-group sections */
          groups.map((group) => (
            <div key={group.id} className="mb-6">
              {/* Group header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: group.colour }}
                />
                <h2 className="text-sm font-semibold text-gray-900">{group.name}</h2>
              </div>

              {/* Toggles card */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {GAMIFICATION_PREFS.map((item, i) => (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between px-4 py-3 ${
                      i < GAMIFICATION_PREFS.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className="pr-4">
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    </div>
                    <Toggle
                      checked={prefs[group.id]?.[item.key] ?? false}
                      onChange={() => handleToggle(group.id, item.key)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
