import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import DMChat from '@/components/DMChat'
import type { ChatMessage, ReactionGroup } from '@/components/GroupChat'

export default async function DMChatPage({
  params,
}: {
  params: Promise<{ channelId: string }>
}) {
  const { channelId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/messages/${channelId}`)

  const serviceClient = createServiceClient()

  // Verify user is a member of this DM channel
  const { data: channel } = await serviceClient
    .from('channels')
    .select('id, type')
    .eq('id', channelId)
    .eq('type', 'dm')
    .maybeSingle()

  if (!channel) redirect('/messages')

  const { data: membership } = await serviceClient
    .from('channel_members')
    .select('user_id')
    .eq('channel_id', channelId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/messages')

  // Get the other user
  const { data: otherMember } = await serviceClient
    .from('channel_members')
    .select('user_id, profiles:user_id ( full_name, avatar_url )')
    .eq('channel_id', channelId)
    .neq('user_id', user.id)
    .maybeSingle()

  if (!otherMember) redirect('/messages')

  const otherProfile = otherMember.profiles as unknown as { full_name: string; avatar_url: string | null }

  // Fetch last 50 messages with profiles + reactions + reply-to
  const { data: chatMessages } = await serviceClient
    .from('messages')
    .select('id, sender_id, content, content_type, image_url, is_pinned, edited_at, deleted_at, deleted_by, reply_to_id, created_at, profiles:sender_id ( full_name, avatar_url )')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(50)

  // Reply-to lookup
  const replyToIds = (chatMessages ?? [])
    .map((m) => m.reply_to_id)
    .filter((id): id is string => !!id)
  const uniqueReplyIds = [...new Set(replyToIds)]

  let replyMap: Record<string, { content: string; senderName: string }> = {}
  if (uniqueReplyIds.length > 0) {
    const { data: replyMsgs } = await serviceClient
      .from('messages')
      .select('id, content, profiles:sender_id ( full_name )')
      .in('id', uniqueReplyIds)

    for (const rm of replyMsgs ?? []) {
      const rp = rm.profiles as unknown as { full_name: string }
      replyMap[rm.id] = {
        content: rm.content,
        senderName: rp?.full_name ?? 'Member',
      }
    }
  }

  // Reactions
  const messageIds = (chatMessages ?? []).map((m) => m.id)
  const { data: reactions } = messageIds.length > 0
    ? await serviceClient
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', messageIds)
    : { data: [] }

  const reactionsByMessage: Record<string, ReactionGroup[]> = {}
  for (const r of reactions ?? []) {
    if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = []
    const grp = reactionsByMessage[r.message_id].find((g) => g.emoji === r.emoji)
    if (grp) {
      grp.count++
      if (r.user_id === user.id) grp.reacted = true
    } else {
      reactionsByMessage[r.message_id].push({
        emoji: r.emoji,
        count: 1,
        reacted: r.user_id === user.id,
      })
    }
  }

  // Build initial messages
  const initialMessages: ChatMessage[] = (chatMessages ?? []).map((m) => {
    const profile = m.profiles as unknown as { full_name: string; avatar_url: string | null } | null
    return {
      id: m.id,
      content: m.content,
      contentType: m.content_type,
      imageUrl: m.image_url,
      isPinned: m.is_pinned,
      editedAt: m.edited_at,
      deletedAt: m.deleted_at,
      deletedBy: m.deleted_by,
      createdAt: m.created_at,
      replyToId: m.reply_to_id,
      replyTo: m.reply_to_id ? replyMap[m.reply_to_id] ?? null : null,
      sender: {
        id: m.sender_id,
        fullName: profile?.full_name ?? 'Member',
        avatarUrl: profile?.avatar_url ?? null,
      },
      reactions: reactionsByMessage[m.id] ?? [],
    }
  })

  // Upsert last_read_at
  await serviceClient.from('channel_members').upsert(
    {
      channel_id: channelId,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'channel_id,user_id' }
  )

  return (
    <DMChat
      channelId={channelId}
      otherUser={{
        id: otherMember.user_id,
        fullName: otherProfile?.full_name ?? 'Member',
        avatarUrl: otherProfile?.avatar_url ?? null,
      }}
      currentUserId={user.id}
      initialMessages={initialMessages}
    />
  )
}
