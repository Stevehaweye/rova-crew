import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push-sender'
import { checkAndAwardBadges } from '@/lib/badges'

// ─── updateStreakOnCheckIn ──────────────────────────────────────────────────

export async function updateStreakOnCheckIn(
  userId: string,
  groupId: string,
  eventId: string
): Promise<void> {
  const svc = createServiceClient()

  // Parallel fetch
  const [eventResult, statsResult, groupResult] = await Promise.all([
    svc
      .from('events')
      .select('id, starts_at')
      .eq('id', eventId)
      .single(),
    svc
      .from('member_stats')
      .select('last_attended_event_id, current_streak, best_streak, events_attended')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .maybeSingle(),
    svc
      .from('groups')
      .select('name, slug')
      .eq('id', groupId)
      .single(),
  ])

  const event = eventResult.data
  const stats = statsResult.data
  const group = groupResult.data

  if (!event || !group) return

  const currentStreak = stats?.current_streak ?? 0
  const bestStreak = stats?.best_streak ?? 0
  const eventsAttended = stats?.events_attended ?? 0
  const lastAttendedEventId = stats?.last_attended_event_id

  let newStreak: number

  if (!lastAttendedEventId) {
    // First ever check-in for this member in this group
    newStreak = 1
  } else {
    // Get the last attended event's start time
    const { data: lastEvent } = await svc
      .from('events')
      .select('starts_at')
      .eq('id', lastAttendedEventId)
      .single()

    if (!lastEvent) {
      newStreak = 1
    } else {
      // Check if any group events occurred between last attended and this one
      const { data: eventsBetween } = await svc
        .from('events')
        .select('id')
        .eq('group_id', groupId)
        .gt('starts_at', lastEvent.starts_at)
        .lt('starts_at', event.starts_at)
        .limit(1)

      if (eventsBetween && eventsBetween.length > 0) {
        // Events occurred in between that they missed — streak broken
        newStreak = 1
      } else {
        // No events in between — streak continues
        newStreak = currentStreak + 1
      }
    }
  }

  const newBest = Math.max(bestStreak, newStreak)
  const nowISO = new Date().toISOString()

  // Update member_stats
  await svc.from('member_stats').upsert(
    {
      user_id: userId,
      group_id: groupId,
      current_streak: newStreak,
      best_streak: newBest,
      last_attended_event_id: eventId,
      last_attended_at: nowISO,
      events_attended: eventsAttended + 1,
    },
    { onConflict: 'user_id,group_id' }
  )

  // Check and award streak badges
  checkAndAwardBadges(userId, groupId).catch((err) =>
    console.error('[streaks] badge check error:', err)
  )

  // Streak celebration push
  if (shouldCelebrate(newStreak)) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    sendPushToUser(
      userId,
      {
        title: `${newStreak}-event streak!`,
        body: `You\u2019ve attended ${newStreak} events in a row in ${group.name}. Keep it going!`,
        url: `${appUrl}/g/${group.slug}`,
      },
      'event_reminder'
    ).catch(() => {})
  }
}

/** Celebrate at multiples of 3 (>=3) or multiples of 5 (>=5) */
function shouldCelebrate(streak: number): boolean {
  if (streak < 3) return false
  if (streak % 3 === 0) return true
  if (streak >= 5 && streak % 5 === 0) return true
  return false
}

// ─── checkStreakBreaks ──────────────────────────────────────────────────────

export async function checkStreakBreaks(
  eventId: string,
  groupId: string
): Promise<void> {
  const svc = createServiceClient()

  // Fetch event info
  const { data: event } = await svc
    .from('events')
    .select('id, title, group_id, groups ( name, slug )')
    .eq('id', eventId)
    .single()

  if (!event) return

  const group = event.groups as unknown as { name: string; slug: string }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Find members who RSVPd 'going' but did NOT check in
  const { data: missedRsvps } = await svc
    .from('rsvps')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('status', 'going')
    .is('checked_in_at', null)

  if (!missedRsvps || missedRsvps.length === 0) return

  // Fetch their current streaks
  const userIds = missedRsvps.map((r) => r.user_id)
  const { data: statsRows } = await svc
    .from('member_stats')
    .select('user_id, current_streak')
    .eq('group_id', groupId)
    .in('user_id', userIds)
    .gt('current_streak', 0)

  if (!statsRows || statsRows.length === 0) return

  // Find next upcoming event for recovery link
  const { data: nextEvent } = await svc
    .from('events')
    .select('id, title')
    .eq('group_id', groupId)
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Process each member with a broken streak
  const CHUNK_SIZE = 10
  for (let i = 0; i < statsRows.length; i += CHUNK_SIZE) {
    const chunk = statsRows.slice(i, i + CHUNK_SIZE)
    await Promise.all(
      chunk.map(async (member) => {
        const streak = member.current_streak

        // Reset streak to 0
        await svc
          .from('member_stats')
          .update({ current_streak: 0 })
          .eq('user_id', member.user_id)
          .eq('group_id', groupId)

        // Only send WOW 11 recovery notification if they had a meaningful streak
        if (streak >= 3) {
          let body: string
          let url: string

          if (nextEvent) {
            body = `Your ${streak}-event streak ended \u2014 but ${nextEvent.title} is coming up. One RSVP and you\u2019re back.`
            url = `${appUrl}/events/${nextEvent.id}`
          } else {
            body = `Your ${streak}-event streak ended \u2014 but there\u2019s always next time. You\u2019ve got this.`
            url = `${appUrl}/g/${group.slug}`
          }

          sendPushToUser(
            member.user_id,
            {
              title: `Missed ${event.title}? No worries.`,
              body,
              url,
            },
            'event_reminder'
          ).catch(() => {})
        }
      })
    )
  }
}
