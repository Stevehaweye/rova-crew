import { NextRequest, NextResponse } from 'next/server'
import { getStripeServer } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { sendRsvpConfirmationEmail } from '@/lib/email'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

type Supa = SupabaseClient

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
  } catch {
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('[stripe-webhook] Signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  const supabase = createServiceClient()

  // Event-level idempotency: if we've already processed this event.id, ack 200 and stop.
  const { data: seen } = await supabase
    .from('stripe_processed_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()

  if (seen) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const connectedAccountId =
    (event as unknown as { account?: string }).account ?? null

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(
          supabase,
          stripe,
          event.data.object as Stripe.Checkout.Session,
          connectedAccountId
        )
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(
          supabase,
          event.data.object as Stripe.PaymentIntent
        )
        break

      case 'charge.refunded':
        await handleChargeRefunded(
          supabase,
          event.data.object as Stripe.Charge
        )
        break

      case 'charge.dispute.created':
      case 'charge.dispute.closed':
        await handleChargeDispute(
          supabase,
          event.data.object as Stripe.Dispute,
          event.type
        )
        break

      case 'account.updated':
        await handleAccountUpdated(
          supabase,
          event.data.object as Stripe.Account
        )
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(
          supabase,
          event.data.object as Stripe.Subscription,
          connectedAccountId
        )
        break

      case 'invoice.paid':
      case 'invoice.payment_failed':
        await handleInvoiceStatus(
          supabase,
          event.data.object as Stripe.Invoice,
          event.type
        )
        break

      default:
        // Unhandled event types are still recorded as processed so Stripe stops
        // retrying them.
        break
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler failed for ${event.type} ${event.id}:`, err)
    // Return 500 without recording the event so Stripe retries.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  // Record the event only after successful handling.
  const { error: recordErr } = await supabase
    .from('stripe_processed_events')
    .insert({ id: event.id, event_type: event.type })

  if (recordErr && recordErr.code !== '23505') {
    // 23505 = unique violation (raced with a concurrent delivery — safe to ack).
    console.error('[stripe-webhook] failed to record event:', recordErr)
    return NextResponse.json({ error: 'Record failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  supabase: Supa,
  stripe: ReturnType<typeof getStripeServer>,
  session: Stripe.Checkout.Session,
  connectedAccountId: string | null
) {
  const metaType = session.metadata?.type
  if (metaType === 'membership') {
    // Membership checkouts create a subscription — the subscription events
    // handle DB writes. Nothing else to do here.
    return
  }

  const eventId = session.metadata?.event_id
  const userId = session.metadata?.user_id || null
  const isGuest = session.metadata?.is_guest === 'true'
  const guestName = session.metadata?.guest_name || null
  const guestEmail = session.metadata?.guest_email || null

  if (!eventId) {
    // Non-event checkout session — nothing to record.
    return
  }

  // Retrieve payment intent for receipt URL.
  let stripePaymentId: string | null = null
  let stripeReceiptUrl: string | null = null
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null

  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ['latest_charge'] },
        connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
      )
      stripePaymentId = pi.id
      const charge = pi.latest_charge as Stripe.Charge | null
      stripeReceiptUrl = charge?.receipt_url ?? null
    } catch (err) {
      console.error('[webhook] Failed to retrieve payment intent:', err)
    }
  }

  const { error: payErr } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq('stripe_checkout_session_id', session.id)

  if (payErr) throw new Error(`payments update: ${payErr.message}`)

  if (isGuest && guestEmail) {
    const nameParts = (guestName ?? 'Guest').trim().split(/\s+/)
    const firstName = nameParts[0] ?? 'Guest'
    const lastName = nameParts.slice(1).join(' ') || 'Guest'

    // Upsert on (event_id, email) so concurrent inserts / retries dedupe.
    const { data: guestRsvp, error: guestErr } = await supabase
      .from('guest_rsvps')
      .upsert(
        {
          event_id: eventId,
          first_name: firstName,
          last_name: lastName,
          email: guestEmail,
          status: 'confirmed',
        },
        { onConflict: 'event_id,email' }
      )
      .select('qr_token')
      .single()

    if (guestErr) throw new Error(`guest_rsvps upsert: ${guestErr.message}`)

    await sendGuestConfirmation(supabase, {
      eventId,
      guestEmail,
      firstName,
      lastName,
      qrToken: guestRsvp?.qr_token,
      stripePaymentId,
      stripeReceiptUrl,
    })
  } else if (userId) {
    const { error: rsvpErr } = await supabase.from('rsvps').upsert(
      {
        event_id: eventId,
        user_id: userId,
        status: 'going',
        payment_status: 'paid',
      },
      { onConflict: 'event_id,user_id' }
    )
    if (rsvpErr) throw new Error(`rsvps upsert: ${rsvpErr.message}`)

    await sendMemberConfirmation(supabase, {
      eventId,
      userId,
      sessionEmail: session.customer_email ?? null,
      stripePaymentId,
      stripeReceiptUrl,
    })
  }
}

async function handlePaymentFailed(
  supabase: Supa,
  paymentIntent: Stripe.PaymentIntent
) {
  const eventId = paymentIntent.metadata?.event_id
  const userId = paymentIntent.metadata?.user_id
  const guestEmail = paymentIntent.metadata?.guest_email

  console.error(
    `[stripe-webhook] Payment failed for event=${eventId} user=${userId || guestEmail}:`,
    paymentIntent.last_payment_error?.message ?? 'Unknown error'
  )

  if (!paymentIntent.id) return

  // Prefer lookup by stripe_payment_intent_id; fall back to
  // checkout session id via metadata.session_id if the PI id was never persisted.
  const { data: byPi } = await supabase
    .from('payments')
    .update({ status: 'failed' })
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .select('id')

  if (byPi && byPi.length > 0) return

  const sessionId = paymentIntent.metadata?.checkout_session_id
  if (sessionId) {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'failed', stripe_payment_intent_id: paymentIntent.id })
      .eq('stripe_checkout_session_id', sessionId)
    if (error) throw new Error(`payments failed update: ${error.message}`)
  }
}

async function handleChargeRefunded(supabase: Supa, charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : null
  if (!paymentIntentId) return

  const isFullRefund = charge.amount_refunded >= charge.amount

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .update({ status: isFullRefund ? 'refunded' : 'partially_refunded' })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .select('event_id, user_id, guest_email')
    .maybeSingle()

  if (payErr) throw new Error(`payments refund update: ${payErr.message}`)
  if (!payment || !isFullRefund) return

  if (payment.user_id) {
    const { error } = await supabase
      .from('rsvps')
      .update({ status: 'not_going', payment_status: 'refunded' })
      .eq('event_id', payment.event_id)
      .eq('user_id', payment.user_id)
    if (error) throw new Error(`rsvps refund update: ${error.message}`)
  } else if (payment.guest_email) {
    const { error } = await supabase
      .from('guest_rsvps')
      .update({ status: 'cancelled' })
      .eq('event_id', payment.event_id)
      .eq('email', payment.guest_email)
    if (error) throw new Error(`guest_rsvps refund update: ${error.message}`)
  }
}

async function handleChargeDispute(
  supabase: Supa,
  dispute: Stripe.Dispute,
  type: 'charge.dispute.created' | 'charge.dispute.closed'
) {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id
  const status =
    type === 'charge.dispute.created'
      ? 'disputed'
      : dispute.status === 'won'
        ? 'paid'
        : 'refunded'

  const { error } = await supabase
    .from('payments')
    .update({ status })
    .eq('stripe_charge_id', chargeId)

  if (error) {
    // Column may not exist yet — log but don't fail the webhook.
    console.error('[stripe-webhook] dispute update (non-fatal):', error.message)
  }
}

async function handleAccountUpdated(supabase: Supa, account: Stripe.Account) {
  const { error } = await supabase
    .from('stripe_accounts')
    .update({
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
      onboarding_complete:
        account.charges_enabled === true && account.details_submitted === true,
    })
    .eq('stripe_account_id', account.id)

  if (error) throw new Error(`stripe_accounts update: ${error.message}`)
}

async function handleSubscriptionChange(
  supabase: Supa,
  sub: Stripe.Subscription,
  connectedAccountId: string | null
) {
  const userId = sub.metadata?.user_id ?? null
  const groupId = sub.metadata?.group_id ?? null
  if (!userId || !groupId) {
    // Not a ROVA-managed subscription.
    return
  }

  // current_period_end moved onto subscription items in Stripe API 2024-04-10+,
  // but the runtime payload still carries it at the top level for older
  // versions. Read defensively from both.
  const periodEndSeconds =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items?.data?.[0]?.current_period_end ??
    null

  const currentPeriodEnd = periodEndSeconds
    ? new Date(periodEndSeconds * 1000).toISOString()
    : null

  const { error } = await supabase.from('membership_subscriptions').upsert(
    {
      user_id: userId,
      group_id: groupId,
      stripe_subscription_id: sub.id,
      stripe_customer_id:
        typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_connected_account_id: connectedAccountId,
      status: sub.status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  )

  if (error) throw new Error(`membership_subscriptions upsert: ${error.message}`)
}

async function handleInvoiceStatus(
  supabase: Supa,
  invoice: Stripe.Invoice,
  type: 'invoice.paid' | 'invoice.payment_failed'
) {
  // `invoice.subscription` was removed from Stripe types but is still on the
  // runtime payload. Fall back to `parent.subscription_details.subscription`
  // for the newer API shape.
  const rawSub =
    (invoice as unknown as { subscription?: string | { id: string } }).subscription ??
    (invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } } }
    }).parent?.subscription_details?.subscription ??
    null

  const subscriptionId =
    typeof rawSub === 'string' ? rawSub : rawSub?.id ?? null

  if (!subscriptionId) return

  const status = type === 'invoice.paid' ? 'active' : 'past_due'

  const { error } = await supabase
    .from('membership_subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) throw new Error(`membership_subscriptions invoice update: ${error.message}`)
}

// ─── Email helpers ───────────────────────────────────────────────────────────

async function sendGuestConfirmation(
  supabase: Supa,
  args: {
    eventId: string
    guestEmail: string
    firstName: string
    lastName: string
    qrToken: string | undefined
    stripePaymentId: string | null
    stripeReceiptUrl: string | null
  }
) {
  const { data: eventData } = await supabase
    .from('events')
    .select('title, starts_at, ends_at, location, maps_url, price_pence, groups ( name, slug )')
    .eq('id', args.eventId)
    .single()

  if (!eventData) return

  const group = eventData.groups as unknown as { name: string; slug: string }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const qrCodeBase64 = await QRCode.toDataURL(args.qrToken ?? crypto.randomUUID(), {
    width: 400,
    margin: 2,
    color: { dark: '#111827', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })

  const startDate = new Date(eventData.starts_at)
  const endDate = new Date(eventData.ends_at ?? eventData.starts_at)
  const paidPence = eventData.price_pence as number | null
  const signUpUrl = `${appUrl}/auth?next=/g/${group.slug}&email=${encodeURIComponent(args.guestEmail)}`

  const result = await sendRsvpConfirmationEmail(args.guestEmail, {
    recipientName: `${args.firstName} ${args.lastName}`,
    eventTitle: eventData.title,
    eventDate: format(startDate, 'EEEE d MMMM yyyy'),
    eventTime: `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`,
    eventLocation: eventData.location,
    mapsUrl:
      eventData.maps_url ??
      (eventData.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.location)}`
        : null),
    eventUrl: `${appUrl}/events/${args.eventId}`,
    groupName: group.name,
    qrCodeBase64,
    paidAmount: paidPence ? `£${(paidPence / 100).toFixed(2)}` : null,
    isGuest: true,
    signUpUrl,
    stripePaymentId: args.stripePaymentId,
    stripeReceiptUrl: args.stripeReceiptUrl,
  })

  if (!result.success) {
    console.error('[webhook] guest email failed:', result.error)
  }
}

