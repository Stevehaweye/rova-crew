import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()

    // The form sends snake_case field names matching DB columns,
    // plus groupId in camelCase
    const groupId = body.groupId
    const title = body.title
    const starts_at = body.starts_at
    const ends_at = body.ends_at

    if (!groupId || !title?.trim() || !starts_at || !ends_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Verify user is admin of this group
    const { data: membership } = await serviceClient
      .from('group_members')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    // Insert event via service client (bypasses RLS)
    // Body fields are already in snake_case matching DB columns
    const { data: eventData, error: eventErr } = await serviceClient
      .from('events')
      .insert({
        group_id: groupId,
        created_by: user.id,
        title: title.trim(),
        description: body.description?.trim() || null,
        location: body.location?.trim() || null,
        maps_url: body.maps_url?.trim() || null,
        starts_at,
        ends_at,
        cover_url: body.cover_url || null,
        max_capacity: body.max_capacity || null,
        payment_type: body.payment_type,
        price_pence: body.price_pence || null,
        total_cost_pence: body.total_cost_pence || null,
        min_participants: body.min_participants || null,
        allow_guest_rsvp: body.allow_guest_rsvp ?? false,
        plus_ones_allowed: body.plus_ones_allowed ?? false,
        max_plus_ones_per_member: body.max_plus_ones_per_member ?? 3,
        plus_ones_count_toward_capacity: body.plus_ones_count_toward_capacity ?? true,
      })
      .select('id')
      .single()

    if (eventErr) {
      console.error('[api/events] insert error:', eventErr)
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
    }

    return NextResponse.json({ success: true, eventId: eventData.id })
  } catch (err) {
    console.error('[api/events] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
