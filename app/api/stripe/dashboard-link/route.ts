import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeServer } from '@/lib/stripe'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    const { data: account } = await serviceClient
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!account?.stripe_account_id || !account.onboarding_complete) {
      return NextResponse.json({ error: 'Stripe account not ready' }, { status: 400 })
    }

    const stripe = getStripeServer()

    const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id)

    return NextResponse.json({ url: loginLink.url })
  } catch (err) {
    console.error('[stripe/dashboard-link] error:', err)
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
