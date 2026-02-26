import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🔥']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { emoji } = body as { emoji: string }

    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { data: inserted, error } = await serviceClient.from('message_reactions').insert({
      message_id: messageId,
      user_id: user.id,
      emoji,
    }).select('id')

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already reacted' }, { status: 409 })
      }
      console.error('[chat/reactions] insert error:', error)
      return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: inserted?.[0]?.id })
  } catch (err) {
    console.error('[chat/reactions] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { emoji } = body as { emoji: string }

    if (!emoji) {
      return NextResponse.json({ error: 'Missing emoji' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    await serviceClient
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[chat/reactions] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
