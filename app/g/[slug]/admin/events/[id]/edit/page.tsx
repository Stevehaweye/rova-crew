import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import EventForm from '../../new/event-form'

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id: eventId } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/g/${slug}/admin/events/${eventId}/edit`)

  // Fetch group
  const { data: group } = await supabase
    .from('groups')
    .select('*')
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

  // Stripe status: user-level
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

  let stripeScenario: 'none' | 'incomplete' | 'not_enabled' | 'ready' = 'none'
  if (userStripe?.onboarding_complete && userStripe?.charges_enabled) {
    stripeScenario = groupPayment?.payments_enabled ? 'ready' : 'not_enabled'
  } else if (userStripe) {
    stripeScenario = 'incomplete'
  }

  const hasStripeAccount = stripeScenario === 'ready'

  // Fetch event
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('group_id', group.id)
    .maybeSingle()

  if (!event) redirect(`/g/${slug}/admin/events`)

  // Parse dates for the form
  const startDate = new Date(event.starts_at)
  const endDate = event.ends_at ? new Date(event.ends_at) : undefined
  const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
  const endTime = endDate
    ? `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    : ''

  return (
    <EventForm
      group={{
        id: group.id,
        name: group.name,
        slug: group.slug,
        logoUrl: group.logo_url,
        primaryColour: group.primary_colour,
        hasStripeAccount,
      }}
      userId={user.id}
      eventId={eventId}
      stripeScenario={stripeScenario}
      initialData={{
        title: event.title ?? '',
        description: event.description ?? '',
        paymentType: (event.payment_type as 'free' | 'fixed' | 'shared_cost') ?? 'free',
        ticketPrice: event.price_pence ? (event.price_pence / 100).toFixed(2) : '',
        totalCost: event.total_cost_pence ? (event.total_cost_pence / 100).toFixed(2) : '',
        minParticipants: event.min_participants ? String(event.min_participants) : '',
        startDate,
        startTime,
        endDate,
        endTime,
        locationName: event.location ?? '',
        mapsUrl: event.maps_url ?? '',
        capacityEnabled: !!event.max_capacity,
        capacity: event.max_capacity ? String(event.max_capacity) : '',
        membersOnly: true,
        allowGuests: event.allow_guest_rsvp ?? true,
        existingCoverUrl: event.cover_url ?? null,
      }}
    />
  )
}
