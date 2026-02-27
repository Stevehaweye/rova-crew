import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push-sender'
import { awardSpiritPoints } from '@/lib/spirit-points'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const supabase = await createClient()

    // Auth check
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

    // Fetch event to verify it exists and check archive status
    const { data: event } = await serviceClient
      .from('events')
      .select('id, title, ends_at, group_id')
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check archive status (7 days after event ends)
    const endsAt = new Date(event.ends_at)
    const archiveDate = new Date(endsAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    if (new Date() >= archiveDate) {
      return NextResponse.json({ error: 'This chat is archived' }, { status: 403 })
    }

    // Verify RSVP (must be going or maybe)
    const { data: rsvp } = await serviceClient
      .from('rsvps')
      .select('status')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!rsvp || (rsvp.status !== 'going' && rsvp.status !== 'maybe')) {
      return NextResponse.json({ error: 'Must RSVP to send messages' }, { status: 403 })
    }

    // Mute check (admins are exempt)
    const { data: gmembership } = await serviceClient
      .from('group_members')
      .select('role, muted_until')
      .eq('group_id', event.group_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (gmembership?.role === 'member' && gmembership?.muted_until && new Date(gmembership.muted_until) > new Date()) {
      return NextResponse.json(
        { error: 'You are muted', mutedUntil: gmembership.muted_until },
        { status: 403 }
      )
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
      console.error('[event-chat] insert error:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Award spirit points for event chat post (fire-and-forget)
    awardSpiritPoints('event_chat_post', user.id, event.group_id).catch(() => {})

    // Push notification: send to RSVPd users whose last_read_at is >30 min ago
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    // Fetch channel_members with stale last_read_at
    const { data: staleMembers } = await serviceClient
      .from('channel_members')
      .select('user_id')
      .eq('channel_id', channelId)
      .lt('last_read_at', thirtyMinAgo)

    if (staleMembers && staleMembers.length > 0) {
      // Fetch sender name
      const { data: senderProfile } = await serviceClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const senderName = senderProfile?.full_name ?? 'Someone'

      for (const member of staleMembers) {
        if (member.user_id === user.id) continue

        sendPushToUser(member.user_id, {
          title: `${event.title} chat`,
          body: `${senderName}: ${content.trim().slice(0, 80)}`,
          url: `/events/${eventId}`,
        }, 'event_chat').catch((err) => console.error('[event-chat] push error:', err))
      }
    }

    return NextResponse.json({ success: true, messageId: message.id })
  } catch (err) {
    console.error('[event-chat] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
