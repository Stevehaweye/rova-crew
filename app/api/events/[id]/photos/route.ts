import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { awardSpiritPoints } from '@/lib/spirit-points'

// ─── GET: List photos for an event ──────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    // Fetch event
    const { data: event } = await svc
      .from('events')
      .select('id, group_id')
      .eq('id', eventId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify membership
    const { data: membership } = await svc
      .from('group_members')
      .select('role, status')
      .eq('group_id', event.group_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership?.status !== 'approved') {
      return NextResponse.json({ error: 'Not a group member' }, { status: 403 })
    }

    const isAdmin = membership.role === 'super_admin' || membership.role === 'co_admin'

    // Fetch photos
    let photosQuery = svc
      .from('event_photos')
      .select(
        'id, storage_path, uploader_id, is_featured, is_album_cover, is_hidden, created_at, profiles:uploader_id ( full_name, avatar_url )'
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      photosQuery = photosQuery.eq('is_hidden', false)
    }

    const { data: photos } = await photosQuery

    if (!photos || photos.length === 0) {
      return NextResponse.json({ photos: [] })
    }

    // Batch fetch reactions
    const photoIds = photos.map((p) => p.id)
    const [reactionsResult, userReactionsResult] = await Promise.all([
      svc
        .from('photo_reactions')
        .select('photo_id')
        .in('photo_id', photoIds),
      svc
        .from('photo_reactions')
        .select('photo_id')
        .in('photo_id', photoIds)
        .eq('user_id', user.id),
    ])

    // Count reactions per photo
    const reactionCounts: Record<string, number> = {}
    for (const r of reactionsResult.data ?? []) {
      reactionCounts[r.photo_id] = (reactionCounts[r.photo_id] ?? 0) + 1
    }

    const userReactedSet = new Set((userReactionsResult.data ?? []).map((r) => r.photo_id))

    // Generate signed URLs and build response
    const result = await Promise.all(
      photos.map(async (p) => {
        const { data: signed } = await svc.storage
          .from('event-photos')
          .createSignedUrl(p.storage_path, 3600)

        const profile = p.profiles as unknown as {
          full_name: string
          avatar_url: string | null
        } | null

        return {
          id: p.id,
          photoUrl: signed?.signedUrl ?? '',
          storagePath: p.storage_path,
          uploaderId: p.uploader_id,
          uploaderName: profile?.full_name ?? 'Member',
          uploaderAvatar: profile?.avatar_url ?? null,
          uploadedAt: p.created_at,
          reactionCount: reactionCounts[p.id] ?? 0,
          userReacted: userReactedSet.has(p.id),
          isFeatured: p.is_featured,
          isAlbumCover: p.is_album_cover,
          isHidden: p.is_hidden,
        }
      })
    )

    return NextResponse.json({ photos: result })
  } catch (err) {
    console.error('[event-photos] GET error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ─── POST: Upload a photo ───────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    // Fetch event
    const { data: event } = await svc
      .from('events')
      .select('id, group_id')
      .eq('id', eventId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify membership
    const { data: membership } = await svc
      .from('group_members')
      .select('status')
      .eq('group_id', event.group_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership?.status !== 'approved') {
      return NextResponse.json({ error: 'Not a group member' }, { status: 403 })
    }

    // Check consent preference
    const { data: consent } = await svc
      .from('photo_consent_preferences')
      .select('consent_level')
      .eq('user_id', user.id)
      .eq('group_id', event.group_id)
      .maybeSingle()

    if (!consent) {
      return NextResponse.json({ needsConsent: true }, { status: 200 })
    }

    if (consent.consent_level === 'never') {
      return NextResponse.json(
        { error: 'Photo uploads disabled by your privacy settings' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Upload to storage
    const ext = file.name.split('.').pop() ?? 'jpg'
    const storagePath = `${eventId}/${user.id}/${Date.now()}.${ext}`

    const { error: uploadErr } = await svc.storage
      .from('event-photos')
      .upload(storagePath, file, { contentType: file.type })

    if (uploadErr) {
      console.error('[event-photos] storage upload error:', uploadErr)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    // Insert into database
    const { data: photo, error: insertErr } = await svc
      .from('event_photos')
      .insert({
        event_id: eventId,
        group_id: event.group_id,
        uploader_id: user.id,
        storage_path: storagePath,
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[event-photos] insert error:', insertErr)
      // Clean up uploaded file
      await svc.storage.from('event-photos').remove([storagePath])
      return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 })
    }

    // Award spirit points (fire-and-forget)
    awardSpiritPoints(user.id, event.group_id, 'photo_upload', photo.id).catch((err) =>
      console.error('[event-photos] spirit points error:', err)
    )

    return NextResponse.json({ success: true, photoId: photo.id })
  } catch (err) {
    console.error('[event-photos] POST error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
