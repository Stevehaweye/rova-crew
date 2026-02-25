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

    // Fetch photo
    const { data: photo } = await svc
      .from('event_photos')
      .select('id, storage_path, uploader_id, group_id')
      .eq('id', photoId)
      .maybeSingle()

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Check access: must be uploader or admin
    const isUploader = photo.uploader_id === user.id

    if (!isUploader) {
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
    }

    // Generate signed URL (60 seconds)
    const { data, error: signErr } = await svc.storage
      .from('event-photos')
      .createSignedUrl(photo.storage_path, 60)

    if (signErr || !data?.signedUrl) {
      console.error('[photo-download] signed URL error:', signErr)
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err) {
    console.error('[photo-download] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
