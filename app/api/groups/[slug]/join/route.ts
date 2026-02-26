import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendJoinRequestEmail } from '@/lib/email'

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
      .select('id, name, slug, join_approval_required')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Check if already a member
    const { data: existing } = await svc
      .from('group_members')
      .select('status')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing?.status === 'approved') {
      return NextResponse.json({ status: 'approved', alreadyMember: true })
    }
    if (existing?.status === 'pending') {
      return NextResponse.json({ status: 'pending', alreadyPending: true })
    }

    const newStatus = group.join_approval_required ? 'pending' : 'approved'

    // Upsert membership
    const { error: memberErr } = await svc
      .from('group_members')
      .upsert(
        { group_id: group.id, user_id: user.id, role: 'member', status: newStatus },
        { onConflict: 'group_id,user_id' }
      )

    if (memberErr) {
      console.error('[api/join] member upsert error:', memberErr)
      return NextResponse.json({ error: 'Failed to join group' }, { status: 500 })
    }

    if (newStatus === 'approved') {
      // Create member_stats row
      await svc
        .from('member_stats')
        .upsert(
          { user_id: user.id, group_id: group.id },
          { onConflict: 'user_id,group_id' }
        )

      // Fire-and-forget: recalculate group health score
      const body = await request.json().catch(() => ({}))
      if (body.inviteToken) {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/groups/${slug}/invites/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: body.inviteToken }),
        }).catch(() => {})
      }
    }

    if (newStatus === 'pending') {
      // Notify the super_admin via email
      const { data: adminMember } = await svc
        .from('group_members')
        .select('user_id, profiles ( full_name, email )')
        .eq('group_id', group.id)
        .eq('role', 'super_admin')
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle()

      if (adminMember) {
        const adminProfile = adminMember.profiles as unknown as {
          full_name: string
          email: string | null
        }

        // Fetch the requesting member's profile
        const { data: memberProfile } = await svc
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .maybeSingle()

        if (adminProfile?.email && memberProfile) {
          sendJoinRequestEmail({
            adminEmail: adminProfile.email,
            adminName: adminProfile.full_name || 'Admin',
            memberName: memberProfile.full_name || 'A new member',
            memberEmail: memberProfile.email || user.email || '',
            groupName: group.name,
            groupSlug: group.slug,
          }).catch((err) => console.error('[api/join] email error:', err))
        }
      }
    }

    return NextResponse.json({ status: newStatus })
  } catch (err) {
    console.error('[api/join] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
