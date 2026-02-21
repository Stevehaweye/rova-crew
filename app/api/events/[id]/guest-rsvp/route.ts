import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase/service'
import { sendGuestRsvpConfirmation } from '@/lib/email'

// ─── Validation ──────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateBody(body: unknown): { name: string; email: string } | string {
  if (!body || typeof body !== 'object') return 'Invalid request body.'

  const { name, email } = body as Record<string, unknown>

  if (typeof name !== 'string' || name.trim().length < 2)
    return 'Name is required (min 2 characters).'

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()))
    return 'A valid email address is required.'

  return { name: name.trim(), email: email.trim().toLowerCase() }
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Parse & validate body
    const raw = await request.json().catch(() => null)
    const validated = validateBody(raw)

    if (typeof validated === 'string') {
      return NextResponse.json({ success: false, error: validated }, { status: 400 })
    }

    const { name, email } = validated
    const eventId = params.id
    const supabase = createServiceClient()

    // 2. Check event exists — join group for name
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title, starts_at, ends_at, location, group_id, groups ( name, slug )')
      .eq('id', eventId)
      .maybeSingle()

    if (eventErr || !event) {
      return NextResponse.json(
        { success: false, error: 'Event not found.' },
        { status: 404 }
      )
    }

    const group = event.groups as unknown as { name: string; slug: string }

    // 3. Check for existing RSVP by this email
    const { data: existing } = await supabase
      .from('guest_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, alreadyRsvped: true, guestRsvpId: existing.id })
    }

    // 4. Generate a check-in token
    const token = crypto.randomUUID()

    // 5. Insert guest RSVP
    const { data: rsvp, error: insertErr } = await supabase
      .from('guest_rsvps')
      .insert({ event_id: eventId, name, email, status: 'going', token })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[guest-rsvp] insert error:', insertErr)
      return NextResponse.json(
        { success: false, error: 'Failed to save RSVP. Please try again.' },
        { status: 500 }
      )
    }

    // 6. Generate QR code (base64 PNG) — content is the token
    const qrCodeBase64 = await QRCode.toDataURL(token, {
      width: 300,
      margin: 2,
      color: { dark: '#111827', light: '#FFFFFF' },
    })

    // 7. Send confirmation email (fire-and-forget — don't block response)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const eventUrl = `${appUrl}/events/${eventId}`
    const eventDate = format(new Date(event.starts_at), "EEEE d MMMM yyyy 'at' h:mm a")
    const eventLocation = event.location ?? 'TBC'

    sendGuestRsvpConfirmation({
      guestName: name,
      guestEmail: email,
      eventTitle: event.title,
      eventDate,
      eventLocation,
      eventUrl,
      qrCodeBase64,
      groupName: group.name,
    }).catch((err) => console.error('[guest-rsvp] email send error:', err))

    // 8. Return success
    return NextResponse.json({ success: true, guestRsvpId: rsvp.id })
  } catch (err) {
    console.error('[guest-rsvp] unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
