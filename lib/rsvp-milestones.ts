import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push-sender'

const MILESTONES = [5, 10, 15, 20, 25, 50]
// Sentinel value stored in events.milestones_fired[] to indicate the "sold out"
// notification has already been sent. Distinct from any real RSVP-count
// milestone so it can never collide.
const SOLD_OUT_MARKER = -1

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

  // Read existing fired markers so we can dedupe.
  const { data: event } = await svc
    .from('events')
    .select('title, group_id, milestones_fired, groups ( name, slug )')
    .eq('id', eventId)
    .single()

  if (!event) return

  const alreadyFired = new Set<number>(event.milestones_fired ?? [])
  const marker = justBecameFull ? SOLD_OUT_MARKER : newGoingCount

  if (alreadyFired.has(marker)) return

  // Reserve the marker BEFORE sending push/message so two concurrent RSVPs
  // that both cross the same threshold can't both win.
  const nextFired = [...alreadyFired, marker]
  const { data: reserved, error: reserveErr } = await svc
    .from('events')
    .update({ milestones_fired: nextFired })
    .eq('id', eventId)
    .not('milestones_fired', 'cs', `{${marker}}`)
    .select('id')

  if (reserveErr) {
    console.error('[milestone] reserve error:', reserveErr)
    return
  }
  if (!reserved || reserved.length === 0) {
    // Another concurrent call already reserved this milestone.
    return
  }

  const group = event.groups as unknown as { name: string; slug: string }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const eventUrl = `${appUrl}/events/${eventId}`

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

  if (chatChannel) {
    await svc.from('messages').insert({
      channel_id: chatChannel.id,
      sender_id: rsvpingUserId,
      content: messageContent,
      content_type: 'system',
    })
  }

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
      }, 'rsvp_milestone').catch((err) => console.error('[milestone] push error:', err))
    )
  )
}
