'use client'

import { useState, useEffect } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type ConsentLevel = 'always' | 'ask' | 'never'

interface ConsentPromptProps {
  groupName: string
  groupId: string
  onComplete: (level: ConsentLevel) => void
  onCancel: () => void
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function ConsentPrompt({
  groupName,
  groupId,
  onComplete,
  onCancel,
}: ConsentPromptProps) {
  const [selected, setSelected] = useState<ConsentLevel | null>(null)
  const [saving, setSaving] = useState(false)
  const [show, setShow] = useState(false)

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 10)
    return () => clearTimeout(t)
  }, [])

  async function handleContinue() {
    if (!selected) return
    setSaving(true)

    try {
      const res = await fetch('/api/photos/consent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, consent_level: selected }),
      })

      if (res.ok) {
        onComplete(selected)
      } else {
        setSaving(false)
      }
    } catch {
      setSaving(false)
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 transition-colors duration-200 ${
        show ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`w-full max-w-md bg-white rounded-2xl shadow-xl transition-all duration-200 ${
          show ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
              </svg>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Photo sharing preference</h2>
          <p className="text-sm text-gray-500 mt-1">
            Before you upload, choose your photo sharing preference for <span className="font-medium text-gray-700">{groupName}</span>.
          </p>
        </div>

        {/* Options */}
        <div className="px-5 py-3 space-y-2">
          {CONSENT_OPTIONS.map((option) => (
            <button
              key={option.level}
              type="button"
              onClick={() => setSelected(option.level)}
              className={`w-full flex items-start gap-3 px-3.5 py-3 rounded-xl text-left transition-all ${
                selected === option.level
                  ? 'border-2 bg-[#0D73770A]'
                  : 'border border-gray-200 hover:border-gray-300'
              }`}
              style={selected === option.level ? { borderColor: '#0D7377' } : undefined}
            >
              <div className="mt-0.5 shrink-0">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selected === option.level ? '' : 'border-gray-300'
                  }`}
                  style={selected === option.level ? { borderColor: '#0D7377' } : undefined}
                >
                  {selected === option.level && (
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#0D7377' }}
                    />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {option.emoji} {option.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2">
          <button
            onClick={handleContinue}
            disabled={!selected || saving}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#0D7377' }}
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2.5">
            You can change this later in Settings &gt; Photo Privacy
          </p>
        </div>
      </div>
    </div>
  )
}
