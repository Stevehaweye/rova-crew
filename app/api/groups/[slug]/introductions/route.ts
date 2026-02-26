import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { findOrCreateDmChannel } from '@/lib/dm-utils'
import { awardSpiritPoints } from '@/lib/spirit-points'

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

    const svc = createServiceClient()

    // Fetch group
    const { data: group } = await svc
      .from('groups')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Admin check
    const { data: membership } = await svc
      .from('group_members')
      .select('role, status')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { memberA, memberB, eventId } = body as {
      memberA: string
      memberB: string
      eventId?: string
    }

    if (!memberA || !memberB || memberA === memberB) {
      return NextResponse.json({ error: 'Two different members required' }, { status: 400 })
    }

    // Find or create DM channel between the two members
    const channelId = await findOrCreateDmChannel(memberA, memberB)

    // Fetch admin's name for the introduction message
    const { data: adminProfile } = await svc
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const adminName = adminProfile?.full_name ?? 'Your admin'

    // Insert system message into the channel
    const { error: msgErr } = await svc.from('messages').insert({
      channel_id: channelId,
      sender_id: user.id,
      content: `${adminName} thinks you two should connect! Say hello and introduce yourselves.`,
      content_type: 'system',
    })

    if (msgErr) {
      console.error('[introductions] message insert error:', msgErr)
    }

    // Insert introduction record
    const { error: introErr } = await svc.from('introductions').insert({
      group_id: group.id,
      introduced_by: user.id,
      member_a: memberA,
      member_b: memberB,
      event_id: eventId ?? null,
      channel_id: channelId,
      status: 'sent',
    })

    if (introErr) {
      // Duplicate introduction is fine — the DM was still created
      if (!introErr.message.includes('duplicate')) {
        console.error('[introductions] insert error:', introErr)
      }
    }

    // Award spirit points (fire-and-forget)
    awardSpiritPoints(user.id, group.id, 'welcome_dm', eventId ?? undefined).catch(() => {})

    return NextResponse.json({ channelId })
  } catch (err) {
    console.error('[introductions] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
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

    const svc = createServiceClient()

    const { data: group } = await svc
      .from('groups')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const { data: intros } = await svc
      .from('introductions')
      .select('id, member_a, member_b, event_id, status, created_at')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ introductions: intros ?? [] })
  } catch (err) {
    console.error('[introductions] GET error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
