'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Comment {
  id: string
  content: string
  createdAt: string
  userId: string
  fullName: string
  avatarUrl: string | null
}

interface GroupMember {
  id: string
  fullName: string
  avatarUrl: string | null
}

interface Props {
  photoId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
  groupMembers: GroupMember[]
  groupColour: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function renderContent(text: string, memberNames: string[], colour: string) {
  if (!memberNames.length) return text

  const escaped = memberNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'g')
  const parts = text.split(pattern)

  return parts.map((part, i) => {
    if (part.startsWith('@') && memberNames.some((n) => part === `@${n}`)) {
      return (
        <span key={i} className="font-semibold" style={{ color: colour }}>
          {part}
        </span>
      )
    }
    return part
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PhotoComments({
  photoId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  groupMembers,
  groupColour,
}: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const memberNames = groupMembers.map((m) => m.fullName)

  // Fetch comments
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/photos/${photoId}/comments`)
      if (res.ok) {
        const data = await res.json()
        setComments(data)
      }
    }
    load()
  }, [photoId])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`photo-comments-${photoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photo_comments',
          filter: `photo_id=eq.${photoId}`,
        },
        async () => {
          // Refetch all comments
          const res = await fetch(`/api/photos/${photoId}/comments`)
          if (res.ok) {
            const data = await res.json()
            setComments(data)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [photoId])

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments.length])

  // @mention detection
  function handleInputChange(value: string) {
    setBody(value)

    const cursor = textareaRef.current?.selectionStart ?? value.length
    const textBefore = value.slice(0, cursor)
    const mentionMatch = textBefore.match(/@(\w*)$/)
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1].toLowerCase())
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  const filteredMembers =
    mentionQuery !== null
      ? groupMembers
          .filter((m) => m.id !== currentUserId && m.fullName.toLowerCase().includes(mentionQuery))
          .slice(0, 5)
      : []

  function insertMention(member: GroupMember) {
    const cursor = textareaRef.current?.selectionStart ?? body.length
    const textBefore = body.slice(0, cursor)
    const textAfter = body.slice(cursor)
    const mentionStart = textBefore.lastIndexOf('@')
    const newBody = textBefore.slice(0, mentionStart) + `@${member.fullName} ` + textAfter
    setBody(newBody)
    setMentionQuery(null)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredMembers[mentionIndex])
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = useCallback(async () => {
    const content = body.trim()
    if (!content || sending) return

    setSending(true)

    // Optimistic insert
    const optimistic: Comment = {
      id: `temp-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      userId: currentUserId,
      fullName: currentUserName,
      avatarUrl: currentUserAvatar,
    }
    setComments((prev) => [...prev, optimistic])
    setBody('')

    try {
      const res = await fetch(`/api/photos/${photoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) {
        // Revert
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
        setBody(content)
      }
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
      setBody(content)
    }

    setSending(false)
  }, [body, sending, photoId, currentUserId, currentUserName, currentUserAvatar])

  async function handleDelete(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId))

    try {
      await fetch(`/api/photos/${photoId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId }),
      })
    } catch {
      // Silently fail — comment already removed from UI
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comment list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-60">
        {comments.length === 0 ? (
          <p className="text-xs text-white/40 text-center py-4">No comments yet</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5 group">
              {/* Avatar */}
              {comment.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={comment.avatarUrl}
                  alt={comment.fullName}
                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
                  style={{ backgroundColor: groupColour }}
                >
                  {initials(comment.fullName)}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-white">{comment.fullName}</span>
                  <span className="text-[10px] text-white/40">{timeAgo(comment.createdAt)}</span>
                  {comment.userId === currentUserId && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-[10px] text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="text-sm text-white/80 leading-relaxed break-words">
                  {renderContent(comment.content, memberNames, groupColour)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* @mention dropdown */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="px-4 py-2 bg-gray-900 border-t border-white/10 space-y-0.5 max-h-40 overflow-y-auto">
          {filteredMembers.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => insertMention(m)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                idx === mentionIndex ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ backgroundColor: groupColour }}
                >
                  {initials(m.fullName)}
                </div>
              )}
              <span className="text-sm font-medium text-white/80">{m.fullName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          rows={1}
          className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-1 focus:ring-white/20"
          style={{ maxHeight: '80px' }}
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-opacity"
          style={{ backgroundColor: groupColour }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
