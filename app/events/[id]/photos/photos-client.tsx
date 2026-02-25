'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import PhotoGridItem from '@/components/photos/PhotoGridItem'
import PhotoLightbox from '@/components/photos/PhotoLightbox'
import ConsentPrompt from '@/components/photos/ConsentPrompt'

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface Props {
  event: { id: string; title: string }
  group: { id: string; name: string; slug: string; colour: string }
  currentUser: { id: string; fullName: string; avatarUrl: string | null }
  isAdmin: boolean
  consentLevel: string | null
  groupMembers: { id: string; fullName: string; avatarUrl: string | null }[]
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PhotosClient({
  event,
  group,
  currentUser,
  isAdmin,
  consentLevel: initialConsent,
  groupMembers,
}: Props) {
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [consentLevel, setConsentLevel] = useState(initialConsent)
  const [showConsent, setShowConsent] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch photos on mount ───────────────────────────────────────────────

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${event.id}/photos`)
      if (res.ok) {
        const data = await res.json()
        setPhotos(data.photos ?? [])
      }
    } catch (err) {
      console.error('[photos] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [event.id])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  // ── Upload handler ──────────────────────────────────────────────────────

  function handleUploadClick() {
    if (consentLevel === 'never') {
      alert('Photo uploads are disabled by your privacy settings. You can change this in Settings > Photo Privacy.')
      return
    }
    fileInputRef.current?.click()
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    // Reset input so same files can be re-selected
    e.target.value = ''

    if (!consentLevel) {
      // First-time uploader — show consent prompt
      setPendingFiles(files)
      setShowConsent(true)
      return
    }

    uploadFiles(files)
  }

  function handleConsentComplete(level: string) {
    setConsentLevel(level)
    setShowConsent(false)

    if (level === 'never') {
      setPendingFiles([])
      return
    }

    // Continue with pending uploads
    if (pendingFiles.length > 0) {
      uploadFiles(pendingFiles)
      setPendingFiles([])
    }
  }

  async function uploadFiles(files: File[]) {
    setUploading(true)
    let uploaded = 0

    for (const file of files) {
      setUploadProgress(`Uploading ${uploaded + 1} of ${files.length}...`)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/events/${event.id}/photos`, {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (data.needsConsent) {
          // Server says we need consent — show prompt
          setPendingFiles(files.slice(uploaded))
          setShowConsent(true)
          setUploading(false)
          setUploadProgress('')
          return
        }

        if (res.ok && data.success) {
          uploaded++
        }
      } catch (err) {
        console.error('[photos] upload error:', err)
      }
    }

    setUploading(false)
    setUploadProgress('')

    // Refresh photos to show new uploads with signed URLs
    if (uploaded > 0) {
      fetchPhotos()
    }
  }

  // ── Lightbox handlers ───────────────────────────────────────────────────

  const visiblePhotos = isAdmin ? photos : photos.filter((p) => !p.isHidden)
  const selectedPhoto = selectedIndex !== null ? visiblePhotos[selectedIndex] : null

  function openLightbox(index: number) {
    setSelectedIndex(index)
  }

  function closeLightbox() {
    setSelectedIndex(null)
  }

  function handlePhotoUpdated() {
    fetchPhotos()
    setSelectedIndex(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href={`/events/${event.id}`}
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
          <span className="text-gray-300 text-lg">·</span>
          <span className="text-sm font-semibold text-gray-600 truncate">Photos</span>

          {/* Upload button */}
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="ml-auto px-4 py-2 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: group.colour }}
          >
            {uploading ? uploadProgress : '📷 Upload'}
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">{event.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {visiblePhotos.length} photo{visiblePhotos.length !== 1 ? 's' : ''}
            {' · '}{group.name}
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-20 text-center">
            <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && visiblePhotos.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <p className="text-4xl mb-3 select-none">📷</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">No photos yet</p>
            <p className="text-sm text-gray-400 mb-5">Be the first to share a moment from this event.</p>
            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: group.colour }}
            >
              Upload photos
            </button>
          </div>
        )}

        {/* Photo grid */}
        {!loading && visiblePhotos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {visiblePhotos.map((photo, index) => (
              <PhotoGridItem
                key={photo.id}
                photo={photo}
                isAdmin={isAdmin}
                onClick={() => openLightbox(index)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Consent prompt modal */}
      {showConsent && (
        <ConsentPrompt
          groupName={group.name}
          groupId={group.id}
          onComplete={handleConsentComplete}
          onCancel={() => {
            setShowConsent(false)
            setPendingFiles([])
          }}
        />
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <PhotoLightbox
          photo={selectedPhoto}
          eventId={event.id}
          groupId={group.id}
          groupColour={group.colour}
          currentUserId={currentUser.id}
          currentUserName={currentUser.fullName}
          currentUserAvatar={currentUser.avatarUrl}
          isAdmin={isAdmin}
          groupMembers={groupMembers}
          onClose={closeLightbox}
          onPhotoUpdated={handlePhotoUpdated}
        />
      )}
    </div>
  )
}
