import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase/service'
import { sendRsvpConfirmationEmail } from '@/lib/email'
import { canAccessGroup } from '@/lib/discovery'

// ─── Validation ──────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateBody(body: unknown): { first_name: string; last_name: string; email: string } | string {
  if (!body || typeof body !== 'object') return 'Invalid request body.'

  const { first_name, last_name, email } = body as Record<string, unknown>

  if (typeof first_name !== 'string' || first_name.trim().length < 1)
    return 'First name is required.'

  if (typeof last_name !== 'string' || last_name.trim().length < 1)
    return 'Last name is required.'

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()))
    return 'A valid email address is required.'

  return {
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    email: email.trim().toLowerCase(),
  }
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const raw = await request.json().catch(() => null)
    const validated = validateBody(raw)

    if (typeof validated === 'string') {
      return NextResponse.json({ success: false, error: validated }, { status: 400 })
    }

    const { first_name, last_name, email } = validated
    const supabase = createServiceClient()

    // Check event exists and allows guest RSVPs
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title, starts_at, ends_at, location, group_id, allow_guest_rsvp, groups ( name, slug )')
      .eq('id', eventId)
      .maybeSingle()

    if (eventErr || !event) {
      return NextResponse.json({ success: false, error: 'Event not found.' }, { status: 404 })
    }

    // Enterprise scope check — guests can never satisfy enterprise scope
    const hasPublicAccess = await canAccessGroup(event.group_id, null)
    if (!hasPublicAccess) {
      return NextResponse.json(
        { success: false, error: 'This event is restricted to specific company members.' },
        { status: 403 }
      )
    }

    if (event.allow_guest_rsvp === false) {
      return NextResponse.json({ success: false, error: 'Guest RSVPs are not enabled for this event.' }, { status: 403 })
    }

    const group = event.groups as unknown as { name: string; slug: string }

    // Check for existing RSVP by this email
    const { data: existing } = await supabase
      .from('guest_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, alreadyRsvped: true, guestRsvpId: existing.id })
    }

    // Insert guest RSVP (qr_token auto-generates via DEFAULT)
    const { data: rsvp, error: insertErr } = await supabase
      .from('guest_rsvps')
      .insert({ event_id: eventId, first_name, last_name, email, status: 'confirmed' })
      .select('id, qr_token')
      .single()

    if (insertErr) {
      console.error('[guest-rsvp] insert error:', insertErr)
      return NextResponse.json(
        { success: false, error: 'Failed to save RSVP. Please try again.' },
        { status: 500 }
      )
    }

    // Generate QR code from qr_token
    const qrCodeBase64 = await QRCode.toDataURL(rsvp.qr_token, {
      width: 400,
      margin: 2,
      color: { dark: '#111827', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })

    // Build formatted dates and URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const startDate = new Date(event.starts_at)
    const endDate = event.ends_at ? new Date(event.ends_at) : startDate
    const eventUrl = `${appUrl}/events/${eventId}`
    const signUpUrl = `${appUrl}/auth?next=/g/${group.slug}&email=${encodeURIComponent(email)}`

    // Await email send to ensure it completes before function terminates
    const emailResult = await sendRsvpConfirmationEmail(email, {
      recipientName: `${first_name} ${last_name}`,
      eventTitle: event.title,
      eventDate: format(startDate, 'EEEE d MMMM yyyy'),
      eventTime: `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`,
      eventLocation: event.location,
      mapsUrl: event.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
        : null,
      eventUrl,
      groupName: group.name,
      qrCodeBase64,
      paidAmount: null,
      isGuest: true,
      signUpUrl,
    })
    if (!emailResult.success) {
      console.error('[guest-rsvp] email send failed:', emailResult.error)
    }

    return NextResponse.json({ success: true, guestRsvpId: rsvp.id })
  } catch (err) {
    console.error('[guest-rsvp] unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
