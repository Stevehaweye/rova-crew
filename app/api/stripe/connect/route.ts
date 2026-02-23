import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeServer } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { group_id, slug } = body as { group_id: string; slug: string }

    if (!group_id || !slug) {
      return NextResponse.json({ error: 'Missing group_id or slug' }, { status: 400 })
    }

    // Auth + admin check
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('role, status')
      .eq('group_id', group_id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const serviceClient = createServiceClient()
    const stripe = getStripeServer()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const returnUrl = `${appUrl}/g/${slug}/admin/settings?stripe=complete`
    const refreshUrl = `${appUrl}/g/${slug}/admin/settings?stripe=refresh`

    // Check if a Stripe account already exists for this group
    const { data: existing } = await serviceClient
      .from('stripe_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('group_id', group_id)
      .maybeSingle()

    let stripeAccountId: string

    if (existing?.stripe_account_id) {
      // Account exists — create a new onboarding link
      stripeAccountId = existing.stripe_account_id
    } else {
      // Fetch group name for the account
      const { data: group } = await serviceClient
        .from('groups')
        .select('name')
        .eq('id', group_id)
        .single()

      // Create a new Express account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: group?.name ?? undefined,
        },
        metadata: {
          group_id,
        },
      })

      stripeAccountId = account.id

      // Insert the record
      await serviceClient.from('stripe_accounts').insert({
        group_id,
        stripe_account_id: account.id,
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
    console.error('[stripe/connect] error:', err)
    const message =
      err instanceof Error ? err.message : 'Failed to create Stripe account'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
