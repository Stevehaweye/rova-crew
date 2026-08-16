import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeServer } from '@/lib/stripe'
import PaymentSuccessClient from './payment-success-client'

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PaymentSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ session_id?: string }>
}) {
  const { id: eventId } = await params
  const { session_id: sessionId } = await searchParams

  if (!sessionId) redirect(`/events/${eventId}`)

  const serviceClient = createServiceClient()

  // ── Verify the Stripe session ───────────────────────────────────────────
  const stripe = getStripeServer()

  // Look up connected account for direct-charge sessions
  const { data: paymentRecord } = await serviceClient
    .from('payments')
    .select('stripe_connected_account_id')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle()

  let session
  try {
    const opts = paymentRecord?.stripe_connected_account_id
      ? { stripeAccount: paymentRecord.stripe_connected_account_id }
      : undefined
    session = await stripe.checkout.sessions.retrieve(sessionId, undefined, opts)
  } catch {
    redirect(`/events/${eventId}`)
  }

  if (session.status !== 'complete' || session.metadata?.event_id !== eventId) {
    redirect(`/events/${eventId}`)
  }

  // ── Get current user (may be null for guests) ───────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const metaUserId = session.metadata?.user_id || null
  const metaGuestEmail = session.metadata?.guest_email || null
  const isGuest = !metaUserId

  // The Stripe webhook (app/api/stripe/webhook/route.ts) is the single source
  // of truth for flipping payments to 'paid', upserting the RSVP, and creating
  // the guest_rsvps row. This page used to duplicate those writes, which
  // raced with the webhook and could double-insert guest RSVPs. Now we only
  // verify the session and render.

  // ── Fetch event + group details ─────────────────────────────────────────
  const { data: event } = await serviceClient
    .from('events')
    .select(
      'id, title, description, location, starts_at, ends_at, cover_url, price_pence, group_id, groups ( name, slug, logo_url, primary_colour )'
    )
    .eq('id', eventId)
    .single()

  if (!event) redirect('/home')

  const group = event.groups as unknown as {
    name: string
    slug: string
    logo_url: string | null
    primary_colour: string
  }

  const colour = group.primary_colour.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour}`

  const amountPence = event.price_pence ?? 0

  return (
    <PaymentSuccessClient
      event={{
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        coverUrl: event.cover_url,
        amountPence,
      }}
      group={{
        name: group.name,
        slug: group.slug,
        logoUrl: group.logo_url,
        colour,
      }}
      isGuest={isGuest}
      guestEmail={metaGuestEmail}
      isLoggedIn={!!user}
    />
  )
}
