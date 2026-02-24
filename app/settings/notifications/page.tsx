import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import NotificationsClient from './notifications-client'

export default async function NotificationSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?next=/settings/notifications')
  }

  // Fetch current preferences (may not exist yet)
  const svc = createServiceClient()
  const { data: prefs } = await svc
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const defaults = {
    event_reminders: true,
    waitlist_updates: true,
    new_events: true,
    direct_messages: true,
    mentions: true,
    group_chat: true,
    event_chat: true,
    announcements: true,
    rsvp_milestones: true,
  }

  const preferences = prefs
    ? {
        event_reminders: prefs.event_reminders ?? true,
        waitlist_updates: prefs.waitlist_updates ?? true,
        new_events: prefs.new_events ?? true,
        direct_messages: prefs.direct_messages ?? true,
        mentions: prefs.mentions ?? true,
        group_chat: prefs.group_chat ?? true,
        event_chat: prefs.event_chat ?? true,
        announcements: prefs.announcements ?? true,
        rsvp_milestones: prefs.rsvp_milestones ?? true,
      }
    : defaults

  return <NotificationsClient initialPreferences={preferences} />
}
