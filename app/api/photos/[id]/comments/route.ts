import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
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

    const { data: comments } = await svc
      .from('photo_comments')
      .select('id, content, created_at, user_id, profiles:user_id (full_name, avatar_url)')
      .eq('photo_id', photoId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    const result = (comments ?? []).map((c) => {
      const profile = c.profiles as unknown as { full_name: string; avatar_url: string | null } | null
      return {
        id: c.id,
        content: c.content,
        createdAt: c.created_at,
        userId: c.user_id,
        fullName: profile?.full_name ?? 'Member',
        avatarUrl: profile?.avatar_url ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[photo-comments] GET error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
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

    const body = await request.json().catch(() => null)
    const content = (body?.content as string)?.trim()

    if (!content || content.length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Comment too long' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { data: inserted, error: insertErr } = await svc
      .from('photo_comments')
      .insert({
        photo_id: photoId,
        user_id: user.id,
        content,
      })
      .select('id, created_at')

    if (insertErr) {
      console.error('[photo-comments] insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      id: inserted?.[0]?.id,
      createdAt: inserted?.[0]?.created_at,
    })
  } catch (err) {
    console.error('[photo-comments] POST error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
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

    const body = await request.json().catch(() => null)
    const commentId = body?.comment_id as string

    if (!commentId) {
      return NextResponse.json({ error: 'comment_id is required' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Soft-delete: only own comments
    const { error: updateErr } = await svc
      .from('photo_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('photo_id', photoId)
      .eq('user_id', user.id)

    if (updateErr) {
      console.error('[photo-comments] delete error:', updateErr)
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[photo-comments] DELETE error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
