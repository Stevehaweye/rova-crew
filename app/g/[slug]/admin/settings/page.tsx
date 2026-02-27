import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import SettingsClient from './settings-client'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
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

  const colour = group.primary_colour?.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour ?? '0D7377'}`

  const serviceClient = createServiceClient()

  // Fetch group data including payment columns
  const { data: groupData } = await serviceClient
    .from('groups')
    .select('membership_fee_enabled, membership_fee_pence, allow_dm, tier_theme, badge_announcements_enabled, watermark_photos, location, tagline, description, category, is_public, join_approval_required, hero_url, hero_focal_x, hero_focal_y, payments_enabled, payment_admin_id')
    .eq('id', group.id)
    .single()

  // Fetch current user's Stripe account status
  const { data: userStripeAccount } = await serviceClient
    .from('stripe_accounts')
    .select('stripe_account_id, onboarding_complete, charges_enabled, payouts_enabled, details_submitted')
    .eq('user_id', user.id)
    .maybeSingle()

  // Fetch payment admin's name if different from current user
  let paymentAdminName: string | null = null
  if (groupData?.payment_admin_id && groupData.payment_admin_id !== user.id) {
    const { data: adminProfile } = await serviceClient
      .from('profiles')
      .select('full_name')
      .eq('id', groupData.payment_admin_id)
      .maybeSingle()
    paymentAdminName = adminProfile?.full_name ?? null
  } else if (groupData?.payment_admin_id === user.id) {
    const { data: myProfile } = await serviceClient
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    paymentAdminName = myProfile?.full_name ?? null
  }

  return (
    <SettingsClient
      group={{
        id: group.id,
        name: group.name,
        slug: group.slug,
        colour,
      }}
      payments={{
        userHasStripe: !!userStripeAccount?.onboarding_complete,
        userStripeChargesEnabled: userStripeAccount?.charges_enabled ?? false,
        groupPaymentsEnabled: groupData?.payments_enabled ?? false,
        paymentAdminId: groupData?.payment_admin_id ?? null,
        paymentAdminName,
        currentUserId: user.id,
      }}
      membershipFee={{
        enabled: groupData?.membership_fee_enabled ?? false,
        feePence: groupData?.membership_fee_pence ?? null,
      }}
      dmEnabled={groupData?.allow_dm ?? true}
      tierTheme={groupData?.tier_theme ?? 'generic'}
      badgeAnnouncementsEnabled={groupData?.badge_announcements_enabled ?? true}
      watermarkPhotos={groupData?.watermark_photos ?? false}
      location={groupData?.location ?? ''}
      groupProfile={{
        name: group.name,
        tagline: groupData?.tagline ?? '',
        description: groupData?.description ?? '',
        category: groupData?.category ?? '',
        isPublic: groupData?.is_public ?? true,
        joinApprovalRequired: groupData?.join_approval_required ?? false,
      }}
      heroImage={{
        url: groupData?.hero_url ?? null,
        focalX: groupData?.hero_focal_x ?? 50,
        focalY: groupData?.hero_focal_y ?? 50,
      }}
    />
  )
}
