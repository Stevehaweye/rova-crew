'use client'

import { useState, useEffect } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  photoId: string
  isFeatured: boolean
  isAlbumCover: boolean
  isHidden: boolean
  onAction: (action: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminPhotoMenu({
  photoId,
  isFeatured,
  isAlbumCover,
  isHidden,
  onAction,
}: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  async function handleAction(action: string) {
    if (action === 'delete' && !confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/photos/${photoId}/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (res.ok) {
        onAction(action)
      }
    } catch {
      // Silently fail
    }
    setLoading(false)
    setOpen(false)
    setConfirmDelete(false)
  }

  return (
    <>
      {/* Three-dot trigger */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors z-10"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18" r="1.5" />
        </svg>
      </button>

      {/* Action sheet */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30"
            onClick={() => {
              setOpen(false)
              setConfirmDelete(false)
            }}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl p-4 space-y-1"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            {confirmDelete ? (
              /* Delete confirmation */
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900 text-center">
                  Delete this photo?
                </p>
                <p className="text-xs text-gray-500 text-center">This cannot be undone.</p>
                <button
                  onClick={() => handleAction('delete')}
                  disabled={loading}
                  className="w-full text-center px-4 py-3 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete permanently'}
                </button>
                <button
                  onClick={() => {
                    setConfirmDelete(false)
                    setOpen(false)
                  }}
                  className="w-full text-center px-4 py-3 rounded-xl text-sm font-bold text-gray-400"
                >
                  Cancel
                </button>
              </div>
            ) : (
              /* Action menu */
              <>
                <button
                  onClick={() => handleAction(isFeatured ? 'unfeature' : 'feature')}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {isFeatured ? '⭐ Remove from featured' : '⭐ Feature this photo'}
                </button>

                <button
                  onClick={() => handleAction('set_album_cover')}
                  disabled={loading || isAlbumCover}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {isAlbumCover ? '🖼 ✓ Album cover' : '🖼 Set as album cover'}
                </button>

                <button
                  onClick={() => handleAction(isHidden ? 'unhide' : 'hide')}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {isHidden ? '👁 Unhide this photo' : '🚫 Hide this photo'}
                </button>

                <button
                  onClick={() => handleAction('delete')}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  🗑 Delete permanently
                </button>

                <button
                  onClick={() => setOpen(false)}
                  className="w-full text-center px-4 py-3 rounded-xl text-sm font-bold text-gray-400"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
