import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push-sender'

const MILESTONES = [5, 10, 15, 20, 25, 50]

function isMilestone(count: number): boolean {
  if (MILESTONES.includes(count)) return true
  if (count > 50 && count % 25 === 0) return true
  return false
}

export async function checkRsvpMilestone(
  eventId: string,
  groupId: string,
  newGoingCount: number,
  maxCapacity: number | null,
  rsvpingUserId: string
): Promise<void> {
  const justBecameFull = maxCapacity !== null && newGoingCount >= maxCapacity
  const hitMilestone = isMilestone(newGoingCount)

  if (!hitMilestone && !justBecameFull) return

  const svc = createServiceClient()

  const { data: event } = await svc
    .from('events')
    .select('title, group_id, groups ( name, slug )')
    .eq('id', eventId)
    .single()

  if (!event) return

  const group = event.groups as unknown as { name: string; slug: string }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const eventUrl = `${appUrl}/events/${eventId}`

  // Get event_chat channel
  const { data: chatChannel } = await svc
    .from('channels')
    .select('id')
    .eq('event_id', eventId)
    .eq('type', 'event_chat')
    .maybeSingle()

  let messageContent: string
  let pushBody: string

  if (justBecameFull) {
    messageContent = `Event is full — ${newGoingCount} people going!`
    pushBody = `${newGoingCount} people are going to ${event.title}! Event is now full.`
  } else {
    messageContent = `🎉 ${newGoingCount} people are going to ${event.title}! Who else is joining?`
    pushBody = `${newGoingCount} people are going to ${event.title}! Are you coming? →`
  }

  // 1. Post system message to event_chat channel
  if (chatChannel) {
    await svc.from('messages').insert({
      channel_id: chatChannel.id,
      sender_id: rsvpingUserId,
      content: messageContent,
      content_type: 'system',
    })
  }

  // 2. Push notification to group members who haven't RSVPd
  const { data: rsvps } = await svc
    .from('rsvps')
    .select('user_id')
    .eq('event_id', eventId)

  const rsvpdIds = new Set((rsvps ?? []).map((r) => r.user_id))

  const { data: members } = await svc
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('status', 'approved')

  if (!members) return

  const nonRsvpd = members.filter((m) => !rsvpdIds.has(m.user_id))

  await Promise.allSettled(
    nonRsvpd.map((m) =>
      sendPushToUser(m.user_id, {
        title: group.name,
        body: pushBody,
        url: eventUrl,
      }).catch((err) => console.error('[milestone] push error:', err))
    )
  )
}
