'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InviteModalProps {
  groupUrl: string
  groupName: string
  groupSlug: string
  groupColour: string
  onClose: () => void
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function WhatsAppIcon() {
  // Standard WhatsApp logo path
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  )
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

export function InviteModal({
  groupUrl,
  groupName,
  groupSlug,
  groupColour,
  onClose,
}: InviteModalProps) {
  // Enter animation — delayed one tick to trigger CSS transition
  const [show, setShow] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [qrLoaded, setQrLoaded] = useState(false)
  const [qrError, setQrError] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 10)
    return () => clearTimeout(t)
  }, [])

  const inviteMessage =
    `Hey! I've created our community on ROVA Crew — it's free and way better than WhatsApp for organising events. Join here: ${groupUrl}`

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`

  function handleCopyLink() {
    navigator.clipboard.writeText(groupUrl).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    })
  }

  function handleCopyMessage() {
    navigator.clipboard.writeText(inviteMessage).then(() => {
      setCopiedMessage(true)
      setTimeout(() => setCopiedMessage(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">

      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          show ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Panel — slides up on mobile, fades in centered on desktop */}
      <div
        className={`relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto z-10 transition-all duration-300 ease-out ${
          show ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-1">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Invite people to
            </p>
            <h3
              className="text-xl font-black leading-tight"
              style={{ color: groupColour }}
            >
              {groupName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0 mt-1"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-6 space-y-5">

          {/* ── Section 1: Share Link ──────────────────────────────── */}
          <div>
            <SectionLabel>Your group link</SectionLabel>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <LinkIcon />
                <span className="text-xs text-gray-700 truncate font-mono select-all">
                  {groupUrl}
                </span>
              </div>
              <button
                onClick={handleCopyLink}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 transition-all duration-200 whitespace-nowrap"
                style={
                  copiedLink
                    ? { backgroundColor: '#D1FAE5', color: '#065F46' }
                    : { backgroundColor: groupColour, color: 'white' }
                }
              >
                {copiedLink ? (
                  <><CheckIcon /> Copied! ✓</>
                ) : (
                  'Copy'
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* ── Section 2: QR Code ────────────────────────────────── */}
          <div>
            <SectionLabel>QR Code</SectionLabel>
            <div className="flex flex-col items-center gap-4">

              {/* QR image with loading / error states */}
              <div className="w-52 h-52 rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center p-4 relative">
                {!qrLoaded && !qrError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                  </div>
                )}
                {qrError && (
                  <p className="text-xs text-gray-400 text-center px-4">
                    QR code unavailable
                  </p>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/groups/${groupSlug}/qr`}
                  alt={`QR code for ${groupName} group invite`}
                  className={`w-full h-full transition-opacity duration-300 ${
                    qrLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => setQrLoaded(true)}
                  onError={() => setQrError(true)}
                />
              </div>

              {/* Download */}
              <a
                href={`/api/groups/${groupSlug}/qr`}
                download={`${groupSlug}-invite-qr.svg`}
                className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border-2 transition-colors"
                style={{ borderColor: groupColour, color: groupColour }}
              >
                <DownloadIcon />
                Download QR Code
              </a>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* ── Section 3: Share directly ─────────────────────────── */}
          <div>
            <SectionLabel>Share directly</SectionLabel>
            <div className="space-y-2.5">

              {/* WhatsApp */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 active:scale-[0.98] transition-transform"
                style={{ backgroundColor: '#25D366' }}
              >
                <WhatsAppIcon />
                Share on WhatsApp
              </a>

              {/* Copy invitation message */}
              <button
                onClick={handleCopyMessage}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl font-semibold text-sm border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-colors active:scale-[0.98]"
                style={
                  copiedMessage
                    ? { borderColor: '#10B981', color: '#065F46', backgroundColor: '#F0FDF4' }
                    : {}
                }
              >
                {copiedMessage ? <CheckIcon /> : <ClipboardIcon />}
                {copiedMessage ? 'Copied! ✓' : 'Copy invitation message'}
              </button>

              {/* Message preview */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Message preview
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Hey! I&apos;ve created our community on ROVA Crew — it&apos;s free and way better
                  than WhatsApp for organising events. Join here:{' '}
                  <span className="font-mono text-gray-700">{groupUrl}</span>
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
