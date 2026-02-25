import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push-sender'
import { sendReminderEmail } from '@/lib/email'
import { checkStreakBreaks } from '@/lib/streaks'

interface JobResult {
  jobId: string
  reminderType: string
  recipientCount: number
}

export async function processReminderJobs(): Promise<JobResult[]> {
  const supabase = createServiceClient()
  const results: JobResult[] = []

  // Fetch pending jobs that are due
  const { data: jobs, error: jobsErr } = await supabase
    .from('reminder_jobs')
    .select('id, event_id, reminder_type, scheduled_for')
    .is('sent_at', null)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (jobsErr || !jobs || jobs.length === 0) {
    if (jobsErr) console.error('[reminders] fetch error:', jobsErr)
    return results
  }

  for (const job of jobs) {
    try {
      const count = await processJob(supabase, job)
      results.push({
        jobId: job.id,
        reminderType: job.reminder_type,
        recipientCount: count,
      })

      // Mark job as sent
      await supabase
        .from('reminder_jobs')
        .update({ sent_at: new Date().toISOString(), recipient_count: count })
        .eq('id', job.id)
    } catch (err) {
      console.error(`[reminders] failed to process job ${job.id}:`, err)
    }
  }

  return results
}

async function processJob(
  supabase: ReturnType<typeof createServiceClient>,
  job: { id: string; event_id: string; reminder_type: string }
): Promise<number> {
  // Fetch event + group
  const { data: event } = await supabase
    .from('events')
    .select('id, title, starts_at, ends_at, location, group_id, groups ( name, slug )')
    .eq('id', job.event_id)
    .single()

  if (!event) {
    console.warn(`[reminders] event ${job.event_id} not found, skipping job ${job.id}`)
    return 0
  }

  const group = event.groups as unknown as { name: string; slug: string }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const eventUrl = `${appUrl}/events/${event.id}`
  const startDate = new Date(event.starts_at)
  const endDate = event.ends_at ? new Date(event.ends_at) : startDate
  const eventDate = format(startDate, 'EEEE d MMMM yyyy')
  const eventTime = `${format(startDate, 'h:mm a')} – ${format(endDate, 'h:mm a')}`

  switch (job.reminder_type) {
    case '7day':
      return send7dayReminder(supabase, event, group, eventUrl, eventDate, eventTime)
    case '48h_rsvpd':
      return send48hRsvpdReminder(supabase, event, group, eventUrl, eventDate, eventTime)
    case '48h_not_rsvpd':
      return send48hNotRsvpdReminder(supabase, event, group, eventUrl)
    case '2h':
      return send2hReminder(supabase, event, eventUrl, eventTime)
    case 'post_event':
      return sendPostEventReminder(supabase, event, eventUrl)
    default:
      console.warn(`[reminders] unknown type: ${job.reminder_type}`)
      return 0
  }
}

// ── 7-day reminder: push + email to RSVPd users ─────────────────────────────

async function send7dayReminder(
  supabase: ReturnType<typeof createServiceClient>,
  event: { id: string; title: string; location: string },
  group: { name: string; slug: string },
  eventUrl: string,
  eventDate: string,
  eventTime: string
): Promise<number> {
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('user_id, profiles:user_id ( full_name, email )')
    .eq('event_id', event.id)
    .in('status', ['going', 'maybe'])

  if (!rsvps || rsvps.length === 0) return 0

  await Promise.allSettled(
    rsvps.map(async (rsvp) => {
      const profile = rsvp.profiles as unknown as { full_name: string; email: string | null } | null

      sendPushToUser(rsvp.user_id, {
        title: `${event.title} is in 1 week`,
        body: `${eventDate} with ${group.name}`,
        url: eventUrl,
      }, 'event_reminder').catch((err) => console.error('[reminders] push error:', err))

      if (profile?.email) {
        sendReminderEmail({
          recipientEmail: profile.email,
          recipientName: profile.full_name || 'there',
          eventTitle: event.title,
          eventDate,
          eventTime,
          eventLocation: event.location,
          eventUrl,
          groupName: group.name,
          reminderType: '7day',
        }).catch((err) => console.error('[reminders] email error:', err))
      }
    })
  )

  return rsvps.length
}

// ── 48h RSVPd: push + email ─────────────────────────────────────────────────

