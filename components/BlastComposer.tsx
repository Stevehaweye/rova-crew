'use client'

import { useState } from 'react'
import { format } from 'date-fns'

interface Props {
  groupSlug: string
  groupName: string
  groupColour: string
  memberCount: number
  lastBlastAt: string | null
  initialTitle?: string
  initialBody?: string
}

export default function BlastComposer({
  groupSlug,
  groupName,
  groupColour,
  memberCount,
  lastBlastAt,
  initialTitle = '',
  initialBody = '',
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRateLimited = lastBlastAt
    ? new Date().getTime() - new Date(lastBlastAt).getTime() < 24 * 60 * 60 * 1000
    : false

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !isRateLimited && !sending

  async function handleSend() {
    setConfirm(false)
    setSending(true)
    setError(null)

    const res = await fetch(`/api/groups/${groupSlug}/blast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), blastBody: body.trim() }),
    })

    const data = await res.json()
    setSending(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      return
    }

    setSent(true)
    setSentCount(data.recipientCount ?? memberCount)
  }

  if (sent) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3 select-none">🚀</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Blast sent!</h2>
        <p className="text-sm text-gray-500">
          Push notification + email sent to {sentCount} member{sentCount !== 1 ? 's' : ''}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex gap-3">
          <span className="text-lg select-none">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              This will send a push notification AND email to all {memberCount} member{memberCount !== 1 ? 's' : ''} of {groupName}.
            </p>
            <p className="text-xs text-amber-600 mt-1">Use sparingly — blasts are rate limited to 1 per 24 hours.</p>
          </div>
        </div>
      </div>

      {/* Rate limit indicator */}
      {isRateLimited && lastBlastAt && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700">
            A blast was sent {format(new Date(lastBlastAt), 'd MMM \'at\' HH:mm')}. You can send another after {format(new Date(new Date(lastBlastAt).getTime() + 24 * 60 * 60 * 1000), 'd MMM \'at\' HH:mm')}.
          </p>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
        <div className="relative">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 60))}
            placeholder="e.g. Important: venue change"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': groupColour } as React.CSSProperties}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">{title.length}/60</span>
        </div>
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message</label>
        <div className="relative">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 300))}
            placeholder="Write your message..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent resize-none"
            style={{ '--tw-ring-color': groupColour } as React.CSSProperties}
          />
          <span className="absolute right-3 bottom-3 text-[11px] text-gray-400">{body.length}/300</span>
        </div>
      </div>

      {/* Push notification preview */}
      {(title.trim() || body.trim()) && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Push notification preview</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: groupColour }}>
                RC
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {groupName}: {title.trim() || 'Title'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {body.trim() || 'Message body'}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">now</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      {/* Send button */}
      <button
        onClick={() => setConfirm(true)}
        disabled={!canSend}
        className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: groupColour }}
      >
        {sending ? 'Sending...' : `Send to all ${memberCount} members`}
      </button>

      {/* Confirmation modal */}
      {confirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setConfirm(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl p-5 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-gray-900 mb-2">Send blast?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will send a push notification and email to <strong>{memberCount} member{memberCount !== 1 ? 's' : ''}</strong>. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold"
                style={{ backgroundColor: groupColour }}
              >
                Confirm
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
