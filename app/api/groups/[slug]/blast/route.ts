import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToGroup } from '@/lib/push-sender'
import { sendBlastEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    // Fetch group
    const { data: group } = await serviceClient
      .from('groups')
      .select('id, name, slug')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Admin check
    const { data: membership } = await serviceClient
      .from('group_members')
      .select('role, status')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    // Parse body
    const body = await request.json()
    const { title, blastBody } = body as { title?: string; blastBody?: string }

    if (!title?.trim() || title.length > 60) {
      return NextResponse.json({ error: 'Title is required (max 60 chars)' }, { status: 400 })
    }

    if (!blastBody?.trim() || blastBody.length > 300) {
      return NextResponse.json({ error: 'Body is required (max 300 chars)' }, { status: 400 })
    }

    // Rate limit: 1 blast per group per 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentBlast } = await serviceClient
      .from('message_blasts')
      .select('id, sent_at')
      .eq('group_id', group.id)
      .gte('sent_at', twentyFourHoursAgo)
      .limit(1)
      .maybeSingle()

    if (recentBlast) {
      return NextResponse.json(
        { error: 'Rate limited — only 1 blast per 24 hours', lastBlastAt: recentBlast.sent_at },
        { status: 429 }
      )
    }

    // Fetch approved members with emails
    const { data: memberRows } = await serviceClient
      .from('group_members')
      .select('user_id, profiles:user_id ( full_name, email )')
      .eq('group_id', group.id)
      .eq('status', 'approved')

    const recipients = (memberRows ?? []).map((m) => {
      const p = m.profiles as unknown as { full_name: string; email: string }
      return { userId: m.user_id, fullName: p?.full_name ?? 'Member', email: p?.email }
    })

    // Insert blast log
    const { data: blast } = await serviceClient
      .from('message_blasts')
      .insert({
        group_id: group.id,
        sender_id: user.id,
        title: title.trim(),
        body: blastBody.trim(),
        recipient_count: recipients.length,
      })
      .select('id')
      .single()

    // Post system message in announcements channel
    const { data: announcementsChannel } = await serviceClient
      .from('channels')
      .select('id')
      .eq('group_id', group.id)
      .eq('type', 'announcements')
      .maybeSingle()

    if (announcementsChannel) {
      await serviceClient.from('messages').insert({
        channel_id: announcementsChannel.id,
        sender_id: user.id,
        content: `[BLAST] ${title.trim()}: ${blastBody.trim()}`,
        content_type: 'system',
      })
    }

    // Send push to all group members
    sendPushToGroup(group.id, {
      title: `${group.name}: ${title.trim()}`,
      body: blastBody.trim().slice(0, 100),
      url: `/g/${group.slug}`,
    }).catch((err) => console.error('[blast] push error:', err))

    // Batch send emails
    const emailPromises = recipients
      .filter((r) => r.email)
      .map((r) =>
        sendBlastEmail({
          recipientEmail: r.email,
          recipientName: r.fullName,
          groupName: group.name,
          groupSlug: group.slug,
          title: title.trim(),
          body: blastBody.trim(),
        })
      )

    Promise.allSettled(emailPromises).catch((err) =>
      console.error('[blast] email batch error:', err)
    )

    return NextResponse.json({
      success: true,
      blastId: blast?.id,
      recipientCount: recipients.length,
    })
  } catch (err) {
    console.error('[blast] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
