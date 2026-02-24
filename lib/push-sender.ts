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

/**
 * Send a push notification to all devices registered for a user.
 * Expired/invalid subscriptions are automatically cleaned up.
 */
export async function sendPushToUser(
  userId: string,
  notification: PushPayload
): Promise<void> {
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

    console.log(`[push] Cleaned up ${expiredIds.length} expired subscription(s)`)
  }
}

/**
 * Send a push notification to all approved members of a group.
 * Optionally exclude a user (e.g. the sender of a message).
 */
export async function sendPushToGroup(
  groupId: string,
  notification: PushPayload,
  excludeUserId?: string
): Promise<void> {
  const supabase = createServiceClient()

  // Fetch all approved group members' user IDs
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('status', 'approved')

  if (!members || members.length === 0) return

  const userIds = members
    .map((m) => m.user_id)
    .filter((id) => id !== excludeUserId)

  if (userIds.length === 0) return

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

    console.log(`[push] Cleaned up ${expiredIds.length} expired subscription(s)`)
  }
}
