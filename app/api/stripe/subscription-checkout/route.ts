import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeServer } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { group_id } = (await request.json()) as { group_id: string }

    if (!group_id) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Fetch group with subscription price
    const { data: group } = await serviceClient
      .from('groups')
      .select('id, name, slug, membership_fee_enabled, membership_fee_pence, stripe_subscription_price_id')
      .eq('id', group_id)
      .single()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    if (!group.membership_fee_enabled || !group.stripe_subscription_price_id) {
      return NextResponse.json({ error: 'This group does not have a membership fee' }, { status: 400 })
    }

    // Fetch Stripe connected account
    const { data: stripeAccount } = await serviceClient
      .from('stripe_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('group_id', group.id)
      .maybeSingle()

    if (!stripeAccount?.charges_enabled) {
      return NextResponse.json({ error: 'Stripe Connect not set up for this group' }, { status: 400 })
    }

    // Fetch user profile for email
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    const stripe = getStripeServer()
    const connectedAccountId = stripeAccount.stripe_account_id

    // Create or retrieve a Stripe Customer on the connected account
    const existingCustomers = await stripe.customers.list(
      { email: profile?.email ?? user.email!, limit: 1 },
      { stripeAccount: connectedAccountId }
    )

    let customerId: string
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else {
      const customer = await stripe.customers.create(
        {
          email: profile?.email ?? user.email!,
          name: profile?.full_name ?? undefined,
          metadata: { user_id: user.id },
        },
        { stripeAccount: connectedAccountId }
      )
      customerId = customer.id
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Create Checkout Session in subscription mode
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        line_items: [
          {
            price: group.stripe_subscription_price_id,
            quantity: 1,
          },
        ],
        subscription_data: {
          application_fee_percent: 5,
          metadata: {
            group_id: group.id,
            user_id: user.id,
          },
        },
        metadata: {
          group_id: group.id,
          user_id: user.id,
          type: 'membership',
        },
        success_url: `${appUrl}/g/${group.slug}?subscription=success`,
        cancel_url: `${appUrl}/g/${group.slug}?subscription=cancelled`,
      },
      { stripeAccount: connectedAccountId }
    )

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[subscription-checkout] error:', err)
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
