import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { awardSpiritPoints } from '@/lib/spirit-points'
import { recalculateGroupCrewScores } from '@/lib/crew-score'
import { updateStreakOnCheckIn } from '@/lib/streaks'
import { calculateGroupHealthScore } from '@/lib/health-score'

// ─── POST: Check in a member or guest ────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 })
    }

    const { type, user_id, qr_token } = body as {
      type: 'member' | 'guest'
      user_id?: string
      qr_token?: string
    }

    const supabase = await createClient()

    // Verify caller is an admin for this event's group
    const {
      data: { user: caller },
    } = await supabase.auth.getUser()

    if (!caller) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 })
    }

    const { data: event } = await supabase
      .from('events')
      .select('id, group_id, title')
      .eq('id', eventId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found.' }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('role, status')
      .eq('group_id', event.group_id)
      .eq('user_id', caller.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 })
    }

    // ── Member check-in ──────────────────────────────────────────────────
    if (type === 'member' && user_id) {
      const { data: rsvp } = await supabase
        .from('rsvps')
        .select('id, status, checked_in_at, user_id')
        .eq('event_id', eventId)
        .eq('user_id', user_id)
        .maybeSingle()

      if (!rsvp) {
        return NextResponse.json({
          success: false,
          error: 'Not on the list',
          detail: 'This person has not RSVPd to this event.',
        }, { status: 404 })
      }

      // Fetch profile separately — the FK path from rsvps.user_id doesn't
      // support PostgREST's nested-select syntax on this schema, so the old
      // `profiles:user_id(...)` inline join returned null. Use service
      // client so RLS on profiles doesn't block the read either.
      const svc = createServiceClient()
      const { data: profile } = await svc
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', rsvp.user_id)
        .maybeSingle()

      if (rsvp.checked_in_at) {
        return NextResponse.json({
          success: false,
          error: 'Already checked in',
          detail: `${profile?.full_name ?? 'This person'} was already checked in.`,
          attendee: {
            name: profile?.full_name ?? 'Member',
            avatarUrl: profile?.avatar_url ?? null,
            type: 'member',
          },
        }, { status: 409 })
      }

      // Conditional update: only flip the row if checked_in_at is still null.
      // Two concurrent scans would both pass the null check above; this
      // .is('checked_in_at', null) guards against double-firing side effects.
      const { data: flipped, error: updateErr } = await supabase
        .from('rsvps')
        .update({ checked_in_at: new Date().toISOString() })
        .eq('id', rsvp.id)
        .is('checked_in_at', null)
        .select('id')

      if (updateErr) {
        console.error('[checkin] rsvp update error:', updateErr)
        return NextResponse.json({ success: false, error: 'Check-in failed.' }, { status: 500 })
      }

      if (!flipped || flipped.length === 0) {
        // Another concurrent scan already checked them in.
        return NextResponse.json({
          success: false,
          error: 'Already checked in',
          detail: `${profile?.full_name ?? 'This person'} was already checked in.`,
          attendee: {
            name: profile?.full_name ?? 'Member',
            avatarUrl: profile?.avatar_url ?? null,
            type: 'member',
          },
        }, { status: 409 })
      }

      // Award spirit points for attendance (fire-and-forget). awardSpiritPoints
      // internally triggers checkAndAwardBadges, so we don't need a separate
      // call here — the previous explicit invocation was a triple-fire per
      // check-in (see also updateStreakOnCheckIn which also runs it).
      awardSpiritPoints(user_id, event.group_id, 'event_attendance', eventId)
        .catch((err) => console.error('[checkin] spirit points error:', err))

      // Recalculate group crew scores (fire-and-forget)
      recalculateGroupCrewScores(event.group_id)
        .catch((err) => console.error('[checkin] crew score recalc error:', err))

      // Update attendance streak (fire-and-forget)
      updateStreakOnCheckIn(user_id, event.group_id, eventId)
        .catch((err) => console.error('[checkin] streak update error:', err))

      // Recalculate group health score (fire-and-forget)
      calculateGroupHealthScore(event.group_id)
        .catch((err) => console.error('[checkin] health score error:', err))

      return NextResponse.json({
        success: true,
        attendee: {
          name: profile?.full_name ?? 'Member',
          avatarUrl: profile?.avatar_url ?? null,
          type: 'member',
        },
      })
    }

    // ── Guest check-in ───────────────────────────────────────────────────
    if (type === 'guest' && qr_token) {
      const { data: guestRsvp } = await supabase
        .from('guest_rsvps')
        .select('id, first_name, last_name, status, checked_in_at')
        .eq('event_id', eventId)
        .eq('qr_token', qr_token)
        .maybeSingle()

      if (!guestRsvp) {
        return NextResponse.json({
          success: false,
          error: 'Not on the list',
          detail: 'This QR code is not valid for this event.',
        }, { status: 404 })
      }

      if (guestRsvp.checked_in_at) {
        return NextResponse.json({
          success: false,
          error: 'Already checked in',
          detail: `${guestRsvp.first_name} ${guestRsvp.last_name} was already checked in.`,
          attendee: {
            name: `${guestRsvp.first_name} ${guestRsvp.last_name}`,
            avatarUrl: null,
            type: 'guest',
          },
        }, { status: 409 })
      }

      const { error: updateErr } = await supabase
        .from('guest_rsvps')
        .update({ status: 'attended', checked_in_at: new Date().toISOString() })
        .eq('id', guestRsvp.id)

      if (updateErr) {
        console.error('[checkin] guest_rsvp update error:', updateErr)
        return NextResponse.json({ success: false, error: 'Check-in failed.' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        attendee: {
          name: `${guestRsvp.first_name} ${guestRsvp.last_name}`,
          avatarUrl: null,
          type: 'guest',
        },
      })
    }

    // ── Manual check-in (by rsvp ID or guest_rsvp ID) ───────────────────
    if (type === 'member' && !user_id) {
      return NextResponse.json({ success: false, error: 'user_id is required for member check-in.' }, { status: 400 })
    }
    if (type === 'guest' && !qr_token) {
      return NextResponse.json({ success: false, error: 'qr_token is required for guest check-in.' }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: 'Invalid check-in type.' }, { status: 400 })
  } catch (err) {
    console.error('[checkin] unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Something went wrong.' }, { status: 500 })
  }
}

