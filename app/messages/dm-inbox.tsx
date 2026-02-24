'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

interface Conversation {
  channelId: string
  otherUser: { id: string; fullName: string; avatarUrl: string | null }
  lastMessage: { content: string; senderId: string; createdAt: string } | null
  hasUnread: boolean
}

interface Props {
  conversations: Conversation[]
  currentUserId: string
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

const TEAL = '#0D7377'

export default function DMInbox({ conversations: initial, currentUserId }: Props) {
  const [conversations, setConversations] = useState(initial)

  // Real-time: listen for new messages on DM channels to update previews
  useEffect(() => {
    if (conversations.length === 0) return
    const supabase = createClient()
    const channelIds = conversations.map((c) => c.channelId)

    const channels = channelIds.map((cid) =>
      supabase
        .channel(`dm-inbox-${cid}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${cid}`,
          },
          (payload) => {
            const row = payload.new as {
              channel_id: string
              sender_id: string
              content: string
              content_type: string
              created_at: string
            }

            setConversations((prev) => {
              const updated = prev.map((c) => {
                if (c.channelId !== row.channel_id) return c
                return {
                  ...c,
                  lastMessage: {
                    content: row.content_type === 'image' ? '📷 Photo' : row.content,
                    senderId: row.sender_id,
                    createdAt: row.created_at,
                  },
                  hasUnread: row.sender_id !== currentUserId,
                }
              })

              // Re-sort by latest
              return updated.sort((a, b) => {
                const aTime = a.lastMessage?.createdAt ?? '1970-01-01'
                const bTime = b.lastMessage?.createdAt ?? '1970-01-01'
                return new Date(bTime).getTime() - new Date(aTime).getTime()
              })
            })
          }
        )
        .subscribe()
    )

    return () => {
      for (const ch of channels) {
        supabase.removeChannel(ch)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 h-14">
          <h1 className="text-lg font-bold text-gray-900">Messages</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">No messages yet</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Start a conversation by tapping the message icon on a member&apos;s profile in any of your groups.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map((c) => (
              <Link
                key={c.channelId}
                href={`/messages/${c.channelId}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                {/* Avatar */}
                {c.otherUser.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.otherUser.avatarUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: TEAL }}
                  >
                    {initials(c.otherUser.fullName)}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${c.hasUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                      {c.otherUser.fullName}
                    </p>
                    {c.lastMessage && (
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {formatDistanceToNow(new Date(c.lastMessage.createdAt), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  {c.lastMessage && (
                    <p className={`text-xs truncate mt-0.5 ${c.hasUnread ? 'font-medium text-gray-700' : 'text-gray-400'}`}>
                      {c.lastMessage.senderId === currentUserId ? 'You: ' : ''}
                      {c.lastMessage.content.slice(0, 60)}
                    </p>
                  )}
                </div>

                {/* Unread dot */}
                {c.hasUnread && (
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TEAL }} />
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
