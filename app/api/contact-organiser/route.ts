import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendContactOrganiserEmail } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { group_id, sender_name, sender_email, message } = body as {
      group_id?: string
      sender_name?: string
      sender_email?: string
      message?: string
    }

    if (!group_id) {
      return NextResponse.json({ error: 'Missing group_id' }, { status: 400 })
    }
    if (!sender_name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!sender_email?.trim() || !EMAIL_RE.test(sender_email.trim())) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Fetch group name
    const { data: group } = await supabase
      .from('groups')
      .select('name')
      .eq('id', group_id)
      .single()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Fetch super_admin's email
    const { data: adminMember } = await supabase
      .from('group_members')
      .select('user_id, profiles ( email, full_name )')
      .eq('group_id', group_id)
      .eq('role', 'super_admin')
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()

    const adminProfile = adminMember?.profiles as unknown as { email: string; full_name: string } | null

    if (!adminProfile?.email) {
      return NextResponse.json({ error: 'Could not find group admin' }, { status: 404 })
    }

    // Send email
    const result = await sendContactOrganiserEmail({
      adminEmail: adminProfile.email,
      adminName: adminProfile.full_name,
      senderName: sender_name.trim(),
      senderEmail: sender_email.trim(),
      message: message.trim(),
      groupName: group.name,
    })

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact-organiser] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
