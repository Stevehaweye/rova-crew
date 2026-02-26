import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { findOrCreateDmChannel } from '@/lib/dm-utils'

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

    // ── Find or create DM channel ────────────────────────────────────────
    const channelId = await findOrCreateDmChannel(user.id, otherUserId)

    return NextResponse.json({ channelId })
  } catch (err) {
    console.error('[dm/start] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
