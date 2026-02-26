import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendMemberApprovedEmail } from '@/lib/email'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  try {
    const { slug, userId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await _request.json()
    const newStatus = body.status as string

    if (!['approved', 'blocked'].includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Fetch group
    const { data: group } = await svc
      .from('groups')
      .select('id, name, slug')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Verify caller is admin
    const { data: callerMembership } = await svc
      .from('group_members')
      .select('role')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle()

    if (
      !callerMembership ||
      !['super_admin', 'co_admin'].includes(callerMembership.role)
    ) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    // Update the member's status
    const { error: updateErr } = await svc
      .from('group_members')
      .update({ status: newStatus })
      .eq('group_id', group.id)
      .eq('user_id', userId)

    if (updateErr) {
      console.error('[api/members] update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
    }

    if (newStatus === 'approved') {
      // Create member_stats row
      await svc
        .from('member_stats')
        .upsert(
          { user_id: userId, group_id: group.id },
          { onConflict: 'user_id,group_id' }
        )

      // Send welcome email to the approved member
      const { data: memberProfile } = await svc
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .maybeSingle()

      if (memberProfile?.email) {
        const approvalResult = await sendMemberApprovedEmail({
          memberEmail: memberProfile.email,
          memberName: memberProfile.full_name || 'Member',
          groupName: group.name,
          groupSlug: group.slug,
        })
        if (!approvalResult.success) {
          console.error('[api/members] approval email failed:', approvalResult.error)
        }
      }
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (err) {
    console.error('[api/members] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
