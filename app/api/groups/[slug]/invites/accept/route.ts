import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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

    const { token } = (await request.json()) as { token: string }

    if (!token) {
      return NextResponse.json({ error: 'Missing invite token' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Fetch group
    const { data: group } = await svc
      .from('groups')
      .select('id, join_approval_required')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Look up invite
    const { data: invite } = await svc
      .from('group_invites')
      .select('id, group_id, status')
      .eq('invite_token', token)
      .eq('group_id', group.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (!invite) {
      // Token invalid or already used — still allow normal join
      return NextResponse.json({ accepted: false, reason: 'invalid_or_used' })
    }

    // Mark invite as accepted
    const { error: updateErr } = await svc
      .from('group_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq('id', invite.id)

    if (updateErr) {
      console.error('[invite-accept] update error:', updateErr)
    }

    return NextResponse.json({ accepted: true })
  } catch (err) {
    console.error('[invite-accept] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
