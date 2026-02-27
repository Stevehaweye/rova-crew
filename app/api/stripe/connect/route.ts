import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeServer } from '@/lib/stripe'

// ── GET: Check live onboarding status ────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    const { data: existing } = await serviceClient
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete, charges_enabled, payouts_enabled, details_submitted')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ account: null })
    }

    // Fetch live status from Stripe
    try {
      const stripe = getStripeServer()
      const acct = await stripe.accounts.retrieve(existing.stripe_account_id)

      const onboardingComplete = acct.charges_enabled === true && acct.details_submitted === true

      await serviceClient
        .from('stripe_accounts')
        .update({
          charges_enabled: acct.charges_enabled ?? false,
          payouts_enabled: acct.payouts_enabled ?? false,
          details_submitted: acct.details_submitted ?? false,
          onboarding_complete: onboardingComplete,
        })
        .eq('user_id', user.id)

      return NextResponse.json({
        account: {
          stripe_account_id: existing.stripe_account_id,
          onboarding_complete: onboardingComplete,
          charges_enabled: acct.charges_enabled ?? false,
          payouts_enabled: acct.payouts_enabled ?? false,
          details_submitted: acct.details_submitted ?? false,
        },
      })
    } catch (err) {
      console.error('[stripe/connect] Failed to retrieve Stripe account:', err)
      // Return cached data if Stripe fetch fails
      return NextResponse.json({ account: existing })
    }
  } catch (err) {
    console.error('[stripe/connect] GET error:', err)
    return NextResponse.json({ error: 'Failed to check Stripe status' }, { status: 500 })
  }
}

// ── POST: Create or resume Stripe onboarding ─────────────────────────────────

export async function POST() {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    const stripe = getStripeServer()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const returnUrl = `${appUrl}/settings/payments?success=true`
    const refreshUrl = `${appUrl}/settings/payments?refresh=true`

    // Check if a Stripe account already exists for this user
    const { data: existing } = await serviceClient
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle()

    let stripeAccountId: string

    if (existing?.stripe_account_id) {
      // Account exists — create a new onboarding link
      stripeAccountId = existing.stripe_account_id
    } else {
      // Create a new Express account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })

      stripeAccountId = account.id

      // Insert the record
      await serviceClient.from('stripe_accounts').insert({
        user_id: user.id,
        stripe_account_id: account.id,
        onboarding_complete: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      })
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: unknown) {
    console.error('[stripe/connect] POST error:', err)
    const message =
      err instanceof Error ? err.message : 'Failed to create Stripe account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
