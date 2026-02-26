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
    const {
      groupId,
      title,
      description,
      location,
      mapsUrl,
      startsAt,
      endsAt,
      coverUrl,
      maxCapacity,
      paymentType,
      pricePence,
      totalCostPence,
      minParticipants,
      allowGuestRsvp,
      plusOnesAllowed,
      maxPlusOnesPerMember,
      plusOnesCountTowardCapacity,
    } = body

    if (!groupId || !title?.trim() || !startsAt || !endsAt) {
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
    const { data: eventData, error: eventErr } = await serviceClient
      .from('events')
      .insert({
        group_id: groupId,
        created_by: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        maps_url: mapsUrl?.trim() || null,
        starts_at: startsAt,
        ends_at: endsAt,
        cover_url: coverUrl || null,
        max_capacity: maxCapacity || null,
        payment_type: paymentType,
        price_pence: pricePence || null,
        total_cost_pence: totalCostPence || null,
        min_participants: minParticipants || null,
        allow_guest_rsvp: allowGuestRsvp ?? false,
        plus_ones_allowed: plusOnesAllowed ?? false,
        max_plus_ones_per_member: maxPlusOnesPerMember ?? 3,
        plus_ones_count_toward_capacity: plusOnesCountTowardCapacity ?? true,
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
