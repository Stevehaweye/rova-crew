import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import GamificationSettingsClient from './gamification-settings-client'

export default async function GamificationSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?next=/settings/gamification')
  }

  const svc = createServiceClient()

  // Fetch user's approved group memberships with group info
  const { data: memberships } = await svc
    .from('group_members')
    .select('group_id, groups!inner(id, name, slug, primary_colour)')
    .eq('user_id', user.id)
    .eq('status', 'approved')

  const groups = (memberships ?? []).map((m) => {
    const g = m.groups as unknown as { id: string; name: string; slug: string; primary_colour: string | null }
    const colour = g.primary_colour?.startsWith('#')
      ? g.primary_colour
      : `#${g.primary_colour ?? '0D7377'}`
    return {
      id: g.id,
      name: g.name,
      slug: g.slug,
      colour,
    }
  })

  // Fetch all gamification prefs for this user
  const { data: prefsRows } = await svc
    .from('member_gamification_prefs')
    .select('group_id, hide_from_board, private_crew_score, mute_badge_announcements, mute_gamification_push')
    .eq('user_id', user.id)

  const defaults = {
    hide_from_board: false,
    private_crew_score: false,
    mute_badge_announcements: false,
    mute_gamification_push: false,
  }

  // Build prefs map keyed by group_id
  const prefsMap: Record<string, typeof defaults> = {}
  for (const group of groups) {
    const row = prefsRows?.find((r) => r.group_id === group.id)
    prefsMap[group.id] = row
      ? {
          hide_from_board: row.hide_from_board ?? false,
          private_crew_score: row.private_crew_score ?? false,
          mute_badge_announcements: row.mute_badge_announcements ?? false,
          mute_gamification_push: row.mute_gamification_push ?? false,
        }
      : { ...defaults }
  }

  return <GamificationSettingsClient groups={groups} initialPrefs={prefsMap} />
}
