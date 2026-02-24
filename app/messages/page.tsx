import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import DMInbox from './dm-inbox'

export default async function MessagesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth?next=/messages')

  const serviceClient = createServiceClient()

  // 1. Get user's DM channel memberships
  const { data: myChannelMemberships } = await serviceClient
    .from('channel_members')
    .select('channel_id, last_read_at, channels!inner ( id, type )')
    .eq('user_id', user.id)

  const dmMemberships = (myChannelMemberships ?? []).filter(
    (cm) => (cm.channels as unknown as { type: string })?.type === 'dm'
  )

  if (dmMemberships.length === 0) {
    return (
      <DMInbox
        conversations={[]}
        currentUserId={user.id}
      />
    )
  }

  const dmChannelIds = dmMemberships.map((cm) => cm.channel_id)

  // 2. Get the other member for each DM channel
  const { data: otherMembers } = await serviceClient
    .from('channel_members')
    .select('channel_id, user_id, profiles:user_id ( full_name, avatar_url )')
    .in('channel_id', dmChannelIds)
    .neq('user_id', user.id)

  const otherMemberByChannel: Record<string, { id: string; fullName: string; avatarUrl: string | null }> = {}
  for (const om of otherMembers ?? []) {
    const p = om.profiles as unknown as { full_name: string; avatar_url: string | null }
    otherMemberByChannel[om.channel_id] = {
      id: om.user_id,
      fullName: p?.full_name ?? 'Member',
      avatarUrl: p?.avatar_url ?? null,
    }
  }

  // 3. Get latest message per DM channel
  // Fetch recent messages for all DM channels, then pick the latest per channel
  const { data: recentMessages } = await serviceClient
    .from('messages')
    .select('id, channel_id, sender_id, content, content_type, created_at')
    .in('channel_id', dmChannelIds)
    .order('created_at', { ascending: false })
    .limit(dmChannelIds.length * 2)

  const latestByChannel: Record<string, { content: string; contentType: string; senderId: string; createdAt: string }> = {}
  for (const msg of recentMessages ?? []) {
    if (!latestByChannel[msg.channel_id]) {
      latestByChannel[msg.channel_id] = {
        content: msg.content,
        contentType: msg.content_type,
        senderId: msg.sender_id,
        createdAt: msg.created_at,
      }
    }
  }

  // 4. Build conversation list
  const lastReadMap: Record<string, string> = {}
  for (const cm of dmMemberships) {
    lastReadMap[cm.channel_id] = cm.last_read_at
  }

  const conversations = dmChannelIds
    .map((channelId) => {
      const other = otherMemberByChannel[channelId]
      const latest = latestByChannel[channelId]
      if (!other) return null

      const lastReadAt = lastReadMap[channelId]
      const hasUnread = latest && lastReadAt ? new Date(latest.createdAt) > new Date(lastReadAt) : false

      return {
        channelId,
        otherUser: other,
        lastMessage: latest
          ? {
              content: latest.contentType === 'image' ? '📷 Photo' : latest.content,
              senderId: latest.senderId,
              createdAt: latest.createdAt,
            }
          : null,
        hasUnread,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? '1970-01-01'
      const bTime = b.lastMessage?.createdAt ?? '1970-01-01'
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

  return (
    <DMInbox
      conversations={conversations}
      currentUserId={user.id}
    />
  )
}