// ─── PATCH: Manual check-in/undo by row ID ──────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 })
    }

    const { rsvp_id, table, action } = body as {
      rsvp_id: string
      table: 'rsvps' | 'guest_rsvps' | 'event_plus_ones'
      action: 'checkin' | 'undo'
    }

    const supabase = await createClient()

    // Auth check
    const {
      data: { user: caller },
    } = await supabase.auth.getUser()

    if (!caller) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 })
    }

    const { data: event } = await supabase
      .from('events')
      .select('id, group_id')
      .eq('id', eventId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found.' }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('role, status')
      .eq('group_id', event.group_id)
      .eq('user_id', caller.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Not authorized.' }, { status: 403 })
    }

    const checkedInAt = action === 'checkin' ? new Date().toISOString() : null

    if (table === 'rsvps') {
      const { error } = await supabase
        .from('rsvps')
        .update({ checked_in_at: checkedInAt })
        .eq('id', rsvp_id)
        .eq('event_id', eventId)

      if (error) {
        return NextResponse.json({ success: false, error: 'Update failed.' }, { status: 500 })
      }
    } else if (table === 'guest_rsvps') {
      const statusUpdate = action === 'checkin' ? 'attended' : 'confirmed'
      const { error } = await supabase
        .from('guest_rsvps')
        .update({ checked_in_at: checkedInAt, status: statusUpdate })
        .eq('id', rsvp_id)
        .eq('event_id', eventId)

      if (error) {
        return NextResponse.json({ success: false, error: 'Update failed.' }, { status: 500 })
      }
    } else if (table === 'event_plus_ones') {
      // event_plus_ones now has RLS on with no anon policies (migration 008),
      // so writes must go through the service client.
      const svc = createServiceClient()
      const { error } = await svc
        .from('event_plus_ones')
        .update({ checked_in: action === 'checkin' })
        .eq('id', rsvp_id)
        .eq('event_id', eventId)

      if (error) {
        return NextResponse.json({ success: false, error: 'Update failed.' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ success: false, error: 'Invalid table.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[checkin] patch error:', err)
    return NextResponse.json({ success: false, error: 'Something went wrong.' }, { status: 500 })
  }
}
