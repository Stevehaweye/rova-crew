import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { findOrCreateDmChannel } from '@/lib/dm-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  try {
    const { slug, userId: memberId } = await params

    // ── Auth check ──────────────────────────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    // ── Fetch group ─────────────────────────────────────────────────────────
    const { data: group } = await svc
      .from('groups')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // ── Admin check ─────────────────────────────────────────────────────────
    const { data: adminMembership } = await svc
      .from('group_members')
      .select('role')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle()

    if (
      !adminMembership ||
      !['super_admin', 'co_admin'].includes(adminMembership.role)
    ) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    // ── Validate member exists in group ─────────────────────────────────────
    const { data: memberCheck } = await svc
      .from('group_members')
      .select('user_id')
      .eq('group_id', group.id)
      .eq('user_id', memberId)
      .eq('status', 'approved')
      .maybeSingle()

    if (!memberCheck) {
      return NextResponse.json(
        { error: 'Member not found in this group' },
        { status: 404 }
      )
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await request.json()
    const { message, type } = body as { message: string; type: string }

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // ── Cooldown check: no nudge within last 14 days ────────────────────────
    const fourteenDaysAgo = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data: recentNudge } = await svc
      .from('nudges_sent')
      .select('id, created_at')
      .eq('group_id', group.id)
      .eq('member_id', memberId)
      .gte('created_at', fourteenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentNudge) {
      return NextResponse.json(
        {
          error: `A nudge was already sent on ${new Date(recentNudge.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Please wait 14 days between nudges.`,
        },
        { status: 429 }
      )
    }

    // ── Send DM ─────────────────────────────────────────────────────────────
    if (type === 'dm') {
      const channelId = await findOrCreateDmChannel(user.id, memberId)

      const { error: msgErr } = await svc.from('messages').insert({
        channel_id: channelId,
        sender_id: user.id,
        content: message.trim(),
      })

      if (msgErr) {
        console.error('[nudge] message insert error:', msgErr)
        return NextResponse.json(
          { error: 'Failed to send message' },
          { status: 500 }
        )
      }
    }

    // ── Record nudge ────────────────────────────────────────────────────────
    const { error: nudgeErr } = await svc.from('nudges_sent').insert({
      group_id: group.id,
      admin_id: user.id,
      member_id: memberId,
      type: type || 'dm',
      message: message.trim(),
    })

    if (nudgeErr) {
      console.error('[nudge] record insert error:', nudgeErr)
      // DM was sent, so don't fail entirely -- just log
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[nudge] error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
