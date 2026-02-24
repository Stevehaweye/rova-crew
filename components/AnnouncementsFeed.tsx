'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Announcement {
  id: string
  content: string
  contentType: string
  imageUrl: string | null
  isPinned: boolean
  editedAt: string | null
  createdAt: string
  sender: {
    id: string
    fullName: string
    avatarUrl: string | null
  }
  reactions: ReactionGroup[]
}

export interface ReactionGroup {
  emoji: string
  count: number
  reacted: boolean // whether current user reacted with this emoji
}

interface Props {
  channelId: string
  currentUserId: string
  initialAnnouncements: Announcement[]
  isAdmin: boolean
  groupColour: string
  groupSlug: string
}

const EMOJI_OPTIONS = ['👍', '❤️', '🔥', '👏', '😂', '💯', '🎉', '👀']

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

export default function AnnouncementsFeed({
  channelId,
  currentUserId,
  initialAnnouncements,
  isAdmin,
  groupColour,
  groupSlug,
}: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [emojiPickerOpenId, setEmojiPickerOpenId] = useState<string | null>(null)
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null)

  // ── Real-time subscriptions ─────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    // Subscribe to new/updated messages
    const messagesChannel = supabase
      .channel(`announcements-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string
            sender_id: string
            content: string
            content_type: string
            image_url: string | null
            is_pinned: boolean
            edited_at: string | null
            deleted_at: string | null
            created_at: string
          }

          if (row.deleted_at) return

          // Fetch sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', row.sender_id)
            .maybeSingle()

          const newAnnouncement: Announcement = {
            id: row.id,
            content: row.content,
            contentType: row.content_type,
            imageUrl: row.image_url,
            isPinned: row.is_pinned,
            editedAt: row.edited_at,
            createdAt: row.created_at,
            sender: {
              id: row.sender_id,
              fullName: profile?.full_name ?? 'Member',
              avatarUrl: profile?.avatar_url ?? null,
            },
            reactions: [],
          }

          setAnnouncements((prev) => {
            if (prev.some((a) => a.id === newAnnouncement.id)) return prev
            // Insert at top (newest first), but after pinned items
            const pinned = prev.filter((a) => a.isPinned)
            const unpinned = prev.filter((a) => !a.isPinned)
            return [...pinned, newAnnouncement, ...unpinned]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string
            content: string
            content_type: string
            image_url: string | null
            is_pinned: boolean
            edited_at: string | null
            deleted_at: string | null
          }

          setAnnouncements((prev) => {
            // Soft-deleted
            if (row.deleted_at) {
              return prev.filter((a) => a.id !== row.id)
            }

            const updated = prev.map((a) =>
              a.id === row.id
                ? {
                    ...a,
                    content: row.content,
                    contentType: row.content_type,
                    imageUrl: row.image_url,
                    isPinned: row.is_pinned,
                    editedAt: row.edited_at,
                  }
                : a
            )

            // Re-sort: pinned first, then by date desc
            return updated.sort((a, b) => {
              if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            })
          })
        }
      )
      .subscribe()

    // Subscribe to reactions
    const reactionsChannel = supabase
      .channel(`reactions-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          // Refetch reactions for all visible messages
          refreshReactions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(reactionsChannel)
    }
  }, [channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshReactions = useCallback(async () => {
    const supabase = createClient()

    setAnnouncements((prev) => {
      const messageIds = prev.map((a) => a.id)
      if (messageIds.length === 0) return prev

      // Async update
      supabase
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', messageIds)
        .then(({ data: reactions }) => {
          if (!reactions) return

          setAnnouncements((current) =>
            current.map((a) => {
              const msgReactions = reactions.filter((r) => r.message_id === a.id)
              const grouped: Record<string, { count: number; reacted: boolean }> = {}

              for (const r of msgReactions) {
                if (!grouped[r.emoji]) {
                  grouped[r.emoji] = { count: 0, reacted: false }
                }
                grouped[r.emoji].count++
                if (r.user_id === currentUserId) {
                  grouped[r.emoji].reacted = true
                }
              }

              return {
                ...a,
                reactions: Object.entries(grouped).map(([emoji, data]) => ({
                  emoji,
                  count: data.count,
                  reacted: data.reacted,
                })),
              }
            })
          )
        })

      return prev
    })
  }, [currentUserId])

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handlePin(id: string, isPinned: boolean) {
    setActionMenuOpenId(null)
    const method = isPinned ? 'DELETE' : 'POST'
    await fetch(`/api/announcements/${id}/pin`, { method })
  }

  function handleStartEdit(announcement: Announcement) {
    setActionMenuOpenId(null)
    setEditingId(announcement.id)
    setEditContent(announcement.content)
  }

  async function handleSaveEdit(id: string) {
    if (!editContent.trim()) return
    setEditSaving(true)

    const res = await fetch(`/api/announcements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent.trim() }),
    })

    if (res.ok) {
      setEditingId(null)
      setEditContent('')
    }
    setEditSaving(false)
  }

  async function handleDelete(id: string) {
    setActionMenuOpenId(null)
    if (!confirm('Delete this announcement?')) return

    await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
  }

  async function handleReaction(messageId: string, emoji: string, alreadyReacted: boolean) {
    setEmojiPickerOpenId(null)

    const method = alreadyReacted ? 'DELETE' : 'POST'
    await fetch(`/api/announcements/${messageId}/reactions`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (announcements.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-4xl mb-3 select-none">📣</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">No announcements yet</p>
        <p className="text-sm text-gray-400">
          {isAdmin
            ? 'Post your first announcement above to get started.'
            : 'Announcements from admins will appear here.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {announcements.map((a) => (
        <div
          key={a.id}
          className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
            a.isPinned ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-100'
          }`}
        >
          {/* Pin badge */}
          {a.isPinned && (
            <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
              <span className="text-xs">📌</span>
              <span className="text-[11px] font-semibold text-amber-700">Pinned</span>
            </div>
          )}

          <div className="p-4 sm:p-5">
            {/* Header: author + time + admin menu */}
            <div className="flex items-start gap-3 mb-3">
              {/* Avatar */}
              {a.sender.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.sender.avatarUrl}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ backgroundColor: groupColour }}
                >
                  {initials(a.sender.fullName)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {a.sender.fullName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </span>
                  {a.editedAt && (
                    <span className="text-[10px] text-gray-400 italic">edited</span>
                  )}
                </div>
              </div>

              {/* Admin actions */}
              {isAdmin && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() =>
                      setActionMenuOpenId(actionMenuOpenId === a.id ? null : a.id)
                    }
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                    </svg>
                  </button>

                  {actionMenuOpenId === a.id && (
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setActionMenuOpenId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
                        <button
                          onClick={() => handlePin(a.id, a.isPinned)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span className="text-xs">{a.isPinned ? '📌' : '📌'}</span>
                          {a.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          onClick={() => handleStartEdit(a)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span className="text-xs">✏️</span>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <span className="text-xs">🗑️</span>
                          Delete
                        </button>
                        <button
                          onClick={() => {
                            setEmojiPickerOpenId(null)
                            window.location.href = `/g/${groupSlug}/admin/blast?title=Announcement&body=${encodeURIComponent(a.content.slice(0, 300))}`
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span className="text-xs">📢</span>
                          Blast this
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            {editingId === a.id ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value.slice(0, 2000))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                  style={{ '--tw-ring-color': groupColour } as React.CSSProperties}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveEdit(a.id)}
                    disabled={editSaving || !editContent.trim()}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: groupColour }}
                  >
                    {editSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null)
                      setEditContent('')
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <span className="ml-auto text-[10px] text-gray-400">
                    {editContent.length}/2000
                  </span>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                  {a.content}
                </p>

                {/* Image */}
                {a.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt=""
                    className="mt-3 rounded-xl max-h-80 w-full object-cover"
                  />
                )}
              </>
            )}

            {/* Reactions bar */}
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {/* Existing reactions */}
              {a.reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => handleReaction(a.id, r.emoji, r.reacted)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                    r.reacted
                      ? 'bg-blue-50 border border-blue-200 text-blue-700'
                      : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="font-semibold">{r.count}</span>
                </button>
              ))}

              {/* Add reaction button */}
              <div className="relative">
                <button
                  onClick={() =>
                    setEmojiPickerOpenId(emojiPickerOpenId === a.id ? null : a.id)
                  }
                  className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  title="Add reaction"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                  </svg>
                </button>

                {emojiPickerOpenId === a.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setEmojiPickerOpenId(null)}
                    />
                    <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-lg border border-gray-100 p-2 flex gap-1 z-20">
                      {EMOJI_OPTIONS.map((emoji) => {
                        const existing = a.reactions.find((r) => r.emoji === emoji)
                        return (
                          <button
                            key={emoji}
                            onClick={() =>
                              handleReaction(a.id, emoji, existing?.reacted ?? false)
                            }
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-gray-100 transition-colors ${
                              existing?.reacted ? 'bg-blue-50' : ''
                            }`}
                          >
                            {emoji}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
