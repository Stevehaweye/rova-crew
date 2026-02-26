'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberProfile {
  id: string
  fullName: string
  avatarUrl: string | null
}

interface Suggestion {
  memberA: MemberProfile
  memberB: MemberProfile
  sharedEvents: number
}

interface Props {
  slug: string
  colour: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntroductionCard({ slug, colour }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [introducing, setIntroducing] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch(`/api/groups/${slug}/introductions/suggestions`)
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  async function handleIntroduce(memberA: string, memberB: string) {
    const key = `${memberA}|${memberB}`
    setIntroducing(key)

    try {
      const res = await fetch(`/api/groups/${slug}/introductions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberA, memberB }),
      })

      if (res.ok) {
        setSuggestions((prev) =>
          prev.filter(
            (s) =>
              !(
                (s.memberA.id === memberA && s.memberB.id === memberB) ||
                (s.memberA.id === memberB && s.memberB.id === memberA)
              )
          )
        )
        setToast('Introduction sent!')
        setTimeout(() => setToast(''), 4000)
      }
    } catch {
      setToast('Failed to send introduction')
      setTimeout(() => setToast(''), 4000)
    }

    setIntroducing(null)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-gray-900">Warm Introductions</h2>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (suggestions.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Toast */}
      {toast && (
        <div className="mb-3 rounded-xl px-3 py-2 text-sm text-white font-medium" style={{ backgroundColor: '#0D7377' }}>
          {toast}
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
          <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
        </div>
        <h2 className="text-sm font-bold text-gray-900">Warm Introductions</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4 ml-10">Members who attended the same events but haven&apos;t chatted yet</p>

      <div className="space-y-3">
        {suggestions.slice(0, 5).map((s) => {
          const key = `${s.memberA.id}|${s.memberB.id}`
          const isIntroducing = introducing === key

          return (
            <div
              key={key}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              {/* Avatars overlapping */}
              <div className="flex -space-x-2 flex-shrink-0">
                {[s.memberA, s.memberB].map((m) =>
                  m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={m.id}
                      src={m.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border-2 border-white"
                    />
                  ) : (
                    <div
                      key={m.id}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white"
                      style={{ backgroundColor: colour }}
                    >
                      {initials(m.fullName)}
                    </div>
                  )
                )}
              </div>

              {/* Names + shared events */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {s.memberA.fullName.split(' ')[0]} &amp; {s.memberB.fullName.split(' ')[0]}
                </p>
                <p className="text-[10px] text-gray-400">
                  {s.sharedEvents} shared event{s.sharedEvents !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Introduce button */}
              <button
                onClick={() => handleIntroduce(s.memberA.id, s.memberB.id)}
                disabled={isIntroducing}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: colour }}
              >
                {isIntroducing ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  'Introduce'
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
