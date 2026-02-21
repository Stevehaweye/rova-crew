'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
}

interface Message {
  id: string
  userId: string
  body: string
  createdAt: string
  profile: { full_name: string; avatar_url: string | null }
}

interface Props {
  eventId: string
  currentUser: Profile | null
  isRsvped: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventChat({ eventId, currentUser, isRsvped }: Props) {
  const TEAL = '#0D7377'

  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  // ── Scroll helpers ────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const threshold = 60
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }

  // Auto-scroll when new messages arrive (only if user is at bottom)
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

  // ── Initial fetch ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isRsvped) return

    const supabase = createClient()

    async function fetchMessages() {
      const { data } = await supabase
        .from('event_messages')
        .select('id, user_id, body, created_at, profiles ( full_name, avatar_url )')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
        .limit(50)

      const msgs: Message[] = (data ?? []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        body: m.body,
        createdAt: m.created_at,
        profile: m.profiles as unknown as { full_name: string; avatar_url: string | null },
      }))

      setMessages(msgs)
      setLoading(false)

      // Scroll to bottom on initial load
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
        isAtBottomRef.current = true
      })
    }

    fetchMessages()
  }, [eventId, isRsvped])

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isRsvped) return

    const supabase = createClient()

    const channel = supabase
      .channel(`event-chat-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_messages',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string
            user_id: string
            body: string
            created_at: string
          }

          // Fetch the profile for this message author
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', row.user_id)
            .maybeSingle()

          const msg: Message = {
            id: row.id,
            userId: row.user_id,
            body: row.body,
            createdAt: row.created_at,
            profile: profile ?? { full_name: 'Member', avatar_url: null },
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, isRsvped])

  // ── Send message ──────────────────────────────────────────────────────────

  async function handleSend() {
    if (!body.trim() || !currentUser || sending) return
    const text = body.trim()
    setBody('')
    setSending(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('event_messages')
      .insert({ event_id: eventId, user_id: currentUser.id, body: text })

    if (error) {
      // Restore text if send failed
      setBody(text)
      console.error('[EventChat] send error:', error)
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Locked state (not RSVPed) ─────────────────────────────────────────────

  if (!isRsvped) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>💬</span> Join the event chat
          </h3>
        </div>
        <div className="px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400">
            <LockIcon />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            RSVP to join the conversation
          </p>
          <p className="text-xs text-gray-400 mb-5">
            Chat with other attendees, share plans, and coordinate.
          </p>
          <a
            href="#rsvp"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: TEAL }}
          >
            I&apos;m Going &rarr;
          </a>
        </div>
      </div>
    )
  }

  // ── Chat UI (RSVPed) ──────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span>💬</span> Event Chat
          {messages.length > 0 && (
            <span className="text-gray-400 font-normal">({messages.length})</span>
          )}
        </h3>
      </div>

      {/* Messages container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[300px] sm:h-[400px] overflow-y-auto px-4 py-3 space-y-1 bg-gray-50/50"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner className="w-5 h-5 text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-2xl mb-2 select-none">👋</p>
            <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isOwn = currentUser?.id === msg.userId
              const showMeta = i === 0 || messages[i - 1].userId !== msg.userId

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showMeta ? 'mt-3' : 'mt-0.5'} animate-[slideUp_0.2s_ease-out]`}
                >
                  {/* Others: avatar + bubble */}
                  {!isOwn && (
                    <div className="flex items-end gap-2 max-w-[80%]">
                      {/* Avatar — only show on first message in group */}
                      {showMeta ? (
                        msg.profile?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={msg.profile.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                            style={{ backgroundColor: TEAL }}
                          >
                            {initials(msg.profile?.full_name ?? 'M')}
                          </div>
                        )
                      ) : (
                        <div className="w-6 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        {showMeta && (
                          <div className="flex items-baseline gap-2 mb-0.5 ml-1">
                            <span className="text-[11px] font-semibold text-gray-600">
                              {msg.profile?.full_name ?? 'Member'}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                        <div className="bg-white rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm border border-gray-100">
                          <p className="text-sm text-gray-800 leading-relaxed break-words whitespace-pre-wrap">
                            {msg.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Own: bubble only, right-aligned */}
                  {isOwn && (
                    <div className="max-w-[80%] min-w-0">
                      {showMeta && (
                        <div className="flex items-baseline justify-end gap-2 mb-0.5 mr-1">
                          <span className="text-[10px] text-gray-400">
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      )}
                      <div
                        className="rounded-2xl rounded-br-md px-3.5 py-2"
                        style={{ backgroundColor: TEAL }}
                      >
                        <p className="text-sm text-white leading-relaxed break-words whitespace-pre-wrap">
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-100 px-4 py-3 bg-white">
        {currentUser ? (
          <>
            <div className="flex items-end gap-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 500))}
                onKeyDown={handleKeyDown}
                placeholder="Message the group..."
                rows={1}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition resize-none"
                style={
                  {
                    '--tw-ring-color': TEAL,
                    maxHeight: '120px',
                    minHeight: '42px',
                  } as React.CSSProperties
                }
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!body.trim() || sending}
                className="p-2.5 rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-40 flex-shrink-0"
                style={{ backgroundColor: TEAL }}
              >
                {sending ? <Spinner /> : <SendIcon />}
              </button>
            </div>
            {body.length > 0 && (
              <p
                className={`text-[10px] mt-1 text-right ${body.length > 450 ? 'text-amber-500' : 'text-gray-400'}`}
              >
                {body.length}/500
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-1">
            Sign in to join the conversation
          </p>
        )}
      </div>

      {/* Slide-up animation keyframes */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
