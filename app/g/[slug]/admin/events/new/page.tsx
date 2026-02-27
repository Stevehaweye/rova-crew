import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import EventForm from './event-form'

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // ── Auth check ──────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/g/${slug}/admin/events/new`)

  // ── Fetch group ─────────────────────────────────────────────────────────────
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) redirect('/home')

  // ── Role check: must be super_admin or co_admin ─────────────────────────────
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'super_admin' || membership.role === 'co_admin')

  if (!isAdmin) redirect(`/g/${slug}/admin`)

  // ── Stripe status: check user's Stripe account + group payments_enabled ────
  const serviceClient = createServiceClient()

  const { data: userStripe } = await serviceClient
    .from('stripe_accounts')
    .select('onboarding_complete, charges_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: groupPayment } = await serviceClient
    .from('groups')
    .select('payments_enabled, payment_admin_id')
    .eq('id', group.id)
    .single()

  // Determine stripe scenario for the form
  // A: No Stripe account at all
  // B: Stripe started but not complete
  // C: Stripe complete but payments not enabled on this group
  // D: Everything ready
  let stripeScenario: 'none' | 'incomplete' | 'not_enabled' | 'ready' = 'none'

  if (userStripe?.onboarding_complete && userStripe?.charges_enabled) {
    if (groupPayment?.payments_enabled) {
      stripeScenario = 'ready'
    } else {
      stripeScenario = 'not_enabled'
    }
  } else if (userStripe) {
    stripeScenario = 'incomplete'
  }

  return (
    <EventForm
      group={{
        id: group.id,
        name: group.name,
        slug: group.slug,
        logoUrl: group.logo_url,
        primaryColour: group.primary_colour,
        hasStripeAccount: stripeScenario === 'ready',
      }}
      userId={user.id}
      stripeScenario={stripeScenario}
    />
  )
}
