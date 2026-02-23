'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import jsQR from 'jsqr'
import { format } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Attendee {
  id: string
  userId: string | null
  name: string
  avatarUrl: string | null
  rsvpStatus: 'going' | 'maybe'
  checkedIn: boolean
  type: 'member' | 'guest'
  table: 'rsvps' | 'guest_rsvps'
}

interface EventData {
  id: string
  title: string
  startsAt: string
  location: string | null
}

interface Props {
  event: EventData
  groupSlug: string
  groupName: string
  colour: string
  attendees: Attendee[]
}

type ScanResult =
  | { status: 'idle' }
  | { status: 'success'; name: string; avatarUrl: string | null; type: 'member' | 'guest' }
  | { status: 'already'; name: string; avatarUrl: string | null }
  | { status: 'not_found'; message: string }
  | { status: 'error'; message: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseQrPayload(raw: string): { type: 'member'; userId: string } | { type: 'guest'; qrToken: string } | null {
  // Member QR: {appUrl}/checkin/{userId}/{eventId} or {appUrl}/checkin/{userId}
  const checkinMatch = raw.match(/\/checkin\/([0-9a-f-]{36})(?:\/([0-9a-f-]{36}))?$/i)
  if (checkinMatch) {
    return { type: 'member', userId: checkinMatch[1] }
  }

  // Guest QR: plain UUID qr_token
  if (UUID_RE.test(raw.trim())) {
    return { type: 'guest', qrToken: raw.trim() }
  }

  return null
}

// ─── Success beep via Web Audio API ──────────────────────────────────────────

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.value = 0.3
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    // Audio not available — silent fallback
  }
}

function playErrorBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 300
    osc.type = 'square'
    gain.gain.value = 0.2
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // Silent fallback
  }
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function QrScanIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
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

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── QR Scanner ──────────────────────────────────────────────────────────────

