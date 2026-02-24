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

  // Parallel fetches: RSVP counts, initial RSVPs, guest RSVPs, user's RSVP, user profile
  const [
    memberRsvpCount,
    guestRsvpCount,
    memberRsvps,
    guestRsvps,
    userRsvpResult,
    profileResult,
    organiserResult,
  ] = await Promise.all([
    // Member RSVP count (going + maybe)
    supabase
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .in('status', ['going', 'maybe']),

    // Guest RSVP count (confirmed)
    supabase
      .from('guest_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'confirmed'),

    // Member RSVPs with profiles (limit 20)
    supabase
      .from('rsvps')
      .select('id, user_id, status, created_at, profiles ( full_name, avatar_url )')
      .eq('event_id', id)
      .in('status', ['going', 'maybe'])
      .order('created_at', { ascending: true })
      .limit(20),

    // Guest RSVPs (limit 20)
    supabase
      .from('guest_rsvps')
      .select('id, first_name, last_name, email, status, created_at')
      .eq('event_id', id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true })
      .limit(20),

    // Current user's RSVP (if logged in)
    user
      ? supabase
          .from('rsvps')
          .select('id, status')
          .eq('event_id', id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Current user's profile (if logged in)
    user
      ? supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Event organiser profile
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', event.created_by)
      .maybeSingle(),
  ])

  const memberGoingCount = memberRsvpCount.count ?? 0
  const guestGoingCount = guestRsvpCount.count ?? 0

  // ── Event Chat data ──────────────────────────────────────────────────────
  const serviceClient = createServiceClient()

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

  return (
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
    />
  )
}
