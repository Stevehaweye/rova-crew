import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import GroupChat from '@/components/GroupChat'
import type { ChatMessage, ChatMember, ReactionGroup } from '@/components/GroupChat'

export default async function GroupChatPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/g/${slug}/chat`)

  // Group fetch
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()
  if (!group) redirect('/home')

  // Membership check (must be approved)
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.status !== 'approved') {
    redirect(`/g/${slug}`)
  }

  const isAdmin = membership.role === 'super_admin' || membership.role === 'co_admin'

  const serviceClient = createServiceClient()

  // Fetch (or create) group_chat channel
  let { data: channel } = await serviceClient
    .from('channels')
    .select('id')
    .eq('group_id', group.id)
    .eq('type', 'group_chat')
    .maybeSingle()

  if (!channel) {
    const { data: created } = await serviceClient
      .from('channels')
      .insert({ group_id: group.id, type: 'group_chat', name: 'Group Chat' })
      .select('id')
      .single()
    channel = created
  }

  if (!channel) redirect(`/g/${slug}`)

  // Update last_read_at
  await serviceClient.from('channel_members').upsert(
    {
      channel_id: channel.id,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'channel_id,user_id' }
  )

  // Fetch last 50 messages
  const { data: messages } = await serviceClient
    .from('messages')
    .select('id, sender_id, content, content_type, image_url, is_pinned, edited_at, deleted_at, reply_to_id, created_at, profiles:sender_id ( full_name, avatar_url )')
    .eq('channel_id', channel.id)
    .order('created_at', { ascending: true })
    .limit(50)

  // Collect reply_to_ids to fetch in one query
  const replyToIds = (messages ?? [])
    .map((m) => m.reply_to_id)
    .filter((id): id is string => !!id)
  const uniqueReplyIds = [...new Set(replyToIds)]

  let replyMap: Record<string, { content: string; senderName: string }> = {}
  if (uniqueReplyIds.length > 0) {
    const { data: replyMessages } = await serviceClient
      .from('messages')
      .select('id, content, profiles:sender_id ( full_name )')
      .in('id', uniqueReplyIds)

    for (const rm of replyMessages ?? []) {
      const rp = rm.profiles as unknown as { full_name: string }
      replyMap[rm.id] = {
        content: rm.content,
        senderName: rp?.full_name ?? 'Member',
      }
    }
  }

  // Fetch reactions
  const messageIds = (messages ?? []).map((m) => m.id)
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
  const initialMessages: ChatMessage[] = (messages ?? []).map((m) => {
    const profile = m.profiles as unknown as { full_name: string; avatar_url: string | null } | null
    return {
      id: m.id,
      content: m.content,
      contentType: m.content_type,
      imageUrl: m.image_url,
      isPinned: m.is_pinned,
      editedAt: m.edited_at,
      deletedAt: m.deleted_at,
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

  // Fetch group members for @mentions
  const { data: memberRows } = await serviceClient
    .from('group_members')
    .select('user_id, profiles:user_id ( full_name, avatar_url )')
    .eq('group_id', group.id)
    .eq('status', 'approved')

  const chatMembers: ChatMember[] = (memberRows ?? []).map((m) => {
    const p = m.profiles as unknown as { full_name: string; avatar_url: string | null }
    return {
      id: m.user_id,
      fullName: p?.full_name ?? 'Member',
      avatarUrl: p?.avatar_url ?? null,
    }
  })

  const colour = group.primary_colour.startsWith('#') ? group.primary_colour : `#${group.primary_colour}`

  return (
    <GroupChat
      channelId={channel.id}
      groupId={group.id}
      groupSlug={group.slug}
      groupName={group.name}
      groupColour={colour}
      currentUserId={user.id}
      isAdmin={isAdmin}
      initialMessages={initialMessages}
      members={chatMembers}
    />
  )
}
