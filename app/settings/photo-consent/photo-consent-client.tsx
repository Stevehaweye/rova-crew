'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

type ConsentLevel = 'always' | 'ask' | 'never'

interface GroupInfo {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  colour: string
}

interface Props {
  groups: GroupInfo[]
  initialConsent: Record<string, ConsentLevel>
}

interface ConsentOption {
  level: ConsentLevel
  emoji: string
  label: string
  description: string
}

const CONSENT_OPTIONS: ConsentOption[] = [
  {
    level: 'always',
    emoji: '\u2705',
    label: 'Always include me in group photos',
    description: "I'm happy for my photos to be shared within the group and publicly.",
  },
  {
    level: 'ask',
    emoji: '\uD83D\uDFE1',
    label: 'Ask before sharing my photos externally',
    description: 'Photos of me can be shared within the group, but ask me before sharing publicly.',
  },
  {
    level: 'never',
    emoji: '\uD83D\uDD34',
    label: 'Never include me in group photos',
    description: "Please don't upload or share photos of me in this group.",
  },
]

// ─── Consent Radio Button ────────────────────────────────────────────────────

function ConsentRadio({
  option,
  selected,
  onSelect,
}: {
  option: ConsentOption
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl text-left transition-all ${
        selected
          ? 'border-2 bg-[#0D73770A]'
          : 'border border-gray-200 hover:border-gray-300'
      }`}
      style={selected ? { borderColor: '#0D7377' } : undefined}
    >
      {/* Radio dot */}
      <div className="mt-0.5 shrink-0">
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected ? '' : 'border-gray-300'
          }`}
          style={selected ? { borderColor: '#0D7377' } : undefined}
        >
          {selected && (
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: '#0D7377' }}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {option.emoji} {option.label}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
      </div>
    </button>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PhotoConsentClient({ groups, initialConsent }: Props) {
  const [consent, setConsent] = useState<Record<string, ConsentLevel>>(initialConsent)

  async function handleSelect(groupId: string, level: ConsentLevel) {
    const previous = consent[groupId] ?? 'always'
    if (previous === level) return

    // Optimistic update
    setConsent((prev) => ({ ...prev, [groupId]: level }))

    try {
      const res = await fetch('/api/photos/consent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, consent_level: level }),
      })

      if (!res.ok) {
        setConsent((prev) => ({ ...prev, [groupId]: previous }))
      }
    } catch {
      setConsent((prev) => ({ ...prev, [groupId]: previous }))
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
          <p className="text-sm font-semibold text-gray-400">Photo Privacy</p>
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

        <h1 className="text-xl font-bold text-gray-900 mb-2">Photo privacy</h1>
        <p className="text-sm text-gray-500 mb-6">
          Choose how your photos are shared in each group. You can change this at any time.
        </p>

        {groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">Join a group to manage photo privacy.</p>
            <Link
              href="/home"
              className="text-sm font-medium transition-colors"
              style={{ color: '#0D7377' }}
            >
              Go to home
            </Link>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="mb-6">
              {/* Group header */}
              <div className="flex items-center gap-2.5 mb-3">
                {group.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.logoUrl}
                    alt={group.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: group.colour }}
                  >
                    {group.name[0]?.toUpperCase()}
                  </div>
                )}
                <h2 className="text-sm font-semibold text-gray-900">{group.name}</h2>
              </div>

              {/* Consent options */}
              <div className="space-y-2">
                {CONSENT_OPTIONS.map((option) => (
                  <ConsentRadio
                    key={option.level}
                    option={option}
                    selected={(consent[group.id] ?? 'always') === option.level}
                    onSelect={() => handleSelect(group.id, option.level)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
