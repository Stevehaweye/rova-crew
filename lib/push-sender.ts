import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

// Configure VAPID credentials
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:hello@rova-crew.com'
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export interface PushPayload {
  title: string
  body: string
  url: string
  icon?: string
}

// Maps notificationType values to user_notification_preferences column names
const NOTIFICATION_TYPE_TO_PREF: Record<string, string> = {
  event_reminder: 'event_reminders',
  waitlist: 'waitlist_updates',
  new_event: 'new_events',
  dm: 'direct_messages',
  mention: 'mentions',
  group_chat: 'group_chat',
  event_chat: 'event_chat',
  announcement: 'announcements',
  rsvp_milestone: 'rsvp_milestones',
  tier_promotion: 'tier_promotions',
  badge_celebration: 'badge_celebrations',
  health_alert: 'health_alerts',
}

/**
 * Check if a user has a specific notification preference enabled.
 * Returns true by default (if no row exists, all prefs are on).
 */
async function isPreferenceEnabled(
  userId: string,
  notificationType: string
): Promise<boolean> {
  const prefColumn = NOTIFICATION_TYPE_TO_PREF[notificationType]
  if (!prefColumn) return true // Unknown type — allow by default

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('user_notification_preferences')
    .select(prefColumn)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return true // No row means all defaults (true)
  return (data as unknown as Record<string, boolean>)[prefColumn] !== false
}

/**
 * Send a push notification to all devices registered for a user.
 * Expired/invalid subscriptions are automatically cleaned up.
 * When notificationType is provided, checks user preferences first.
 */
export async function sendPushToUser(
  userId: string,
  notification: PushPayload,
  notificationType?: string
): Promise<void> {
  // Check user preference before sending
  if (notificationType) {
    const enabled = await isPreferenceEnabled(userId, notificationType)
    if (!enabled) return
  }

  const supabase = createServiceClient()

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subscriptions || subscriptions.length === 0) return

  const payload = JSON.stringify(notification)
  const expiredIds: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired or invalid — mark for cleanup
          expiredIds.push(sub.id)
        } else {
          console.error(`[push] Failed to send to ${sub.endpoint.slice(0, 50)}...:`, err)
        }
      }
    })
  )

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds)

  }
}

/**
 * Send a push notification to all approved members of a group.
 * Optionally exclude a user (e.g. the sender of a message).
 * When notificationType is provided, filters out users who disabled that preference.
 */
export async function sendPushToGroup(
  groupId: string,
  notification: PushPayload,
  excludeUserId?: string,
  notificationType?: string
): Promise<void> {
  const supabase = createServiceClient()

  // Fetch all approved group members' user IDs
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('status', 'approved')

  if (!members || members.length === 0) return

  let userIds = members
    .map((m) => m.user_id)
    .filter((id) => id !== excludeUserId)

  if (userIds.length === 0) return

  // Batch-filter by preferences
  if (notificationType) {
    const prefColumn = NOTIFICATION_TYPE_TO_PREF[notificationType]
    if (prefColumn) {
      const { data: disabledPrefs } = await supabase
        .from('user_notification_preferences')
        .select('user_id')
        .in('user_id', userIds)
        .eq(prefColumn, false)

      if (disabledPrefs && disabledPrefs.length > 0) {
        const disabledSet = new Set(disabledPrefs.map((p) => p.user_id))
        userIds = userIds.filter((id) => !disabledSet.has(id))
        if (userIds.length === 0) return
      }
    }
  }

  // Batch fetch all subscriptions for these users
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (!subscriptions || subscriptions.length === 0) return

  const payload = JSON.stringify(notification)
  const expiredIds: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          expiredIds.push(sub.id)
        } else {
          console.error(`[push] Failed to send to ${sub.endpoint.slice(0, 50)}...:`, err)
        }
      }
    })
  )

  if (expiredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds)

  }
}