function QrScanner({
  eventId,
  colour,
  scanResult,
  onScan,
}: {
  eventId: string
  colour: string
  scanResult: ScanResult
  onScan: (payload: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const lastScannedRef = useRef<string>('')
  const lastScannedTimeRef = useRef(0)

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setScanning(true)
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions and try again.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  // Start camera on mount
  useEffect(() => {
    startCamera()
    return stopCamera
  }, [startCamera, stopCamera])

  // Continuous scanning loop
  useEffect(() => {
    if (!scanning) return

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    function tick() {
      if (!video || !canvas || !ctx) return
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (code?.data) {
        const now = Date.now()
        // Debounce: don't re-scan same code within 3 seconds
        if (code.data !== lastScannedRef.current || now - lastScannedTimeRef.current > 3000) {
          lastScannedRef.current = code.data
          lastScannedTimeRef.current = now
          onScan(code.data)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [scanning, onScan, eventId])

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <svg className="w-10 h-10 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <p className="text-sm text-gray-400 mb-3">{cameraError}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: colour }}
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Scanning frame overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner brackets */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-56 h-56 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 rounded-tl-lg" style={{ borderColor: colour }} />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 rounded-tr-lg" style={{ borderColor: colour }} />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 rounded-bl-lg" style={{ borderColor: colour }} />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 rounded-br-lg" style={{ borderColor: colour }} />
                </div>
              </div>
              {/* Scan line animation */}
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-56 h-56 overflow-hidden relative">
                    <div
                      className="absolute left-0 right-0 h-0.5 opacity-60"
                      style={{
                        backgroundColor: colour,
                        boxShadow: `0 0 8px ${colour}`,
                        animation: 'scan-line 2s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Result overlay */}
        {scanResult.status !== 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div
              className="absolute inset-0 transition-colors duration-200"
              style={{
                backgroundColor:
                  scanResult.status === 'success'
                    ? 'rgba(5, 150, 105, 0.92)'
                    : scanResult.status === 'already'
                      ? 'rgba(245, 158, 11, 0.92)'
                      : 'rgba(239, 68, 68, 0.92)',
              }}
            />
            <div className="relative z-10 text-center px-6">
              {scanResult.status === 'success' && (
                <>
                  {scanResult.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={scanResult.avatarUrl}
                      alt=""
                      className="w-20 h-20 rounded-full mx-auto mb-4 ring-4 ring-white/30 object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full mx-auto mb-4 ring-4 ring-white/30 bg-white/20 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{initials(scanResult.name)}</span>
                    </div>
                  )}
                  <div className="text-4xl font-black text-white mb-1">CHECKED IN</div>
                  <div className="text-lg font-bold text-white/90">{scanResult.name}</div>
                  <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white uppercase tracking-wider">
                    {scanResult.type}
                  </div>
                </>
              )}
              {scanResult.status === 'already' && (
                <>
                  <div className="text-5xl mb-3">&#9888;&#65039;</div>
                  <div className="text-2xl font-black text-white mb-1">Already Checked In</div>
                  <div className="text-sm font-semibold text-white/80">{scanResult.name}</div>
                </>
              )}
              {(scanResult.status === 'not_found' || scanResult.status === 'error') && (
                <>
                  <div className="text-5xl mb-3">&#10060;</div>
                  <div className="text-2xl font-black text-white mb-1">
                    {scanResult.status === 'not_found' ? 'Not on the List' : 'Error'}
                  </div>
                  <div className="text-sm font-semibold text-white/80">{scanResult.message}</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for QR processing */}
      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        @keyframes scan-line {
          0%, 100% { top: 0; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  )
}

// ─── Manual List ─────────────────────────────────────────────────────────────

function ManualList({
  attendees,
  colour,
  loadingId,
  onToggle,
}: {
  attendees: Attendee[]
  colour: string
  loadingId: string | null
  onToggle: (attendee: Attendee) => void
}) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? attendees.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : attendees

  // Sort: unchecked first, then checked
  const sorted = [...filtered].sort((a, b) => {
    if (a.checkedIn !== b.checkedIn) return a.checkedIn ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
          style={{ '--tw-ring-color': colour } as React.CSSProperties}
        />
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
        {sorted.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">
              {search ? 'No matching attendees.' : 'No RSVPs yet.'}
            </p>
          </div>
        ) : (
          sorted.map((a) => (
            <button
              key={a.id}
              onClick={() => onToggle(a)}
              disabled={loadingId === a.id}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/50 transition-colors disabled:opacity-50"
            >
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
                style={{
                  backgroundColor: a.checkedIn ? '#D1FAE5' : a.type === 'guest' ? '#F3F4F6' : colour + '15',
                }}
              >
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span
                    className="text-xs font-bold"
                    style={{ color: a.checkedIn ? '#059669' : a.type === 'guest' ? '#6B7280' : colour }}
                  >
                    {initials(a.name)}
                  </span>
                )}
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">{a.name}</span>
                  {a.type === 'guest' && (
                    <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Guest
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {a.rsvpStatus === 'going' ? 'Going' : 'Maybe'}
                </span>
              </div>

              {/* Check-in status */}
              <div className="flex-shrink-0">
                {loadingId === a.id ? (
                  <Spinner />
                ) : a.checkedIn ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full border-2 border-gray-200" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CheckinClient({
  event,
  groupSlug,
  groupName,
  colour,
  attendees: initialAttendees,
}: Props) {
  const [mode, setMode] = useState<'scan' | 'list'>('scan')
  const [attendees, setAttendees] = useState<Attendee[]>(initialAttendees)
  const [scanResult, setScanResult] = useState<ScanResult>({ status: 'idle' })
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const checkedInCount = attendees.filter((a) => a.checkedIn).length
  const totalCount = attendees.length

  // ── QR scan handler ────────────────────────────────────────────────────────

  const handleScan = useCallback(async (raw: string) => {
    if (scanResult.status !== 'idle') return // Already showing result

    const parsed = parseQrPayload(raw)
    if (!parsed) {
      setScanResult({ status: 'error', message: 'Invalid QR code format.' })
      playErrorBeep()
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = setTimeout(() => setScanResult({ status: 'idle' }), 2000)
      return
    }

    try {
      const body =
        parsed.type === 'member'
          ? { type: 'member', user_id: parsed.userId }
          : { type: 'guest', qr_token: parsed.qrToken }

      const res = await fetch(`/api/events/${event.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        playBeep()
        setScanResult({
          status: 'success',
          name: data.attendee.name,
          avatarUrl: data.attendee.avatarUrl,
          type: data.attendee.type,
        })

        // Update local attendees list
        if (parsed.type === 'member') {
          setAttendees((prev) =>
            prev.map((a) => (a.userId === parsed.userId ? { ...a, checkedIn: true } : a))
          )
        } else {
          // For guests, try matching by name from response
          setAttendees((prev) => {
            const updated = [...prev]
            const idx = updated.findIndex((a) => a.type === 'guest' && a.name === data.attendee.name && !a.checkedIn)
            if (idx >= 0) updated[idx] = { ...updated[idx], checkedIn: true }
            return updated
          })
        }
      } else if (res.status === 409) {
        playErrorBeep()
        setScanResult({
          status: 'already',
          name: data.attendee?.name ?? 'Unknown',
          avatarUrl: data.attendee?.avatarUrl ?? null,
        })
      } else if (res.status === 404) {
        playErrorBeep()
        setScanResult({ status: 'not_found', message: data.detail ?? 'Not on the list.' })
      } else {
        playErrorBeep()
        setScanResult({ status: 'error', message: data.error ?? 'Check-in failed.' })
      }
    } catch {
      playErrorBeep()
      setScanResult({ status: 'error', message: 'Network error. Please try again.' })
    }

    // Auto-reset after 2 seconds
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
    scanTimeoutRef.current = setTimeout(() => setScanResult({ status: 'idle' }), 2000)
  }, [event.id, scanResult.status])

  // ── Manual toggle handler ──────────────────────────────────────────────────

  async function handleManualToggle(attendee: Attendee) {
    setLoadingId(attendee.id)

    try {
      const res = await fetch(`/api/events/${event.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rsvp_id: attendee.id,
          table: attendee.table,
          action: attendee.checkedIn ? 'undo' : 'checkin',
        }),
      })

      if (res.ok) {
        if (!attendee.checkedIn) playBeep()
        setAttendees((prev) =>
          prev.map((a) => (a.id === attendee.id ? { ...a, checkedIn: !a.checkedIn } : a))
        )
      }
    } catch {
      // Silent fail — user can retry
    }

    setLoadingId(null)
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href={`/g/${groupSlug}/admin/events`}
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
          <span className="text-sm font-semibold text-gray-600 truncate">Check-in</span>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-5">
        {/* Event header */}
        <div className="mb-5">
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{event.title}</h1>
          <p className="text-xs text-gray-500 mt-1">
            {format(new Date(event.startsAt), 'EEE d MMM · h:mm a')}
            {event.location && ` · ${event.location}`}
          </p>
        </div>

        {/* Running count */}
        <div
          className="rounded-2xl p-4 mb-5 text-center"
          style={{ backgroundColor: colour + '0C' }}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-black tabular-nums" style={{ color: colour }}>
              {checkedInCount}
            </span>
            <span className="text-sm text-gray-500 font-medium">of</span>
            <span className="text-3xl font-black tabular-nums text-gray-900">
              {totalCount}
            </span>
          </div>
          <p className="text-xs font-semibold text-gray-500 mt-1">checked in</p>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${totalCount > 0 ? Math.max((checkedInCount / totalCount) * 100, 2) : 0}%`,
                backgroundColor: colour,
              }}
            />
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setMode('scan')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={
              mode === 'scan'
                ? { backgroundColor: '#fff', color: colour, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: '#6B7280' }
            }
          >
            <QrScanIcon />
            Scanner
          </button>
          <button
            onClick={() => setMode('list')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={
              mode === 'list'
                ? { backgroundColor: '#fff', color: colour, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: '#6B7280' }
            }
          >
            <ListIcon />
            List
          </button>
        </div>

        {/* Content */}
        {mode === 'scan' ? (
          <QrScanner
            eventId={event.id}
            colour={colour}
            scanResult={scanResult}
            onScan={handleScan}
          />
        ) : (
          <ManualList
            attendees={attendees}
            colour={colour}
            loadingId={loadingId}
            onToggle={handleManualToggle}
          />
        )}
      </main>
    </div>
  )
}
