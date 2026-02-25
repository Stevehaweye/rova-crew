import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeServer } from '@/lib/stripe'
import SettingsClient from './settings-client'

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ stripe?: string }>
}) {
  const { slug } = await params
  const { stripe: stripeParam } = await searchParams
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/g/${slug}/admin/settings`)

  // Fetch group
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) redirect('/home')

  // Role check
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'super_admin' || membership.role === 'co_admin')

  if (!isAdmin) redirect(`/g/${slug}`)

  // Fetch Stripe account status
  let { data: stripeAccount } = await supabase
    .from('stripe_accounts')
    .select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted')
    .eq('group_id', group.id)
    .maybeSingle()

  // When returning from Stripe onboarding, refresh status directly from Stripe
  if (stripeParam === 'complete' && stripeAccount?.stripe_account_id) {
    try {
      const stripe = getStripeServer()
      const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id)
      const serviceClient = createServiceClient()

      await serviceClient
        .from('stripe_accounts')
        .update({
          charges_enabled: account.charges_enabled ?? false,
          payouts_enabled: account.payouts_enabled ?? false,
          details_submitted: account.details_submitted ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', stripeAccount.stripe_account_id)

      // Use the fresh data
      stripeAccount = {
        ...stripeAccount,
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
      }
    } catch (err) {
      console.error('[settings] Failed to refresh Stripe status:', err)
    }
  }

  const colour = group.primary_colour?.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour ?? '0D7377'}`

  // Fetch membership fee settings
  const serviceClient = createServiceClient()
  const { data: groupFeeData } = await serviceClient
    .from('groups')
    .select('membership_fee_enabled, membership_fee_pence, allow_dm, tier_theme, badge_announcements_enabled, watermark_photos')
    .eq('id', group.id)
    .single()

  return (
    <SettingsClient
      group={{
        id: group.id,
        name: group.name,
        slug: group.slug,
        colour,
      }}
      stripe={
        stripeAccount
          ? {
              accountId: stripeAccount.stripe_account_id,
              chargesEnabled: stripeAccount.charges_enabled,
              payoutsEnabled: stripeAccount.payouts_enabled,
              detailsSubmitted: stripeAccount.details_submitted,
            }
          : null
      }
      membershipFee={{
        enabled: groupFeeData?.membership_fee_enabled ?? false,
        feePence: groupFeeData?.membership_fee_pence ?? null,
      }}
      dmEnabled={groupFeeData?.allow_dm ?? true}
      tierTheme={groupFeeData?.tier_theme ?? 'generic'}
      badgeAnnouncementsEnabled={groupFeeData?.badge_announcements_enabled ?? true}
      watermarkPhotos={groupFeeData?.watermark_photos ?? false}
    />
  )
}
