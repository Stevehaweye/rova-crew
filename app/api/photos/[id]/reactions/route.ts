import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: photoId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    const { data: inserted, error } = await svc
      .from('photo_reactions')
      .insert({
        photo_id: photoId,
        user_id: user.id,
        emoji: '❤️',
      })
      .select('id')

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already reacted' }, { status: 409 })
      }
      console.error('[photo-reactions] insert error:', error)
      return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: inserted?.[0]?.id })
  } catch (err) {
    console.error('[photo-reactions] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: photoId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    await svc
      .from('photo_reactions')
      .delete()
      .eq('photo_id', photoId)
      .eq('user_id', user.id)
      .eq('emoji', '❤️')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[photo-reactions] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
