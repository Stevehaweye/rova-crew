import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import EventPageClient from './event-page-client'
import Link from 'next/link'
import type { ChatMessage, ReactionGroup, ChatMember } from '@/components/GroupChat'

// ─── Not Found ───────────────────────────────────────────────────────────────

function NotFoundView() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-7xl mb-6 select-none">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Event not found</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          This event doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: '#0D7377' }}
        >
          Go home &rarr;
        </Link>
      </div>
    </div>
  )
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const svc = createServiceClient()
  const { data: event } = await svc
    .from('events')
    .select('title, description, cover_url, location, starts_at, groups ( name )')
    .eq('id', id)
    .maybeSingle()

  if (!event) return { title: 'Event | ROVA Crew' }

  const groupName = (event.groups as unknown as { name: string })?.name ?? 'ROVA Crew'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rovacrew.com'
  return {
    title: `${event.title} | ${groupName}`,
    description: event.description ?? `${event.title} — join on ROVA Crew`,
    openGraph: {
      title: event.title,
      description: event.description ?? `${event.title} — join on ROVA Crew`,
      url: `${appUrl}/events/${id}`,
      images: event.cover_url ? [{ url: event.cover_url }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description: event.description ?? undefined,
    },
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch event with group info
  const { data: event } = await supabase
    .from('events')
    .select('*, groups ( name, slug, logo_url, primary_colour )')
    .eq('id', id)
    .maybeSingle()

  if (!event) return <NotFoundView />

  const group = event.groups as unknown as {
    name: string
    slug: string
    logo_url: string | null
    primary_colour: string
  }

  // Get current user (optional — page works for anonymous)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Use service client for data queries to bypass RLS
  const svc = createServiceClient()

  // ── Scope gating: check if this event's group has a scope restriction ──
  const { data: scopeRow } = await svc
    .from('group_scope')
    .select('scope_type, company_id, scope_location, scope_department')
    .eq('group_id', event.group_id)
    .maybeSingle()

  const isPublicScope = !scopeRow || scopeRow.scope_type === 'public'

  if (!isPublicScope) {
    // Company-scoped event — check access
    if (!user) {
      // Not authenticated → gated view
      const colour = group.primary_colour.startsWith('#') ? group.primary_colour : `#${group.primary_colour}`
      const { data: scopeCompany } = scopeRow.company_id
        ? await svc.from('companies').select('name').eq('id', scopeRow.company_id).maybeSingle()
        : { data: null }
      const companyName = scopeCompany?.name ?? 'this company'
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="text-7xl mb-6 select-none">🔒</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
            <p className="text-sm text-gray-500 mb-1">
              {new Date(event.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="text-gray-500 mb-8 leading-relaxed">
              This event is only open to {companyName} employees. Sign in with your work email to view and RSVP.
            </p>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
              style={{ backgroundColor: colour }}
            >
              Sign in &rarr;
            </Link>
          </div>
        </div>
      )
    }

    // Authenticated — check if user matches scope
    const { data: userProfile } = await svc
      .from('profiles')
      .select('company_id, work_location, department')
      .eq('id', user.id)
      .maybeSingle()

    let canAccess = false
    if (userProfile && userProfile.company_id === scopeRow.company_id) {
      if (scopeRow.scope_type === 'company') {
        canAccess = true
      } else if (scopeRow.scope_type === 'location') {
        canAccess = !!(userProfile.work_location && scopeRow.scope_location &&
          userProfile.work_location.toLowerCase().trim() === scopeRow.scope_location.toLowerCase().trim())
      } else if (scopeRow.scope_type === 'department') {
        canAccess = !!(userProfile.department && scopeRow.scope_department &&
          userProfile.department.toLowerCase().trim() === scopeRow.scope_department.toLowerCase().trim())
      } else if (scopeRow.scope_type === 'loc_dept') {
        canAccess = !!(userProfile.work_location && userProfile.department &&
          scopeRow.scope_location && scopeRow.scope_department &&
          userProfile.work_location.toLowerCase().trim() === scopeRow.scope_location.toLowerCase().trim() &&
          userProfile.department.toLowerCase().trim() === scopeRow.scope_department.toLowerCase().trim())
      }
    }

    // Also allow if user is a member of the group
    if (!canAccess) {
      const { data: membership } = await svc
        .from('group_members')
        .select('status')
        .eq('group_id', event.group_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (membership?.status === 'approved') canAccess = true
    }

    if (!canAccess) {
      const { data: scopeCompany } = scopeRow.company_id
        ? await svc.from('companies').select('name').eq('id', scopeRow.company_id).maybeSingle()
        : { data: null }
      const scopeDesc = scopeRow.scope_type === 'company'
        ? `${scopeCompany?.name ?? 'this company'} employees`
        : scopeRow.scope_type === 'location'
        ? `${scopeCompany?.name ?? 'company'} employees at ${scopeRow.scope_location}`
        : scopeRow.scope_type === 'department'
        ? `${scopeCompany?.name ?? 'company'} ${scopeRow.scope_department} employees`
        : `${scopeCompany?.name ?? 'company'} ${scopeRow.scope_department} employees at ${scopeRow.scope_location}`
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="text-7xl mb-6 select-none">🔒</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Access restricted</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">
              This event is only available to {scopeDesc}.
            </p>
            <Link
              href="/home"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
              style={{ backgroundColor: '#0D7377' }}
            >
              Go home &rarr;
            </Link>
          </div>
        </div>
      )
    }
  }

  // Parallel fetches: RSVP counts, initial RSVPs, guest RSVPs, user's RSVP, user profile
  const [
    goingCountResult,
    maybeCountResult,
    notGoingCountResult,
    guestRsvpCount,
    memberRsvps,
    guestRsvps,
    userRsvpResult,
    profileResult,
    organiserResult,
  ] = await Promise.all([
    // Member RSVP count — going
    svc
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'going'),

    // Member RSVP count — maybe
    svc
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'maybe'),

    // Member RSVP count — not_going
    svc
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'not_going'),

    // Guest RSVP count (confirmed)
    svc
      .from('guest_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'confirmed'),

    // Member RSVPs with profiles (limit 20)
    svc
      .from('rsvps')
      .select('id, user_id, status, created_at, profiles ( full_name, avatar_url )')
      .eq('event_id', id)
      .in('status', ['going', 'maybe'])
      .order('created_at', { ascending: true })
      .limit(20),

    // Guest RSVPs (limit 20)
    svc
      .from('guest_rsvps')
      .select('id, first_name, last_name, email, status, created_at')
      .eq('event_id', id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true })
      .limit(20),

    // Current user's RSVP (if logged in)
    user
      ? svc
          .from('rsvps')
          .select('id, status')
          .eq('event_id', id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Current user's profile (if logged in)
    user
      ? svc
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Event organiser profile
    svc
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', event.created_by)
      .maybeSingle(),
  ])

  const memberGoingCount = goingCountResult.count ?? 0
  const memberMaybeCount = maybeCountResult.count ?? 0
  const memberNotGoingCount = notGoingCountResult.count ?? 0
  const guestGoingCount = guestRsvpCount.count ?? 0

  // ── Plus-ones data ─────────────────────────────────────────────────────
  const [plusOnesResult, currentUserPlusOnesResult] = await Promise.all([
    svc
      .from('event_plus_ones')
      .select('id, guest_name, user_id, profiles:user_id ( full_name )')
      .eq('event_id', id)
      .order('created_at', { ascending: true }),
    user
      ? svc
          .from('event_plus_ones')
          .select('guest_name, guest_email')
          .eq('event_id', id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  const allPlusOnes = (plusOnesResult.data ?? []).map((p) => {
    const profile = p.profiles as unknown as { full_name: string } | null
    return {
      id: p.id,
      guestName: p.guest_name,
      userId: p.user_id,
      hostName: profile?.full_name ?? 'Member',
    }
  })

  const currentUserPlusOnes = (currentUserPlusOnesResult.data ?? []).map((p) => ({
    name: p.guest_name,
    email: p.guest_email ?? undefined,
  }))

  const plusOneCount = allPlusOnes.length

  // ── Event Chat data ──────────────────────────────────────────────────────
  const serviceClient = svc

  // Fetch (or create) event_chat channel
  let chatChannelId: string | null = null
  let chatInitialMessages: ChatMessage[] = []
  let chatMembers: ChatMember[] = []
  let chatIsAdmin = false
  let chatMutedUntil: string | null = null

  // Compute archive status: 7 days after event ends
  const eventEndsAt = new Date(event.ends_at)
  const chatIsArchived = new Date() >= new Date(eventEndsAt.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Check if user is RSVPd (going or maybe)
  const userRsvp = userRsvpResult.data
  const isRsvped = userRsvp && (userRsvp.status === 'going' || userRsvp.status === 'maybe')

  // Fetch event_chat channel
  let { data: chatChannel } = await serviceClient
    .from('channels')
    .select('id')
    .eq('event_id', event.id)
    .eq('type', 'event_chat')
    .maybeSingle()

  if (!chatChannel) {
    const { data: created } = await serviceClient
      .from('channels')
      .insert({ group_id: event.group_id, event_id: event.id, type: 'event_chat', name: 'Event Chat' })
      .select('id')
      .single()
    chatChannel = created
  }

  if (chatChannel) {
    chatChannelId = chatChannel.id

    // Check if user is admin of the event's group
    if (user) {
      const { data: gmembership } = await serviceClient
        .from('group_members')
        .select('role, muted_until')
        .eq('group_id', event.group_id)
        .eq('user_id', user.id)
        .maybeSingle()

      chatIsAdmin = gmembership?.role === 'super_admin' || gmembership?.role === 'co_admin'
      chatMutedUntil = gmembership?.muted_until ?? null
    }

    // If user is RSVPd, upsert channel_members.last_read_at
    if (user && isRsvped) {
      await serviceClient.from('channel_members').upsert(
        {
          channel_id: chatChannel.id,
          user_id: user.id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: 'channel_id,user_id' }
      )
    }

    // Fetch last 50 messages
    const { data: chatMessages } = await serviceClient
      .from('messages')
      .select('id, sender_id, content, content_type, image_url, is_pinned, edited_at, deleted_at, deleted_by, reply_to_id, created_at, profiles:sender_id ( full_name, avatar_url )')
      .eq('channel_id', chatChannel.id)
      .order('created_at', { ascending: true })
      .limit(50)

    // Collect reply_to_ids to fetch in one query
    const replyToIds = (chatMessages ?? [])
      .map((m) => m.reply_to_id)
      .filter((id): id is string => !!id)
    const uniqueReplyIds = [...new Set(replyToIds)]

    let replyMap: Record<string, { content: string; senderName: string }> = {}
    if (uniqueReplyIds.length > 0) {
      const { data: replyMsgs } = await serviceClient
        .from('messages')
        .select('id, content, profiles:sender_id ( full_name )')
        .in('id', uniqueReplyIds)

      for (const rm of replyMsgs ?? []) {
        const rp = rm.profiles as unknown as { full_name: string }
        replyMap[rm.id] = {
          content: rm.content,
          senderName: rp?.full_name ?? 'Member',
        }
      }
    }

    // Fetch reactions
    const messageIds = (chatMessages ?? []).map((m) => m.id)
    const { data: reactions } = messageIds.length > 0
      ? await serviceClient
          .from('message_reactions')
          .select('message_id, emoji, user_id')
          .in('message_id', messageIds)
      : { data: [] }

    const reactionsByMessage: Record<string, ReactionGroup[]> = {}
    for (const r of reactions ?? []) {
      if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = []
      const grp = reactionsByMessage[r.message_id].find((g) => g.emoji === r.emoji)
      if (grp) {
        grp.count++
        if (user && r.user_id === user.id) grp.reacted = true
      } else {
        reactionsByMessage[r.message_id].push({
          emoji: r.emoji,
          count: 1,
          reacted: user ? r.user_id === user.id : false,
        })
      }
    }

    // Build initial messages
    chatInitialMessages = (chatMessages ?? []).map((m) => {
      const profile = m.profiles as unknown as { full_name: string; avatar_url: string | null } | null
      return {
        id: m.id,
        content: m.content,
        contentType: m.content_type,
        imageUrl: m.image_url,
        isPinned: m.is_pinned,
        editedAt: m.edited_at,
        deletedAt: m.deleted_at,
        deletedBy: m.deleted_by,
        createdAt: m.created_at,
        replyToId: m.reply_to_id,
        replyTo: m.reply_to_id ? replyMap[m.reply_to_id] ?? null : null,
        sender: {
          id: m.sender_id,
          fullName: profile?.full_name ?? 'Member',
          avatarUrl: profile?.avatar_url ?? null,
        },
        reactions: reactionsByMessage[m.id] ?? [],
      }
    })

    // Fetch RSVPd members for the chat members list
    const { data: rsvpMembers } = await serviceClient
      .from('rsvps')
      .select('user_id, profiles:user_id ( full_name, avatar_url )')
      .eq('event_id', event.id)
      .in('status', ['going', 'maybe'])

    chatMembers = (rsvpMembers ?? []).map((r) => {
      const p = r.profiles as unknown as { full_name: string; avatar_url: string | null }
      return {
        id: r.user_id,
        fullName: p?.full_name ?? 'Member',
        avatarUrl: p?.avatar_url ?? null,
      }
    })
  }

  // JSON-LD structured data for SEO
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://rovacrew.com'
  const totalGoing = memberGoingCount + guestGoingCount + plusOneCount
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description ?? undefined,
    startDate: event.starts_at,
    endDate: event.ends_at,
    location: event.location ? { '@type': 'Place', name: event.location } : undefined,
    image: event.cover_url ?? undefined,
    url: `${baseUrl}/events/${event.id}`,
    organizer: {
      '@type': 'Organization',
      name: group.name,
      url: `${baseUrl}/g/${group.slug}`,
    },
    offers: {
      '@type': 'Offer',
      price: event.price_pence ? (event.price_pence / 100).toFixed(2) : '0',
      priceCurrency: 'GBP',
      availability: event.max_capacity && totalGoing >= event.max_capacity
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      url: `${baseUrl}/events/${event.id}`,
    },
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  }

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <EventPageClient
      event={{
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        coverUrl: event.cover_url,
        maxCapacity: event.max_capacity,
        createdBy: event.created_by,
        eventType: event.event_type ?? 'free',
        priceAmount: event.price_amount ?? null,
        totalCost: event.total_cost ?? null,
        minParticipants: event.min_participants ?? null,
        stripePriceId: event.stripe_price_id ?? null,
        paymentType: event.payment_type ?? 'free',
        totalCostPence: event.total_cost_pence ?? null,
        allowGuestRsvp: event.allow_guest_rsvp ?? true,
        pricePence: event.price_pence ?? null,
      }}
      group={{
        id: event.group_id,
        name: group.name,
        slug: group.slug,
        logoUrl: group.logo_url,
        primaryColour: group.primary_colour,
      }}
      initialMemberRsvps={
        (memberRsvps.data ?? []).map((r) => {
          const profile = r.profiles as unknown as { full_name: string; avatar_url: string | null } | null
          return {
            id: r.id,
            userId: r.user_id,
            status: r.status as 'going' | 'maybe',
            createdAt: r.created_at,
            profile: profile ?? { full_name: 'Member', avatar_url: null },
          }
        })
      }
      initialGuestRsvps={
        (guestRsvps.data ?? []).map((r) => ({
          id: r.id,
          firstName: r.first_name,
          lastName: r.last_name,
          status: r.status as 'confirmed',
          createdAt: r.created_at,
        }))
      }
      memberGoingCount={memberGoingCount}
      memberMaybeCount={memberMaybeCount}
      memberNotGoingCount={memberNotGoingCount}
      guestGoingCount={guestGoingCount}
      currentUser={user ? {
        id: user.id,
        fullName: profileResult.data?.full_name ?? user.email?.split('@')[0] ?? 'You',
        avatarUrl: profileResult.data?.avatar_url ?? null,
      } : null}
      currentUserRsvp={
        userRsvpResult.data
          ? { id: userRsvpResult.data.id, status: userRsvpResult.data.status as 'going' | 'maybe' | 'not_going' }
          : null
      }
      organiser={organiserResult.data ? {
        name: organiserResult.data.full_name,
        avatarUrl: organiserResult.data.avatar_url,
      } : null}
      chatChannelId={chatChannelId}
      chatInitialMessages={chatInitialMessages}
      chatMembers={chatMembers}
      chatIsArchived={chatIsArchived}
      chatIsAdmin={chatIsAdmin}
      chatMutedUntil={chatMutedUntil}
      initialPlusOnes={allPlusOnes}
      currentUserPlusOnes={currentUserPlusOnes}
      plusOneCount={plusOneCount}
    />
    </>
  )
}
