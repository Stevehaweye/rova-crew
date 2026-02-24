'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  content: string
  contentType: string
  imageUrl: string | null
  isPinned: boolean
  editedAt: string | null
  deletedAt: string | null
  deletedBy: string | null
  createdAt: string
  replyToId: string | null
  replyTo: { content: string; senderName: string } | null
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
  reacted: boolean
}

export interface ChatMember {
  id: string
  fullName: string
  avatarUrl: string | null
}

interface Props {
  channelId: string
  groupId: string
  groupSlug: string
  groupName: string
  groupColour: string
  currentUserId: string
  isAdmin: boolean
  initialMessages: ChatMessage[]
  members: ChatMember[]
  mutedUntil: string | null
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🔥']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function formatDateSeparator(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE d MMM')
}

// ─── Mention rendering ───────────────────────────────────────────────────────

function renderContent(
  text: string,
  memberNames: string[],
  colour: string
) {
  if (!memberNames.length) return text

  // Build pattern to match @Name
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function GroupChat({
  channelId,
  groupId,
  groupSlug,
  groupName,
  groupColour,
  currentUserId,
  isAdmin,
  initialMessages,
  members,
  mutedUntil,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)

  // Interaction states
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [emojiPickerId, setEmojiPickerId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Mute
  const [muteTarget, setMuteTarget] = useState<{ userId: string; fullName: string } | null>(null)
  const [muteLoading, setMuteLoading] = useState(false)

  // @mentions
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)

  // Typing indicator
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const presenceChannelRef = useRef<any>(null)

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Long-press for mobile
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Scroll
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const memberNames = members.map((m) => m.fullName)

  // ── Scroll helpers ──────────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom()
  }, [messages, scrollToBottom])

  // Initial scroll
  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      isAtBottomRef.current = true
    })
  }, [])

  // ── Mark as read ────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    }).catch(() => {})
  }, [channelId])

  // ── Real-time subscriptions ─────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    const messagesChannel = supabase
      .channel(`group-chat-${channelId}`)
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
            reply_to_id: string | null
            created_at: string
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', row.sender_id)
            .maybeSingle()

          // Fetch reply-to if present
          let replyToData: { content: string; senderName: string } | null = null
          if (row.reply_to_id) {
            const { data: replyMsg } = await supabase
              .from('messages')
              .select('content, profiles:sender_id ( full_name )')
              .eq('id', row.reply_to_id)
              .maybeSingle()
            if (replyMsg) {
              const rp = replyMsg.profiles as unknown as { full_name: string }
              replyToData = { content: replyMsg.content, senderName: rp?.full_name ?? 'Member' }
            }
          }

          const newMsg: ChatMessage = {
            id: row.id,
            content: row.content,
            contentType: row.content_type,
            imageUrl: row.image_url,
            isPinned: row.is_pinned,
            editedAt: row.edited_at,
            deletedAt: row.deleted_at,
            deletedBy: null,
            createdAt: row.created_at,
            replyToId: row.reply_to_id,
            replyTo: replyToData,
            sender: {
              id: row.sender_id,
              fullName: profile?.full_name ?? 'Member',
              avatarUrl: profile?.avatar_url ?? null,
            },
            reactions: [],
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
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
            is_pinned: boolean
            edited_at: string | null
            deleted_at: string | null
            deleted_by: string | null
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    content: row.content,
                    isPinned: row.is_pinned,
                    editedAt: row.edited_at,
                    deletedAt: row.deleted_at,
                    deletedBy: row.deleted_by,
                  }
                : m
            )
          )
        }
      )
      .subscribe()

    // Reactions channel
    const reactionsChannel = supabase
      .channel(`chat-reactions-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        refreshReactions()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(reactionsChannel)
    }
  }, [channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Presence (typing) ───────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`chat-presence-${channelId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user_id: string; name: string; typing: boolean }>()
        const typing: string[] = []
        for (const key of Object.keys(state)) {
          for (const presence of state[key]) {
            if (presence.typing && presence.user_id !== currentUserId) {
              typing.push(presence.name)
            }
          }
        }
        setTypingUsers(typing)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const me = members.find((m) => m.id === currentUserId)
          await channel.track({
            user_id: currentUserId,
            name: me?.fullName ?? 'Member',
            typing: false,
          })
        }
      })

    presenceChannelRef.current = channel as unknown as typeof presenceChannelRef.current

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, currentUserId, members])

  function setTyping(typing: boolean) {
    const channel = presenceChannelRef.current
    if (!channel?.track) return
    const me = members.find((m) => m.id === currentUserId)
    channel.track({
      user_id: currentUserId,
      name: me?.fullName ?? 'Member',
      typing,
    })
  }

  // ── Refresh reactions ───────────────────────────────────────────────────

  const refreshReactions = useCallback(async () => {
    const supabase = createClient()

    setMessages((prev) => {
      const ids = prev.map((m) => m.id)
      if (ids.length === 0) return prev

      supabase
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', ids)
        .then(({ data: reactions }) => {
          if (!reactions) return
          setMessages((current) =>
            current.map((m) => {
              const msgReactions = reactions.filter((r) => r.message_id === m.id)
              const grouped: Record<string, { count: number; reacted: boolean }> = {}
              for (const r of msgReactions) {
                if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, reacted: false }
                grouped[r.emoji].count++
                if (r.user_id === currentUserId) grouped[r.emoji].reacted = true
              }
              return {
                ...m,
                reactions: Object.entries(grouped).map(([emoji, d]) => ({
                  emoji,
                  count: d.count,
                  reacted: d.reacted,
                })),
              }
            })
          )
        })

      return prev
    })
  }, [currentUserId])

  // ── @mention handling ───────────────────────────────────────────────────

  function handleInputChange(value: string) {
    setBody(value.slice(0, 2000))

    // Typing indicator
    setTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 3000)

    // @mention detection
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

  const filteredMembers = mentionQuery !== null
    ? members
        .filter((m) => m.id !== currentUserId && m.fullName.toLowerCase().includes(mentionQuery))
        .slice(0, 5)
    : []

  function insertMention(member: ChatMember) {
    const cursor = textareaRef.current?.selectionStart ?? body.length
    const textBefore = body.slice(0, cursor)
    const textAfter = body.slice(cursor)
    const mentionStart = textBefore.lastIndexOf('@')
    const newBody = textBefore.slice(0, mentionStart) + `@${member.fullName} ` + textAfter
    setBody(newBody)
    setMentionQuery(null)
    textareaRef.current?.focus()
  }

  // ── Send message ────────────────────────────────────────────────────────

  async function handleSend() {
    if ((!body.trim() && !imageUrl) || sending) return
    const text = body.trim()
    setBody('')
    setImageUrl(null)
    setReplyTo(null)
    setMentionQuery(null)
    setTyping(false)
    setSending(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        groupId,
        content: text || '📷',
        imageUrl: imageUrl || undefined,
        replyToId: replyTo?.id || undefined,
      }),
    })

    if (!res.ok) {
      setBody(text)
      console.error('[GroupChat] send failed')
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // @mention navigation
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

  // ── Image upload ────────────────────────────────────────────────────────

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB')
      return
    }

    setImageUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `chat/${groupSlug}/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('group-logos')
      .upload(path, file, { upsert: true })

    if (error) {
      console.error('[GroupChat] upload error:', error)
      setImageUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('group-logos').getPublicUrl(data.path)
    setImageUrl(publicUrl)
    setImageUploading(false)
  }

  // ── Message actions ─────────────────────────────────────────────────────

  async function handleReaction(messageId: string, emoji: string, alreadyReacted: boolean) {
    setEmojiPickerId(null)
    setActiveMenuId(null)
    const method = alreadyReacted ? 'DELETE' : 'POST'
    await fetch(`/api/chat/${messageId}/reactions`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    })
  }

  function handleReply(msg: ChatMessage) {
    setActiveMenuId(null)
    setReplyTo(msg)
    textareaRef.current?.focus()
  }

  function handleStartEdit(msg: ChatMessage) {
    setActiveMenuId(null)
    setEditingId(msg.id)
    setEditContent(msg.content)
  }

  async function handleSaveEdit(id: string) {
    if (!editContent.trim()) return
    setEditSaving(true)
    const res = await fetch(`/api/chat/${id}`, {
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
    setActiveMenuId(null)
    if (!confirm('Delete this message?')) return
    await fetch(`/api/chat/${id}`, { method: 'DELETE' })
  }

  async function handlePin(id: string, isPinned: boolean) {
    setActiveMenuId(null)
    await fetch(`/api/chat/${id}/pin`, { method: isPinned ? 'DELETE' : 'POST' })
  }

  function handleMuteOpen(msg: ChatMessage) {
    setActiveMenuId(null)
    setMuteTarget({ userId: msg.sender.id, fullName: msg.sender.fullName })
  }

  async function handleMute(duration: '1h' | '24h' | '7d' | 'permanent') {
    if (!muteTarget) return
    setMuteLoading(true)
    await fetch(`/api/groups/${groupSlug}/members/${muteTarget.userId}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration }),
    })
    setMuteLoading(false)
    setMuteTarget(null)
  }

  function scrollToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-yellow-50')
      setTimeout(() => el.classList.remove('bg-yellow-50'), 2000)
    }
  }

  // Long-press handlers for mobile
  function handleTouchStart(msgId: string) {
    longPressTimerRef.current = setTimeout(() => {
      setActiveMenuId(msgId)
    }, 500)
  }

  function handleTouchEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50 z-50">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3 flex-shrink-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <Link
          href={`/g/${groupSlug}`}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{groupName}</p>
          <p className="text-[11px] text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
      </header>

      {/* ── Pinned message banner ──────────────────────────────────── */}
      {(() => {
        const pinned = [...messages].reverse().find(m => m.isPinned && !m.deletedAt)
        if (!pinned) return null
        return (
          <button
            onClick={() => scrollToMessage(pinned.id)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 w-full text-left hover:bg-amber-100/60 transition-colors flex-shrink-0"
          >
            <span className="text-sm select-none">📌</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-amber-700">{pinned.sender.fullName}</p>
              <p className="text-xs text-amber-600 truncate">{pinned.content}</p>
            </div>
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )
      })()}

      {/* ── Messages ────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-3xl mb-2 select-none">👋</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">Welcome to the chat!</p>
            <p className="text-xs text-gray-400">Say hello to the group.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const prev = i > 0 ? messages[i - 1] : null
            const msgDate = new Date(msg.createdAt)
            const prevDate = prev ? new Date(prev.createdAt) : null
            const showDateSep = !prevDate || !isSameDay(msgDate, prevDate)
            const isOwn = msg.sender.id === currentUserId
            const isSystem = msg.contentType === 'system'
            const isDeleted = !!msg.deletedAt
            const showMeta = !prev || prev.sender.id !== msg.sender.id || showDateSep || !!prev.deletedAt

            return (
              <div key={msg.id}>
                {/* Date separator */}
                {showDateSep && (
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 rounded-full bg-gray-200/70 text-[11px] font-semibold text-gray-500">
                      {formatDateSeparator(msgDate)}
                    </span>
                  </div>
                )}

                {/* System message */}
                {isSystem && !isDeleted && (
                  <div className="flex justify-center my-2">
                    <span className="text-xs text-gray-400 italic">{msg.content}</span>
                  </div>
                )}

                {/* Deleted message */}
                {isDeleted && !isSystem && (
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showMeta ? 'mt-3' : 'mt-0.5'}`}>
                    <p className="text-xs text-gray-400 italic px-3 py-1.5">
                      {msg.deletedBy && msg.deletedBy !== msg.sender.id
                        ? 'Message removed by admin'
                        : 'This message was deleted'}
                    </p>
                  </div>
                )}

                {/* Normal message */}
                {!isSystem && !isDeleted && (
                  <div
                    id={`msg-${msg.id}`}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showMeta ? 'mt-3' : 'mt-0.5'} group/msg transition-colors rounded-lg`}
                    onTouchStart={() => handleTouchStart(msg.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                  >
                    {/* Other's messages */}
                    {!isOwn && (
                      <div className="flex items-end gap-2 max-w-[80%]">
                        {showMeta ? (
                          msg.sender.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={msg.sender.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                              style={{ backgroundColor: groupColour }}
                            >
                              {initials(msg.sender.fullName)}
                            </div>
                          )
                        ) : (
                          <div className="w-7 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          {showMeta && (
                            <div className="flex items-baseline gap-2 mb-0.5 ml-1">
                              <span className="text-[11px] font-semibold text-gray-600">{msg.sender.fullName}</span>
                              <span className="text-[10px] text-gray-400">{format(msgDate, 'HH:mm')}</span>
                              {msg.editedAt && <span className="text-[10px] text-gray-400 italic">edited</span>}
                            </div>
                          )}

                          {/* Reply quote */}
                          {msg.replyTo && (
                            <button
                              onClick={() => msg.replyToId && scrollToMessage(msg.replyToId)}
                              className="ml-1 mb-1 px-2.5 py-1.5 rounded-lg bg-gray-100 border-l-2 border-gray-300 text-left block max-w-full"
                            >
                              <p className="text-[10px] font-semibold text-gray-500">{msg.replyTo.senderName}</p>
                              <p className="text-[11px] text-gray-400 truncate">{msg.replyTo.content}</p>
                            </button>
                          )}

                          {editingId === msg.id ? (
                            <EditInline
                              content={editContent}
                              onChange={setEditContent}
                              onSave={() => handleSaveEdit(msg.id)}
                              onCancel={() => { setEditingId(null); setEditContent('') }}
                              saving={editSaving}
                              colour={groupColour}
                            />
                          ) : (
                            <div className="relative">
                              <div className="bg-white rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm border border-gray-100">
                                {msg.imageUrl && (
                                  <button onClick={() => setLightboxUrl(msg.imageUrl)} className="block mb-1.5">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={msg.imageUrl} alt="" className="rounded-lg max-h-60 object-cover" />
                                  </button>
                                )}
                                {msg.content && msg.content !== '📷' && (
                                  <p className="text-sm text-gray-800 leading-relaxed break-words whitespace-pre-wrap">
                                    {renderContent(msg.content, memberNames, groupColour)}
                                  </p>
                                )}
                              </div>
                              {/* Hover actions (desktop) */}
                              <div className="hidden group-hover/msg:flex absolute -top-3 right-0 bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
                                <ActionButtons
                                  msg={msg}
                                  isOwn={false}
                                  isAdmin={isAdmin}
                                  onReact={(id) => setEmojiPickerId(id)}
                                  onReply={() => handleReply(msg)}
                                  onEdit={() => handleStartEdit(msg)}
                                  onDelete={() => handleDelete(msg.id)}
                                  onPin={() => handlePin(msg.id, msg.isPinned)}
                                />
                              </div>
                            </div>
                          )}

                          {/* Reactions */}
                          {msg.reactions.length > 0 && (
                            <ReactionBar reactions={msg.reactions} onToggle={(emoji, reacted) => handleReaction(msg.id, emoji, reacted)} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Own messages */}
                    {isOwn && (
                      <div className="max-w-[80%] min-w-0">
                        {showMeta && (
                          <div className="flex items-baseline justify-end gap-2 mb-0.5 mr-1">
                            <span className="text-[10px] text-gray-400">{format(msgDate, 'HH:mm')}</span>
                            {msg.editedAt && <span className="text-[10px] text-gray-400 italic">edited</span>}
                          </div>
                        )}

                        {msg.replyTo && (
                          <button
                            onClick={() => msg.replyToId && scrollToMessage(msg.replyToId)}
                            className="ml-auto mr-1 mb-1 px-2.5 py-1.5 rounded-lg bg-white/20 border-l-2 border-white/40 text-left block max-w-full"
                          >
                            <p className="text-[10px] font-semibold text-white/70">{msg.replyTo.senderName}</p>
                            <p className="text-[11px] text-white/50 truncate">{msg.replyTo.content}</p>
                          </button>
                        )}

                        {editingId === msg.id ? (
                          <EditInline
                            content={editContent}
                            onChange={setEditContent}
                            onSave={() => handleSaveEdit(msg.id)}
                            onCancel={() => { setEditingId(null); setEditContent('') }}
                            saving={editSaving}
                            colour={groupColour}
                          />
                        ) : (
                          <div className="relative">
                            <div className="rounded-2xl rounded-br-md px-3.5 py-2" style={{ backgroundColor: groupColour }}>
                              {msg.imageUrl && (
                                <button onClick={() => setLightboxUrl(msg.imageUrl)} className="block mb-1.5">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={msg.imageUrl} alt="" className="rounded-lg max-h-60 object-cover" />
                                </button>
                              )}
                              {msg.content && msg.content !== '📷' && (
                                <p className="text-sm text-white leading-relaxed break-words whitespace-pre-wrap">
                                  {msg.content}
                                </p>
                              )}
                            </div>
                            <div className="hidden group-hover/msg:flex absolute -top-3 left-0 bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
                              <ActionButtons
                                msg={msg}
                                isOwn={true}
                                isAdmin={isAdmin}
                                onReact={(id) => setEmojiPickerId(id)}
                                onReply={() => handleReply(msg)}
                                onEdit={() => handleStartEdit(msg)}
                                onDelete={() => handleDelete(msg.id)}
                                onPin={() => handlePin(msg.id, msg.isPinned)}
                              />
                            </div>
                          </div>
                        )}

                        {msg.reactions.length > 0 && (
                          <div className="flex justify-end">
                            <ReactionBar reactions={msg.reactions} onToggle={(emoji, reacted) => handleReaction(msg.id, emoji, reacted)} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Emoji picker (shared) */}
                {emojiPickerId === msg.id && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setEmojiPickerId(null)} />
                    <div className={`flex gap-1 p-2 bg-white rounded-xl shadow-lg border border-gray-100 z-30 w-fit ${isOwn ? 'ml-auto mr-2' : 'ml-11'} -mt-1`}>
                      {QUICK_EMOJIS.map((emoji) => {
                        const existing = msg.reactions.find((r) => r.emoji === emoji)
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji, existing?.reacted ?? false)}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg hover:bg-gray-100 transition-colors ${existing?.reacted ? 'bg-blue-50' : ''}`}
                          >
                            {emoji}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* Mobile action sheet */}
                {activeMenuId === msg.id && (
                  <>
                    <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setActiveMenuId(null)} />
                    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl p-4 space-y-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
                      {/* Quick reactions */}
                      <div className="flex gap-2 justify-center mb-3">
                        {QUICK_EMOJIS.map((emoji) => {
                          const existing = msg.reactions.find((r) => r.emoji === emoji)
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(msg.id, emoji, existing?.reacted ?? false)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-xl hover:bg-gray-100 ${existing?.reacted ? 'bg-blue-50' : 'bg-gray-50'}`}
                            >
                              {emoji}
                            </button>
                          )
                        })}
                      </div>
                      <button onClick={() => handleReply(msg)} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Reply</button>
                      {isOwn && <button onClick={() => handleStartEdit(msg)} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</button>}
                      {(isOwn || isAdmin) && <button onClick={() => handleDelete(msg.id)} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50">Delete</button>}
                      {isAdmin && <button onClick={() => handlePin(msg.id, msg.isPinned)} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">{msg.isPinned ? 'Unpin' : 'Pin'}</button>}
                      {isAdmin && !isOwn && <button onClick={() => handleMuteOpen(msg)} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-orange-600 hover:bg-orange-50">Mute member</button>}
                      <button onClick={() => setActiveMenuId(null)} className="w-full text-center px-4 py-3 rounded-xl text-sm font-bold text-gray-400">Cancel</button>
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Typing indicator ────────────────────────────────────────── */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1.5 text-xs text-gray-400 italic bg-gray-50 border-t border-gray-100">
          {typingUsers.length === 1
            ? `${typingUsers[0]} is typing...`
            : `${typingUsers.join(' and ')} are typing...`}
        </div>
      )}

      {/* ── Reply preview ───────────────────────────────────────────── */}
      {replyTo && (
        <div className="px-4 py-2 bg-white border-t border-gray-100 flex items-center gap-2">
          <div className="flex-1 min-w-0 pl-2 border-l-2" style={{ borderColor: groupColour }}>
            <p className="text-[11px] font-semibold" style={{ color: groupColour }}>{replyTo.sender.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Image preview ───────────────────────────────────────────── */}
      {imageUrl && (
        <div className="px-4 py-2 bg-white border-t border-gray-100 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-16 rounded-lg object-cover" />
          <button
            onClick={() => { setImageUrl(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-500"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── @mentions dropdown ──────────────────────────────────────── */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="px-4 py-2 bg-white border-t border-gray-100 space-y-0.5 max-h-48 overflow-y-auto">
          {filteredMembers.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => insertMention(m)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                idx === mentionIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                  style={{ backgroundColor: groupColour }}
                >
                  {initials(m.fullName)}
                </div>
              )}
              <span className="text-sm font-medium text-gray-700">{m.fullName}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Compose bar / Muted banner ────────────────────────────── */}
      {mutedUntil && new Date(mutedUntil) > new Date() ? (
        <div className="bg-orange-50 border-t border-orange-100 px-4 py-3 text-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <p className="text-sm text-orange-700 font-medium">
            You are muted{mutedUntil !== '9999-12-31T23:59:59Z' && mutedUntil !== '9999-12-31T23:59:59.000Z'
              ? ` until ${format(new Date(mutedUntil), 'd MMM, HH:mm')}`
              : ''}
          </p>
          <p className="text-xs text-orange-500 mt-0.5">Contact an admin for help.</p>
        </div>
      ) : (
        <div className="bg-white border-t border-gray-100 px-3 py-2 flex items-end gap-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
          {/* Image upload */}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={imageUploading}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          >
            {imageUploading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
              </svg>
            )}
          </button>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${groupName}...`}
            rows={1}
            className="flex-1 px-3.5 py-2 rounded-2xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition resize-none"
            style={{ '--tw-ring-color': groupColour, maxHeight: '120px', minHeight: '38px' } as React.CSSProperties}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 120) + 'px'
            }}
          />

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={(!body.trim() && !imageUrl) || sending}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-90 disabled:opacity-30"
            style={{ backgroundColor: groupColour }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Mute duration modal ───────────────────────────────────── */}
      {muteTarget && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setMuteTarget(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl p-5 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-gray-900 mb-1">Mute {muteTarget.fullName}</h3>
            <p className="text-xs text-gray-500 mb-4">They won&apos;t be able to send messages in this group&apos;s chats.</p>
            <div className="space-y-2">
              {([['1h', '1 hour'], ['24h', '24 hours'], ['7d', '7 days'], ['permanent', 'Permanently']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleMute(key)}
                  disabled={muteLoading}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-100 disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMuteTarget(null)}
              className="w-full text-center mt-3 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── Lightbox ────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white" style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionButtons({
  msg,
  isOwn,
  isAdmin,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onPin,
}: {
  msg: ChatMessage
  isOwn: boolean
  isAdmin: boolean
  onReact: (id: string) => void
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
  onPin: () => void
}) {
  const btnClass = 'w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors'

  return (
    <>
      <button onClick={() => onReact(msg.id)} className={btnClass} title="React">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
        </svg>
      </button>
      <button onClick={onReply} className={btnClass} title="Reply">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
        </svg>
      </button>
      {isOwn && (
        <button onClick={onEdit} className={btnClass} title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
          </svg>
        </button>
      )}
      {(isOwn || isAdmin) && (
        <button onClick={onDelete} className={`${btnClass} hover:text-red-500`} title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      )}
      {isAdmin && (
        <button onClick={onPin} className={btnClass} title={msg.isPinned ? 'Unpin' : 'Pin'}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
        </button>
      )}
    </>
  )
}

function ReactionBar({
  reactions,
  onToggle,
}: {
  reactions: ReactionGroup[]
  onToggle: (emoji: string, reacted: boolean) => void
}) {
  return (
    <div className="flex gap-1 mt-1 flex-wrap">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji, r.reacted)}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-colors ${
            r.reacted
              ? 'bg-blue-50 border border-blue-200 text-blue-700'
              : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span>{r.emoji}</span>
          <span className="font-semibold">{r.count}</span>
        </button>
      ))}
    </div>
  )
}

function EditInline({
  content,
  onChange,
  onSave,
  onCancel,
  saving,
  colour,
}: {
  content: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  colour: string
}) {
  return (
    <div className="space-y-1.5">
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value.slice(0, 2000))}
        rows={2}
        className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent resize-none"
        style={{ '--tw-ring-color': colour } as React.CSSProperties}
        autoFocus
      />
      <div className="flex gap-1.5">
        <button
          onClick={onSave}
          disabled={saving || !content.trim()}
          className="px-2.5 py-1 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: colour }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </div>
  )
}
