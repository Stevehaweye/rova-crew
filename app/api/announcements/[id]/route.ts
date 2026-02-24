import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function verifyAdminForMessage(userId: string, messageId: string) {
  const serviceClient = createServiceClient()

  // Get the message's channel → group
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

  return isAdmin ? { serviceClient, message } : null
}

export async function PATCH(
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

    const result = await verifyAdminForMessage(user.id, id)
    if (!result) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    const body = await request.json()
    const { content, imageUrl } = body as { content?: string; imageUrl?: string }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Content too long' }, { status: 400 })
    }

    const { error } = await result.serviceClient
      .from('messages')
      .update({
        content: content.trim(),
        image_url: imageUrl ?? null,
        edited_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('[announcements/edit] error:', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[announcements/edit] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

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

    const result = await verifyAdminForMessage(user.id, id)
    if (!result) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    // Soft delete (announcements are always admin-deleted)
    const { error } = await result.serviceClient
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq('id', id)

    if (error) {
      console.error('[announcements/delete] error:', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[announcements/delete] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
