import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import GamificationClient from './gamification-client'

export default async function GamificationPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/g/${slug}/admin/gamification`)

  // Fetch group
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) redirect('/home')

  // Role check
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'super_admin' || membership.role === 'co_admin')

  if (!isAdmin) redirect(`/g/${slug}`)

  const colour = group.primary_colour?.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour ?? '0D7377'}`

  // Fetch gamification settings
  const serviceClient = createServiceClient()
  const { data: settings } = await serviceClient
    .from('groups')
    .select('board_monthly_enabled, board_alltime_enabled, board_spirit_enabled, board_streak_enabled, crew_score_visible, badge_announcements_enabled, hall_of_fame_visibility, tier_theme, custom_tier_names')
    .eq('id', group.id)
    .single()

  return (
    <GamificationClient
      group={{
        id: group.id,
        name: group.name,
        slug: group.slug,
        colour,
      }}
      settings={{
        boardMonthly: settings?.board_monthly_enabled ?? true,
        boardAlltime: settings?.board_alltime_enabled ?? false,
        boardSpirit: settings?.board_spirit_enabled ?? true,
        boardStreak: settings?.board_streak_enabled ?? false,
        crewScoreVisible: settings?.crew_score_visible ?? true,
        badgeAnnouncements: settings?.badge_announcements_enabled ?? true,
        hallOfFameVisibility: (settings?.hall_of_fame_visibility as string) ?? 'members_only',
        tierTheme: (settings?.tier_theme as string) ?? 'generic',
        customTierNames: (settings?.custom_tier_names as string[] | null) ?? null,
      }}
    />
  )
}
