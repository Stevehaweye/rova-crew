'use client'

import { useState } from 'react'

interface Props {
  eventId: string
  eventTitle: string
  colour: string
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const FORMATS = [
  { key: 'stories', label: 'Stories', desc: '1080x1920' },
  { key: 'square', label: 'Square', desc: '1080x1080' },
  { key: 'print', label: 'Print/A4', desc: '2480x3508' },
] as const

type FlyerFormat = typeof FORMATS[number]['key']

export default function FlyerActions({ eventId, eventTitle, colour }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [format, setFormat] = useState<FlyerFormat>('stories')

  async function generateFlyer(): Promise<string | null> {
    const res = await fetch(`/api/events/${eventId}/flyer?format=${format}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.url ?? null
  }

  async function handleDownload() {
    setLoading(true)
    try {
      const url = await generateFlyer()
      if (!url) {
        setLoading(false)
        return
      }

      // Fetch the image and trigger download
      const imgRes = await fetch(url)
      const blob = await imgRes.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${eventTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-flyer-${format}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)

      // Award spirit points (fire-and-forget)
      fetch(`/api/events/${eventId}/flyer/share`, { method: 'POST' }).catch(() => {})
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } catch (err) {
      console.error('[flyer] download error:', err)
    }
    setLoading(false)
  }

  async function handleShare() {
    setLoading(true)
    try {
      const url = await generateFlyer()
      if (!url) {
        setLoading(false)
        return
      }

      // Try Web Share API with file
      if (typeof navigator.share === 'function') {
        try {
          const imgRes = await fetch(url)
          const blob = await imgRes.blob()
          const file = new File([blob], `${eventTitle}-flyer.png`, { type: 'image/png' })

          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              title: `${eventTitle} — Event Flyer`,
              files: [file],
            })
            // Award spirit points
            fetch(`/api/events/${eventId}/flyer/share`, { method: 'POST' }).catch(() => {})
            setDone(true)
            setTimeout(() => setDone(false), 3000)
            setLoading(false)
            return
          }
        } catch {
          // User cancelled or file sharing not supported — fall through
        }
      }

      // Fallback: copy event URL to clipboard
      await navigator.clipboard.writeText(`${window.location.origin}/events/${eventId}`)
      fetch(`/api/events/${eventId}/flyer/share`, { method: 'POST' }).catch(() => {})
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } catch (err) {
      console.error('[flyer] share error:', err)
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-1">Event Flyer</h3>
      <p className="text-xs text-gray-400 mb-3">
        Generate a shareable flyer with QR code
      </p>

      {/* Format selector */}
      <div className="flex gap-1.5 mb-3">
        {FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setFormat(f.key); setDone(false) }}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all text-center"
            style={
              format === f.key
                ? { backgroundColor: colour + '18', color: colour, border: `1.5px solid ${colour}` }
                : { backgroundColor: '#F3F4F6', color: '#6B7280', border: '1.5px solid transparent' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all disabled:opacity-50"
          style={{ borderColor: colour, color: colour }}
        >
          {loading ? (
            <Spinner />
          ) : done ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          )}
          {done ? 'Done!' : 'Download'}
        </button>

        <button
          onClick={handleShare}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
          style={{ backgroundColor: colour }}
        >
          {loading ? (
            <Spinner />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
          )}
          Share
        </button>
      </div>
    </div>
  )
}
