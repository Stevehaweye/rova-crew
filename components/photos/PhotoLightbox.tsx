'use client'

import { useState, useEffect, useRef } from 'react'
import PhotoReactions from './PhotoReactions'
import PhotoComments from './PhotoComments'
import AdminPhotoMenu from './AdminPhotoMenu'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PhotoData {
  id: string
  photoUrl: string
  storagePath: string
  uploaderId: string
  uploaderName: string
  uploaderAvatar: string | null
  uploadedAt: string
  reactionCount: number
  userReacted: boolean
  isFeatured: boolean
  isAlbumCover: boolean
  isHidden: boolean
}

interface GroupMember {
  id: string
  fullName: string
  avatarUrl: string | null
}

interface Props {
  photo: PhotoData
  eventId: string
  groupId: string
  groupColour: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
  isAdmin: boolean
  groupMembers: GroupMember[]
  onClose: () => void
  onPhotoUpdated: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PhotoLightbox({
  photo,
  eventId,
  groupId,
  groupColour,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isAdmin,
  groupMembers,
  onClose,
  onPhotoUpdated,
}: Props) {
  const [downloading, setDownloading] = useState(false)
  const [toast, setToast] = useState('')
  const [show, setShow] = useState(false)
  const lastTapRef = useRef(0)
  const heartAnimRef = useRef<HTMLDivElement>(null)

  const canDownload = photo.uploaderId === currentUserId || isAdmin

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 10)
    return () => clearTimeout(t)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  // Double-tap heart animation
  function handlePhotoTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // Show heart animation
      if (heartAnimRef.current) {
        heartAnimRef.current.style.animation = 'none'
        // Force reflow
        void heartAnimRef.current.offsetHeight
        heartAnimRef.current.style.animation = 'heartPop 800ms ease-out forwards'
      }
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/photos/${photo.id}/download`)
      if (res.ok) {
        const { url } = await res.json()
        window.open(url, '_blank')
      }
    } catch {
      setToast('Download failed')
    }
    setDownloading(false)
  }

  async function handleShare() {
    try {
      const res = await fetch(`/api/photos/${photo.id}/download`)
      if (!res.ok) {
        setToast('Share failed')
        return
      }
      const { url } = await res.json()

      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: 'Event Photo', url })
          return
        } catch {
          // User cancelled or not supported
        }
      }

      await navigator.clipboard.writeText(url)
      setToast('Link copied!')
    } catch {
      setToast('Share failed')
    }
  }

  function handleAdminAction(action: string) {
    onPhotoUpdated()
    if (action === 'delete' || action === 'hide') {
      onClose()
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-black flex flex-col transition-opacity duration-200 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {/* Admin menu */}
          {isAdmin && (
            <div className="relative">
              <AdminPhotoMenu
                photoId={photo.id}
                isFeatured={photo.isFeatured}
                isAlbumCover={photo.isAlbumCover}
                isHidden={photo.isHidden}
                onAction={handleAdminAction}
              />
            </div>
          )}
        </div>
      </div>

      {/* Photo area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0"
        onClick={handlePhotoTap}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.photoUrl}
          alt=""
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />

        {/* Heart animation overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            ref={heartAnimRef}
            className="text-7xl opacity-0"
          >
            ❤️
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="shrink-0 px-4 py-3 bg-black/80 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-center justify-between mb-2">
          {/* Reactions */}
          <PhotoReactions
            photoId={photo.id}
            initialCount={photo.reactionCount}
            initialReacted={photo.userReacted}
            currentUserId={currentUserId}
            size="lg"
          />

          {/* Download + Share */}
          {canDownload && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {downloading ? 'Loading...' : 'Download'}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 text-xs font-medium transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                </svg>
                Share
              </button>
            </div>
          )}
        </div>

        {/* Uploader info */}
        <div className="flex items-center gap-2">
          {photo.uploaderAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.uploaderAvatar}
              alt={photo.uploaderName}
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
              style={{ backgroundColor: groupColour }}
            >
              {photo.uploaderName[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-xs text-white/50">
            {photo.uploaderName} &middot; {timeAgo(photo.uploadedAt)}
          </span>
        </div>
      </div>

      {/* Comments */}
      <div className="shrink-0 max-h-[40vh] flex flex-col bg-gray-950 border-t border-white/10">
        <PhotoComments
          photoId={photo.id}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          groupMembers={groupMembers}
          groupColour={groupColour}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-xl px-4 py-2 shadow-lg">
          <p className="text-sm font-medium text-gray-900">{toast}</p>
        </div>
      )}

      {/* CSS */}
      <style jsx>{`
        @keyframes heartPop {
          0% { transform: scale(0); opacity: 1; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
