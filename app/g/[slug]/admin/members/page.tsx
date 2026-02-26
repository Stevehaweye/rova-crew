import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import MembersListClient from './members-list-client'

export default async function AdminMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/g/${slug}/admin/members`)

  const svc = createServiceClient()

  // Fetch group
  const { data: group } = await svc
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()
  if (!group) redirect('/home')

  // Verify admin
  const { data: membership } = await svc
    .from('group_members')
    .select('role')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .maybeSingle()
  if (!membership || !['super_admin', 'co_admin'].includes(membership.role))
    redirect(`/g/${slug}`)

  // Fetch all approved members with profiles
  const { data: membersRaw } = await svc
    .from('group_members')
    .select('user_id, role, joined_at, profiles ( full_name, avatar_url, email )')
    .eq('group_id', group.id)
    .eq('status', 'approved')
    .order('joined_at', { ascending: true })

  // Fetch pending members
  const { data: pendingRaw } = await svc
    .from('group_members')
    .select('user_id, role, joined_at, profiles ( full_name, avatar_url, email )')
    .eq('group_id', group.id)
    .eq('status', 'pending')
    .order('joined_at', { ascending: true })

  const userIds = (membersRaw ?? []).map((m) => m.user_id)

  // Fetch stats and last activity in parallel
  const [statsResult, spiritActivityResult, groupEventsResult] =
    await Promise.all([
      userIds.length > 0
        ? svc
            .from('member_stats')
            .select('user_id, tier, crew_score, spirit_points_total')
            .eq('group_id', group.id)
            .in('user_id', userIds)
        : Promise.resolve({ data: [] as { user_id: string; tier: string; crew_score: number; spirit_points_total: number }[] }),
      // Latest spirit points log entry per user
      userIds.length > 0
        ? svc
            .from('spirit_points_log')
            .select('user_id, created_at')
            .eq('group_id', group.id)
            .in('user_id', userIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as { user_id: string; created_at: string }[] }),
      // All events for this group
      svc.from('events').select('id').eq('group_id', group.id),
    ])

  const eventIds = (groupEventsResult.data ?? []).map((e) => e.id)

  // Build latest RSVP per user
  const rsvpsByUser: Record<string, string> = {}
  if (eventIds.length > 0 && userIds.length > 0) {
    const { data: rsvps } = await svc
      .from('rsvps')
      .select('user_id, created_at')
      .in('event_id', eventIds)
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
    for (const r of rsvps ?? []) {
      if (!rsvpsByUser[r.user_id]) rsvpsByUser[r.user_id] = r.created_at
    }
  }

  // Latest spirit activity per user
  const spiritByUser: Record<string, string> = {}
  for (const s of spiritActivityResult.data ?? []) {
    if (!spiritByUser[s.user_id]) spiritByUser[s.user_id] = s.created_at
  }

  const statsMap = Object.fromEntries(
    (statsResult.data ?? []).map((s) => [s.user_id, s])
  )

  const members = (membersRaw ?? []).map((m) => {
    const profile = m.profiles as unknown as {
      full_name: string
      avatar_url: string | null
      email: string | null
    }
    const stats = statsMap[m.user_id]
    const rsvpDate = rsvpsByUser[m.user_id]
    const spiritDate = spiritByUser[m.user_id]
    let lastActive: string | null = null
    if (rsvpDate && spiritDate) {
      lastActive = rsvpDate > spiritDate ? rsvpDate : spiritDate
    } else {
      lastActive = rsvpDate || spiritDate || null
    }

    return {
      userId: m.user_id,
      role: m.role,
      joinedAt: m.joined_at,
      fullName: profile?.full_name ?? 'Member',
      avatarUrl: profile?.avatar_url ?? null,
      email: profile?.email ?? null,
      tier: stats?.tier ?? 'newcomer',
      crewScore: stats?.crew_score ?? 0,
      spiritPoints: stats?.spirit_points_total ?? 0,
      lastActive,
    }
  })

  const pendingMembers = (pendingRaw ?? []).map((m) => {
    const profile = m.profiles as unknown as {
      full_name: string
      avatar_url: string | null
      email: string | null
    }
    return {
      userId: m.user_id,
      fullName: profile?.full_name ?? 'Member',
      avatarUrl: profile?.avatar_url ?? null,
      email: profile?.email ?? null,
      requestedAt: m.joined_at,
    }
  })

  return (
    <MembersListClient
      group={{
        id: group.id,
        name: group.name,
        slug: group.slug,
        primaryColour: group.primary_colour,
      }}
      members={members}
      pendingMembers={pendingMembers}
    />
  )
}
