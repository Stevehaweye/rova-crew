import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase/service'
import RsvpConfirmationEmail from '@/app/emails/rsvp-confirmation'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = 'ROVA Crew <noreply@mypin.global>'

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 })
    }

    const { email, name, eventId, qrToken, paidAmountPence, isGuest } = body as {
      email: string
      name: string
      eventId: string
      qrToken: string
      paidAmountPence?: number | null
      isGuest?: boolean
    }

    if (!email || !name || !eventId || !qrToken) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: email, name, eventId, qrToken.' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Fetch event with group info
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title, starts_at, ends_at, location, maps_url, groups ( name, slug )')
      .eq('id', eventId)
      .single()

    if (eventErr || !event) {
      console.error('[rsvp-email] event fetch error:', eventErr)
      return NextResponse.json({ success: false, error: 'Event not found.' }, { status: 404 })
    }

    const group = event.groups as unknown as { name: string; slug: string }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Generate QR code as base64 PNG
    const qrCodeBase64 = await QRCode.toDataURL(qrToken, {
      width: 400,
      margin: 2,
      color: { dark: '#111827', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })

    // Build Google Maps link if location exists
    const mapsUrl = event.maps_url
      ?? (event.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
        : null)

    // Format dates
    const startDate = new Date(event.starts_at)
    const endDate = new Date(event.ends_at)
    const eventDate = format(startDate, 'EEEE d MMMM yyyy')
    const eventTime = `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`

    // Paid amount label
    const paidAmount = paidAmountPence
      ? `\u00a3${(paidAmountPence / 100).toFixed(2)}`
      : null

    // Sign-up URL for guests
    const signUpUrl = isGuest
      ? `${appUrl}/auth?next=/g/${group.slug}&email=${encodeURIComponent(email)}`
      : null

    const eventUrl = `${appUrl}/events/${eventId}`

    // Send via Resend with React Email template
    const { error: sendErr } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: FROM_EMAIL,
      subject: `You're going to ${event.title}! Here's your check-in code.`,
      react: RsvpConfirmationEmail({
        recipientName: name,
        eventTitle: event.title,
        eventDate,
        eventTime,
        eventLocation: event.location,
        mapsUrl,
        eventUrl,
        groupName: group.name,
        qrCodeBase64,
        paidAmount,
        isGuest: isGuest ?? false,
        signUpUrl,
      }),
    })

    if (sendErr) {
      console.error('[rsvp-email] send error:', sendErr)
      return NextResponse.json({ success: false, error: sendErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rsvp-email] unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Failed to send email.' }, { status: 500 })
  }
}
