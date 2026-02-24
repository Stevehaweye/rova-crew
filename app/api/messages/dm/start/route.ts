import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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
    const { otherUserId } = body as { otherUserId: string }

    if (!otherUserId) {
      return NextResponse.json({ error: 'Missing otherUserId' }, { status: 400 })
    }

    if (otherUserId === user.id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // ── Check shared groups with DMs enabled ───────────────────────────
    const [{ data: myGroups }, { data: theirGroups }] = await Promise.all([
      serviceClient
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'approved'),
      serviceClient
        .from('group_members')
        .select('group_id')
        .eq('user_id', otherUserId)
        .eq('status', 'approved'),
    ])

    const myGroupIds = (myGroups ?? []).map((g) => g.group_id)
    const theirGroupIds = new Set((theirGroups ?? []).map((g) => g.group_id))
    const sharedGroupIds = myGroupIds.filter((id) => theirGroupIds.has(id))

    if (sharedGroupIds.length === 0) {
      return NextResponse.json({ error: 'No shared group' }, { status: 403 })
    }

    // Check if any shared group has DMs enabled
    const { data: dmEnabledGroups } = await serviceClient
      .from('groups')
      .select('id')
      .in('id', sharedGroupIds)
      .neq('allow_dm', false)
      .limit(1)

    if (!dmEnabledGroups || dmEnabledGroups.length === 0) {
      return NextResponse.json({ error: 'DMs are disabled in your shared groups' }, { status: 403 })
    }

    // ── Find existing DM channel ───────────────────────────────────────
    const { data: myDmMemberships } = await serviceClient
      .from('channel_members')
      .select('channel_id, channels!inner(id, type)')
      .eq('user_id', user.id)

    const dmChannelIds = (myDmMemberships ?? [])
      .filter((cm) => (cm.channels as unknown as { type: string })?.type === 'dm')
      .map((cm) => cm.channel_id)

    if (dmChannelIds.length > 0) {
      const { data: existing } = await serviceClient
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', otherUserId)
        .in('channel_id', dmChannelIds)
        .limit(1)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ channelId: existing.channel_id })
      }
    }

    // ── Create new DM channel ──────────────────────────────────────────
    const { data: newChannel, error: channelErr } = await serviceClient
      .from('channels')
      .insert({ type: 'dm', group_id: null, name: 'DM' })
      .select('id')
      .single()

    if (channelErr || !newChannel) {
      console.error('[dm/start] channel create error:', channelErr)
      return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
    }

    // Add both users to channel_members
    const now = new Date().toISOString()
    await serviceClient.from('channel_members').insert([
      { channel_id: newChannel.id, user_id: user.id, last_read_at: now },
      { channel_id: newChannel.id, user_id: otherUserId, last_read_at: now },
    ])

    return NextResponse.json({ channelId: newChannel.id })
  } catch (err) {
    console.error('[dm/start] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
