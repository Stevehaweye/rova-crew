import { NextRequest, NextResponse } from 'next/server'
import { getStripeServer } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { sendRsvpConfirmationEmail } from '@/lib/email'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import type Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripeServer()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Log all webhook events for dev visibility
  console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`)

  const supabase = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const eventId = session.metadata?.event_id
    const userId = session.metadata?.user_id
    const isGuest = session.metadata?.is_guest === 'true'
    const guestName = session.metadata?.guest_name
    const guestEmail = session.metadata?.guest_email

    if (!eventId) {
      console.error('[stripe-webhook] No event_id in metadata')
      return NextResponse.json({ received: true })
    }

    // Update payment record (updated_at handled by DB trigger)
    await supabase
      .from('payments')
      .update({
        status: 'paid',
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : null,
      })
      .eq('stripe_checkout_session_id', session.id)

    if (isGuest && guestName && guestEmail) {
      // Split guest name into first/last
      const nameParts = guestName.trim().split(/\s+/)
      const firstName = nameParts[0] ?? 'Guest'
      const lastName = nameParts.slice(1).join(' ') || 'Guest'

      // Insert guest RSVP (qr_token auto-generates via DB DEFAULT)
      const { data: guestRsvp } = await supabase
        .from('guest_rsvps')
        .insert({
          event_id: eventId,
          first_name: firstName,
          last_name: lastName,
          email: guestEmail,
          status: 'confirmed',
        })
        .select('qr_token')
        .single()

      // Send confirmation email with QR code
      const { data: eventData } = await supabase
        .from('events')
        .select('title, starts_at, ends_at, location, maps_url, price_pence, groups ( name, slug )')
        .eq('id', eventId)
        .single()

      if (eventData) {
        const group = eventData.groups as unknown as { name: string; slug: string }
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

        const qrCodeBase64 = await QRCode.toDataURL(guestRsvp?.qr_token ?? crypto.randomUUID(), {
          width: 400,
          margin: 2,
          color: { dark: '#111827', light: '#FFFFFF' },
          errorCorrectionLevel: 'M',
        })

        const startDate = new Date(eventData.starts_at)
        const endDate = new Date(eventData.ends_at)
        const paidPence = (session.amount_total ?? eventData.price_pence) as number | null
        const signUpUrl = `${appUrl}/auth?next=/g/${group.slug}&email=${encodeURIComponent(guestEmail)}`

        sendRsvpConfirmationEmail(guestEmail, {
          recipientName: `${firstName} ${lastName}`,
          eventTitle: eventData.title,
          eventDate: format(startDate, 'EEEE d MMMM yyyy'),
          eventTime: `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`,
          eventLocation: eventData.location,
          mapsUrl: eventData.maps_url
            ?? (eventData.location
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.location)}`
              : null),
          eventUrl: `${appUrl}/events/${eventId}`,
          groupName: group.name,
          qrCodeBase64,
          paidAmount: paidPence ? `\u00a3${(paidPence / 100).toFixed(2)}` : null,
          isGuest: true,
          signUpUrl,
        }).catch((err: unknown) =>
          console.error('[webhook] email error:', err)
        )
      }
    } else if (userId) {
      // Insert member RSVP with payment_status = 'paid'
      await supabase.from('rsvps').upsert(
        {
          event_id: eventId,
          user_id: userId,
          status: 'going',
          payment_status: 'paid',
        },
        { onConflict: 'event_id,user_id' }
      )

      // Send confirmation email to the member
      const [{ data: profile }, { data: eventData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', userId)
          .single(),
        supabase
          .from('events')
          .select('title, starts_at, ends_at, location, maps_url, price_pence, groups ( name, slug )')
          .eq('id', eventId)
          .single(),
      ])

      if (profile?.email && eventData) {
        const group = eventData.groups as unknown as { name: string; slug: string }
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

        // Member QR encodes checkin URL
        const qrCodeBase64 = await QRCode.toDataURL(
          `${appUrl}/checkin/${userId}/${eventId}`,
          {
            width: 400,
            margin: 2,
            color: { dark: '#111827', light: '#FFFFFF' },
            errorCorrectionLevel: 'M',
          }
        )

        const startDate = new Date(eventData.starts_at)
        const endDate = new Date(eventData.ends_at)
        const paidPence = (session.amount_total ?? eventData.price_pence) as number | null

        sendRsvpConfirmationEmail(profile.email, {
          recipientName: profile.full_name ?? 'there',
          eventTitle: eventData.title,
          eventDate: format(startDate, 'EEEE d MMMM yyyy'),
          eventTime: `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`,
          eventLocation: eventData.location,
          mapsUrl: eventData.maps_url
            ?? (eventData.location
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.location)}`
              : null),
          eventUrl: `${appUrl}/events/${eventId}`,
          groupName: group.name,
          qrCodeBase64,
          paidAmount: paidPence ? `\u00a3${(paidPence / 100).toFixed(2)}` : null,
          isGuest: false,
          signUpUrl: null,
        }).catch((err: unknown) =>
          console.error('[webhook] member email error:', err)
        )
      }
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const eventId = paymentIntent.metadata?.event_id
    const userId = paymentIntent.metadata?.user_id
    const guestEmail = paymentIntent.metadata?.guest_email

    console.error(
      `[stripe-webhook] Payment failed for event=${eventId} user=${userId || guestEmail}:`,
      paymentIntent.last_payment_error?.message ?? 'Unknown error'
    )

    // Update the payment record to failed status (updated_at handled by DB trigger)
    if (paymentIntent.id) {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', paymentIntent.id)
    }
  } else if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    console.log(
      `[stripe-webhook] Connect account updated: ${account.id}`,
      `charges_enabled=${account.charges_enabled}`,
      `payouts_enabled=${account.payouts_enabled}`,
      `details_submitted=${account.details_submitted}`
    )

    // Future: update group's Stripe Connect status in the database
    // when Stripe Connect is implemented for group payouts
  } else {
    console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
