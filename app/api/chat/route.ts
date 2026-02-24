import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push-sender'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { channelId, groupId, content, imageUrl, replyToId } = body as {
      channelId: string
      groupId: string
      content: string
      imageUrl?: string
      replyToId?: string
    }

    if (!channelId || !groupId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Verify approved member
    const { data: membership } = await serviceClient
      .from('group_members')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership?.status !== 'approved') {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    // Mute check (admins are exempt)
    if (membership.role === 'member') {
      const { data: memberRow } = await serviceClient
        .from('group_members')
        .select('muted_until')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (memberRow?.muted_until && new Date(memberRow.muted_until) > new Date()) {
        return NextResponse.json(
          { error: 'You are muted', mutedUntil: memberRow.muted_until },
          { status: 403 }
        )
      }
    }

    // Insert message
    const { data: message, error } = await serviceClient
      .from('messages')
      .insert({
        channel_id: channelId,
        sender_id: user.id,
        content: content.trim(),
        content_type: imageUrl ? 'image' : 'text',
        image_url: imageUrl || null,
        reply_to_id: replyToId || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[chat] insert error:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Smart push: only for @mentions
    const mentionPattern = /@([\w\s]+?)(?=\s@|$|\s[^@])/g
    const mentions = [...content.matchAll(mentionPattern)].map((m) => m[1].trim())

    if (mentions.length > 0) {
      // Fetch group info
      const { data: group } = await serviceClient
        .from('groups')
        .select('name, slug')
        .eq('id', groupId)
        .single()

      // Fetch sender profile
      const { data: senderProfile } = await serviceClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // Fetch all approved members to match mentions
      const { data: members } = await serviceClient
        .from('group_members')
        .select('user_id, profiles ( full_name )')
        .eq('group_id', groupId)
        .eq('status', 'approved')

      if (group && senderProfile && members) {
        const senderName = senderProfile.full_name ?? 'Someone'

        for (const member of members) {
          const memberName = (member.profiles as unknown as { full_name: string })?.full_name
          if (!memberName || member.user_id === user.id) continue

          // Check if this member was mentioned
          const isMentioned = mentions.some(
            (m) => memberName.toLowerCase().startsWith(m.toLowerCase())
          )

          if (isMentioned) {
            sendPushToUser(member.user_id, {
              title: group.name,
              body: `${senderName}: ${content.trim().slice(0, 80)}`,
              url: `/g/${group.slug}/chat`,
            }).catch((err) => console.error('[chat] push error:', err))
          }
        }
      }
    }

    return NextResponse.json({ success: true, messageId: message.id })
  } catch (err) {
    console.error('[chat] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
