import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeServer } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { event_id, user_id, guest_email, guest_first_name, guest_last_name } = body

  if (!event_id) {
    return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
  }

  if (!user_id && !guest_email) {
    return NextResponse.json(
      { error: 'Either user_id or guest_email is required' },
      { status: 400 }
    )
  }

  const serviceClient = createServiceClient()

  // ── Verify authenticated user if user_id provided ─────────────────────────
  let verifiedUserId: string | null = null
  let customerEmail: string | undefined

  if (user_id) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    verifiedUserId = user.id
    customerEmail = user.email ?? undefined
  } else {
    customerEmail = guest_email
  }

  // ── Fetch event with group info ───────────────────────────────────────────
  const { data: event } = await serviceClient
    .from('events')
    .select('id, title, price_pence, payment_type, group_id, groups ( name )')
    .eq('id', event_id)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (event.payment_type !== 'fixed' || !event.price_pence) {
    return NextResponse.json(
      { error: 'This event does not require payment' },
      { status: 400 }
    )
  }

  // ── Check group payments enabled + payment admin ──────────────────────────
  const { data: groupPayment } = await serviceClient
    .from('groups')
    .select('payments_enabled, payment_admin_id')
    .eq('id', event.group_id)
    .single()

  if (!groupPayment?.payments_enabled) {
    return NextResponse.json(
      { error: 'Payments are not enabled for this group.' },
      { status: 400 }
    )
  }

  if (!groupPayment?.payment_admin_id) {
    return NextResponse.json(
      { error: 'No payment admin is set for this group.' },
      { status: 400 }
    )
  }

  // ── Fetch payment admin's Stripe Connect account ────────────────────────
  const { data: stripeAccount } = await serviceClient
    .from('stripe_accounts')
    .select('stripe_account_id, charges_enabled, onboarding_complete')
    .eq('user_id', groupPayment.payment_admin_id)
    .single()

  if (!stripeAccount?.stripe_account_id || !stripeAccount.charges_enabled) {
    return NextResponse.json(
      { error: 'The payment admin for this group has not completed Stripe setup. Visit Profile > Settings > Payments.' },
      { status: 400 }
    )
  }

  // ── Calculate platform fee (5%, minimum 30p) ──────────────────────────────
  const amountPence = event.price_pence
  const platformFeePence = Math.max(Math.round(amountPence * 0.05), 30)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const group = event.groups as unknown as { name: string }

  try {
    const stripe = getStripeServer()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: amountPence,
            product_data: {
              name: event.title,
              description: `Event ticket — ${group.name}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeePence,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
      },
      customer_email: customerEmail,
      metadata: {
        event_id,
        user_id: verifiedUserId ?? '',
        is_guest: verifiedUserId ? 'false' : 'true',
        guest_email: guest_email ?? '',
        guest_name: guest_first_name && guest_last_name
          ? `${guest_first_name} ${guest_last_name}`
          : '',
      },
      success_url: `${appUrl}/events/${event_id}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/events/${event_id}`,
    })

    // ── Create pending payment record ─────────────────────────────────────
    await serviceClient.from('payments').insert({
      group_id: event.group_id,
      event_id,
      user_id: verifiedUserId,
      guest_email: guest_email ?? null,
      stripe_checkout_session_id: session.id,
      amount_pence: amountPence,
      platform_fee_pence: platformFeePence,
      currency: 'gbp',
      status: 'pending',
      payment_type: 'event_ticket',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] error:', err)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
