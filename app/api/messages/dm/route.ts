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
    const { channelId, content, imageUrl, replyToId } = body as {
      channelId: string
      content: string
      imageUrl?: string
      replyToId?: string
    }

    if (!channelId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Verify user is in this DM channel
    const { data: channel } = await serviceClient
      .from('channels')
      .select('id, type')
      .eq('id', channelId)
      .eq('type', 'dm')
      .maybeSingle()

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const { data: membership } = await serviceClient
      .from('channel_members')
      .select('user_id')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })
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
      console.error('[dm] insert error:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Push notification: always push immediately for DMs
    const { data: otherMember } = await serviceClient
      .from('channel_members')
      .select('user_id')
      .eq('channel_id', channelId)
      .neq('user_id', user.id)
      .maybeSingle()

    if (otherMember) {
      const { data: senderProfile } = await serviceClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const senderName = senderProfile?.full_name ?? 'Someone'

      sendPushToUser(otherMember.user_id, {
        title: senderName,
        body: content.trim().slice(0, 80),
        url: `/messages/${channelId}`,
      }, 'dm').catch((err) => console.error('[dm] push error:', err))
    }

    return NextResponse.json({ success: true, messageId: message.id })
  } catch (err) {
    console.error('[dm] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
