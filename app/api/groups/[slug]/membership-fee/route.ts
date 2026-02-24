import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeServer } from '@/lib/stripe'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Fetch group
    const { data: group } = await supabase
      .from('groups')
      .select('id, name')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Admin check
    const { data: membership } = await supabase
      .from('group_members')
      .select('role, status')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { enabled, fee_pence } = body as { enabled: boolean; fee_pence: number }

    const serviceClient = createServiceClient()

    if (!enabled) {
      // Disable membership fee
      await serviceClient
        .from('groups')
        .update({ membership_fee_enabled: false })
        .eq('id', group.id)

      return NextResponse.json({ success: true })
    }

    // Validate fee
    if (!fee_pence || fee_pence < 100) {
      return NextResponse.json({ error: 'Fee must be at least £1.00' }, { status: 400 })
    }

    // Fetch Stripe account for this group
    const { data: stripeAccount } = await serviceClient
      .from('stripe_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('group_id', group.id)
      .maybeSingle()

    if (!stripeAccount?.charges_enabled) {
      return NextResponse.json({ error: 'Stripe Connect not set up' }, { status: 400 })
    }

    const stripe = getStripeServer()

    // Check if we already have a subscription price
    const { data: currentGroup } = await serviceClient
      .from('groups')
      .select('stripe_subscription_price_id')
      .eq('id', group.id)
      .single()

    let priceId = currentGroup?.stripe_subscription_price_id

    if (!priceId) {
      // Create Stripe Product + recurring Price on connected account
      const product = await stripe.products.create(
        {
          name: `${group.name} Monthly Membership`,
          metadata: { group_id: group.id },
        },
        { stripeAccount: stripeAccount.stripe_account_id }
      )

      const price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: fee_pence,
          currency: 'gbp',
          recurring: { interval: 'month' },
        },
        { stripeAccount: stripeAccount.stripe_account_id }
      )

      priceId = price.id
    }

    // Update groups table
    await serviceClient
      .from('groups')
      .update({
        membership_fee_enabled: true,
        membership_fee_pence: fee_pence,
        stripe_subscription_price_id: priceId,
      })
      .eq('id', group.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[membership-fee] error:', err)
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
