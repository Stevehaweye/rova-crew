import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function verifyMemberForMessage(userId: string, messageId: string) {
  const serviceClient = createServiceClient()

  const { data: message } = await serviceClient
    .from('messages')
    .select('id, sender_id, channel_id, channels ( group_id )')
    .eq('id', messageId)
    .maybeSingle()

  if (!message) return null

  const groupId = (message.channels as unknown as { group_id: string })?.group_id

  if (groupId) {
    const { data: membership } = await serviceClient
      .from('group_members')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle()

    if (membership?.status !== 'approved') return null

    const isAdmin = membership.role === 'super_admin' || membership.role === 'co_admin'
    const isOwner = message.sender_id === userId

    return { serviceClient, message, isAdmin, isOwner }
  }

  // DM channel (group_id is null): verify via channel_members
  const { data: cm } = await serviceClient
    .from('channel_members')
    .select('user_id')
    .eq('channel_id', message.channel_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!cm) return null

  return { serviceClient, message, isAdmin: false, isOwner: message.sender_id === userId }
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

    const result = await verifyMemberForMessage(user.id, id)
    if (!result) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    // Only own messages can be edited
    if (!result.isOwner) {
      return NextResponse.json({ error: 'Can only edit own messages' }, { status: 403 })
    }

    const body = await request.json()
    const { content } = body as { content?: string }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
    }

    const { error } = await result.serviceClient
      .from('messages')
      .update({
        content: content.trim(),
        edited_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('[chat/edit] error:', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[chat/edit] error:', err)
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

    const result = await verifyMemberForMessage(user.id, id)
    if (!result) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    // Own messages or admin can delete
    if (!result.isOwner && !result.isAdmin) {
      return NextResponse.json({ error: 'Not authorised to delete' }, { status: 403 })
    }

    const { error } = await result.serviceClient
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: result.isOwner ? null : user.id,
      })
      .eq('id', id)

    if (error) {
      console.error('[chat/delete] error:', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[chat/delete] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
