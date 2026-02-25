import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_ACTIONS = ['feature', 'unfeature', 'set_album_cover', 'hide', 'unhide', 'delete'] as const

export async function PUT(
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

    const svc = createServiceClient()

    // Fetch the photo to get event_id and group_id
    const { data: photo } = await svc
      .from('event_photos')
      .select('id, event_id, group_id, storage_path')
      .eq('id', photoId)
      .maybeSingle()

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Admin role check
    const { data: membership } = await svc
      .from('group_members')
      .select('role, status')
      .eq('group_id', photo.group_id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const action = body?.action as string

    if (!action || !ALLOWED_ACTIONS.includes(action as (typeof ALLOWED_ACTIONS)[number])) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    switch (action) {
      case 'feature': {
        // Max 5 featured per event
        const { count } = await svc
          .from('event_photos')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', photo.event_id)
          .eq('is_featured', true)

        if ((count ?? 0) >= 5) {
          return NextResponse.json({ error: 'Maximum 5 featured photos per event' }, { status: 400 })
        }

        await svc.from('event_photos').update({ is_featured: true }).eq('id', photoId)
        break
      }

      case 'unfeature':
        await svc.from('event_photos').update({ is_featured: false }).eq('id', photoId)
        break

      case 'set_album_cover':
        // Clear existing album cover for this event
        await svc
          .from('event_photos')
          .update({ is_album_cover: false })
          .eq('event_id', photo.event_id)
          .eq('is_album_cover', true)
        // Set new album cover
        await svc.from('event_photos').update({ is_album_cover: true }).eq('id', photoId)
        break

      case 'hide':
        await svc.from('event_photos').update({ is_hidden: true }).eq('id', photoId)
        break

      case 'unhide':
        await svc.from('event_photos').update({ is_hidden: false }).eq('id', photoId)
        break

      case 'delete': {
        // Delete from storage first
        const { error: storageErr } = await svc.storage
          .from('event-photos')
          .remove([photo.storage_path])

        if (storageErr) {
          console.error('[photo-admin] storage delete error:', storageErr)
        }

        // Delete from database
        await svc.from('event_photos').delete().eq('id', photoId)
        break
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[photo-admin] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