async function send48hRsvpdReminder(
  supabase: ReturnType<typeof createServiceClient>,
  event: { id: string; title: string; location: string },
  group: { name: string; slug: string },
  eventUrl: string,
  eventDate: string,
  eventTime: string
): Promise<number> {
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('user_id, profiles:user_id ( full_name, email )')
    .eq('event_id', event.id)
    .in('status', ['going', 'maybe'])

  if (!rsvps || rsvps.length === 0) return 0

  await Promise.allSettled(
    rsvps.map(async (rsvp) => {
      const profile = rsvp.profiles as unknown as { full_name: string; email: string | null } | null

      sendPushToUser(rsvp.user_id, {
        title: `${event.title} is in 2 days`,
        body: `${eventDate} with ${group.name}`,
        url: eventUrl,
      }, 'event_reminder').catch((err) => console.error('[reminders] push error:', err))

      if (profile?.email) {
        sendReminderEmail({
          recipientEmail: profile.email,
          recipientName: profile.full_name || 'there',
          eventTitle: event.title,
          eventDate,
          eventTime,
          eventLocation: event.location,
          eventUrl,
          groupName: group.name,
          reminderType: '48h_rsvpd',
        }).catch((err) => console.error('[reminders] email error:', err))
      }
    })
  )

  return rsvps.length
}

// ── 48h not RSVPd: push only to group members who haven't RSVPd ─────────────

async function send48hNotRsvpdReminder(
  supabase: ReturnType<typeof createServiceClient>,
  event: { id: string; title: string; group_id: string },
  group: { name: string },
  eventUrl: string
): Promise<number> {
  // Get all RSVPd user IDs for this event
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('user_id')
    .eq('event_id', event.id)

  const rsvpdIds = new Set((rsvps ?? []).map((r) => r.user_id))

  // Get all approved group members
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', event.group_id)
    .eq('status', 'approved')

  if (!members || members.length === 0) return 0

  const nonRsvpd = members.filter((m) => !rsvpdIds.has(m.user_id))
  if (nonRsvpd.length === 0) return 0

  await Promise.allSettled(
    nonRsvpd.map((m) =>
      sendPushToUser(m.user_id, {
        title: `Haven't RSVPd yet?`,
        body: `${event.title} is in 2 days — RSVP with ${group.name}`,
        url: eventUrl,
      }, 'event_reminder').catch((err) => console.error('[reminders] push error:', err))
    )
  )

  return nonRsvpd.length
}

// ── 2h before: push only to RSVPd users ─────────────────────────────────────

async function send2hReminder(
  supabase: ReturnType<typeof createServiceClient>,
  event: { id: string; title: string; location: string },
  eventUrl: string,
  eventTime: string
): Promise<number> {
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('user_id')
    .eq('event_id', event.id)
    .in('status', ['going', 'maybe'])

  if (!rsvps || rsvps.length === 0) return 0

  await Promise.allSettled(
    rsvps.map((rsvp) =>
      sendPushToUser(rsvp.user_id, {
        title: `${event.title} starts in 2 hours`,
        body: `${eventTime}${event.location ? ` at ${event.location}` : ''}`,
        url: eventUrl,
      }, 'event_reminder').catch((err) => console.error('[reminders] push error:', err))
    )
  )

  return rsvps.length
}

// ── Post-event: push to checked-in attendees ────────────────────────────────

async function sendPostEventReminder(
  supabase: ReturnType<typeof createServiceClient>,
  event: { id: string; title: string; group_id: string },
  eventUrl: string
): Promise<number> {
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('user_id')
    .eq('event_id', event.id)
    .not('checked_in_at', 'is', null)

  if (!rsvps || rsvps.length === 0) return 0

  await Promise.allSettled(
    rsvps.map((rsvp) =>
      sendPushToUser(rsvp.user_id, {
        title: `How was ${event.title}? 🌟`,
        body: `Rate the event and upload your photos — takes 30 seconds.`,
        url: `/events/${event.id}/rate`,
      }, 'event_reminder').catch((err) => console.error('[reminders] push error:', err))
    )
  )

  // Check for streak breaks (fire-and-forget)
  checkStreakBreaks(event.id, event.group_id)
    .catch((err) => console.error('[reminders] streak break check error:', err))

  return rsvps.length
}