async function sendMemberConfirmation(
  supabase: Supa,
  args: {
    eventId: string
    userId: string
    sessionEmail: string | null
    stripePaymentId: string | null
    stripeReceiptUrl: string | null
  }
) {
  const [{ data: profile }, { data: eventData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', args.userId)
      .single(),
    supabase
      .from('events')
      .select('title, starts_at, ends_at, location, maps_url, price_pence, groups ( name, slug )')
      .eq('id', args.eventId)
      .single(),
  ])

  const memberEmail = profile?.email || args.sessionEmail
  if (!memberEmail || !eventData) return

  const group = eventData.groups as unknown as { name: string; slug: string }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const qrCodeBase64 = await QRCode.toDataURL(
    `${appUrl}/checkin/${args.userId}/${args.eventId}`,
    {
      width: 400,
      margin: 2,
      color: { dark: '#111827', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }
  )

  const startDate = new Date(eventData.starts_at)
  const endDate = new Date(eventData.ends_at ?? eventData.starts_at)
  const paidPence = eventData.price_pence as number | null

  const result = await sendRsvpConfirmationEmail(memberEmail, {
    recipientName: profile?.full_name ?? 'there',
    eventTitle: eventData.title,
    eventDate: format(startDate, 'EEEE d MMMM yyyy'),
    eventTime: `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`,
    eventLocation: eventData.location,
    mapsUrl:
      eventData.maps_url ??
      (eventData.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.location)}`
        : null),
    eventUrl: `${appUrl}/events/${args.eventId}`,
    groupName: group.name,
    qrCodeBase64,
    paidAmount: paidPence ? `£${(paidPence / 100).toFixed(2)}` : null,
    isGuest: false,
    signUpUrl: null,
    stripePaymentId: args.stripePaymentId,
    stripeReceiptUrl: args.stripeReceiptUrl,
  })

  if (!result.success) {
    console.error('[webhook] member email failed:', result.error)
  }
}
