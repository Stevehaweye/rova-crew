import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function verifyAdminForMessage(userId: string, messageId: string) {
  const serviceClient = createServiceClient()

  const { data: message } = await serviceClient
    .from('messages')
    .select('id, channel_id, channels ( group_id )')
    .eq('id', messageId)
    .maybeSingle()

  if (!message) return null

  const groupId = (message.channels as unknown as { group_id: string })?.group_id
  if (!groupId) return null

  const { data: membership } = await serviceClient
    .from('group_members')
    .select('role, status')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'super_admin' || membership.role === 'co_admin')

  return isAdmin ? serviceClient : null
}

// Pin
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const serviceClient = await verifyAdminForMessage(user.id, id)
    if (!serviceClient) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    const { error } = await serviceClient
      .from('messages')
      .update({ is_pinned: true })
      .eq('id', id)

    if (error) {
      console.error('[announcements/pin] error:', error)
      return NextResponse.json({ error: 'Failed to pin' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[announcements/pin] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// Unpin
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const serviceClient = await verifyAdminForMessage(user.id, id)
    if (!serviceClient) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    const { error } = await serviceClient
      .from('messages')
      .update({ is_pinned: false })
      .eq('id', id)

    if (error) {
      console.error('[announcements/unpin] error:', error)
      return NextResponse.json({ error: 'Failed to unpin' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[announcements/unpin] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
