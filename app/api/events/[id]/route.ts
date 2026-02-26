import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
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

    const body = await request.json()
    const serviceClient = createServiceClient()

    // Get event to find group_id
    const { data: event } = await serviceClient
      .from('events')
      .select('group_id')
      .eq('id', eventId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify user is admin of this group
    const { data: membership } = await serviceClient
      .from('group_members')
      .select('role, status')
      .eq('group_id', event.group_id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    // Build update payload from allowed fields only
    const allowedFields = [
      'title', 'description', 'location', 'maps_url', 'starts_at', 'ends_at',
      'cover_url', 'max_capacity', 'payment_type', 'price_pence', 'total_cost_pence',
      'min_participants', 'allow_guest_rsvp', 'plus_ones_allowed',
      'max_plus_ones_per_member', 'plus_ones_count_toward_capacity',
    ]

    const updatePayload: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in body) updatePayload[key] = body[key]
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error: updateErr } = await serviceClient
      .from('events')
      .update(updatePayload)
      .eq('id', eventId)

    if (updateErr) {
      console.error('[api/events/patch] update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/events/patch] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
