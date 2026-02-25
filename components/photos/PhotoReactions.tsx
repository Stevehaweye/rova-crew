'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  photoId: string
  initialCount: number
  initialReacted: boolean
  currentUserId: string
  size?: 'sm' | 'lg'
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PhotoReactions({
  photoId,
  initialCount,
  initialReacted,
  currentUserId,
  size = 'lg',
}: Props) {
  const [count, setCount] = useState(initialCount)
  const [reacted, setReacted] = useState(initialReacted)
  const [showHeartAnim, setShowHeartAnim] = useState(false)
  const lastTapRef = useRef(0)
  const animTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Realtime subscription for reaction count
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`photo-reactions-${photoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photo_reactions',
          filter: `photo_id=eq.${photoId}`,
        },
        () => {
          // Refetch count
          supabase
            .from('photo_reactions')
            .select('user_id')
            .eq('photo_id', photoId)
            .eq('emoji', '❤️')
            .then(({ data }) => {
              const rows = data ?? []
              setCount(rows.length)
              setReacted(rows.some((r) => r.user_id === currentUserId))
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [photoId, currentUserId])

  const toggleReaction = useCallback(async () => {
    const wasReacted = reacted

    // Optimistic update
    setReacted(!wasReacted)
    setCount((c) => (wasReacted ? Math.max(c - 1, 0) : c + 1))

    // Show heart animation on like
    if (!wasReacted) {
      setShowHeartAnim(true)
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
      animTimerRef.current = setTimeout(() => setShowHeartAnim(false), 800)
    }

    try {
      const res = await fetch(`/api/photos/${photoId}/reactions`, {
        method: wasReacted ? 'DELETE' : 'POST',
      })

      if (!res.ok) {
        // Revert
        setReacted(wasReacted)
        setCount((c) => (wasReacted ? c + 1 : Math.max(c - 1, 0)))
      }
    } catch {
      setReacted(wasReacted)
      setCount((c) => (wasReacted ? c + 1 : Math.max(c - 1, 0)))
    }
  }, [reacted, photoId])

  function handleDoubleTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      toggleReaction()
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  // ── Small (grid overlay) ──────────────────────────────────────────────────
  if (size === 'sm') {
    return (
      <>
        {count > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
            <span className="text-xs">❤️</span>
            <span className="text-xs font-semibold text-gray-700">{count}</span>
          </div>
        )}
      </>
    )
  }

  // ── Large (lightbox) ──────────────────────────────────────────────────────
  return (
    <div>
      {/* Heart animation overlay — rendered by parent via doubleTap handler */}
      {showHeartAnim && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span
            className="text-7xl"
            style={{
              animation: 'heartPop 800ms ease-out forwards',
            }}
          >
            ❤️
          </span>
        </div>
      )}

      {/* Heart button + count */}
      <button
        onClick={toggleReaction}
        className="flex items-center gap-1.5 group"
      >
        {reacted ? (
          <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white/70 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        )}
        <span className="text-sm font-semibold text-white">{count > 0 ? count : ''}</span>
      </button>

      {/* CSS keyframe */}
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

// Export double-tap handler for parent use
export function useDoubleTap(onDoubleTap: () => void) {
  const lastTapRef = useRef(0)

  return {
    onTouchEnd: () => {
      const now = Date.now()
      if (now - lastTapRef.current < 300) {
        onDoubleTap()
        lastTapRef.current = 0
      } else {
        lastTapRef.current = now
      }
    },
  }
}
