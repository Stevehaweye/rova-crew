import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToGroup } from '@/lib/push-sender'

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
    const { groupId, channelId, content, imageUrl, sendPush } = body as {
      groupId: string
      channelId: string
      content: string
      imageUrl?: string
      sendPush?: boolean
    }

    if (!groupId || !channelId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Content too long' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Verify user is admin of this group
    const { data: membership } = await serviceClient
      .from('group_members')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
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
      })
      .select('id')
      .single()

    if (error) {
      console.error('[announcements] insert error:', error)
      return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
    }

    // Send push notification to group members
    if (sendPush) {
      const { data: group } = await serviceClient
        .from('groups')
        .select('name, slug')
        .eq('id', groupId)
        .single()

      if (group) {
        sendPushToGroup(
          groupId,
          {
            title: `${group.name}`,
            body: content.trim().slice(0, 100),
            url: `/g/${group.slug}/announcements`,
          },
          user.id,
          'announcement'
        ).catch((err) => console.error('[announcements] push error:', err))
      }
    }

    return NextResponse.json({ success: true, messageId: message.id })
  } catch (err) {
    console.error('[announcements] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
