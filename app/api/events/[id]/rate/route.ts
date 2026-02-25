import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { awardSpiritPoints } from '@/lib/spirit-points'

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

    const body = await request.json().catch(() => null)
    const rating = body?.rating
    const comment = body?.comment ?? null

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 })
    }

    if (comment && typeof comment === 'string' && comment.length > 200) {
      return NextResponse.json({ error: 'Comment too long (max 200)' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Fetch event to get group_id
    const { data: event } = await svc
      .from('events')
      .select('id, group_id')
      .eq('id', eventId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // UPSERT rating (one per user per event)
    const { error: upsertErr } = await svc.from('event_ratings').upsert(
      {
        event_id: eventId,
        user_id: user.id,
        rating,
        comment: comment || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,user_id' }
    )

    if (upsertErr) {
      console.error('[rate] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 })
    }

    // Award spirit points (fire-and-forget)
    awardSpiritPoints(user.id, event.group_id, 'event_rating', eventId).catch((err) =>
      console.error('[rate] spirit points error:', err)
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rate] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
