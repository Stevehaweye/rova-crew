import { createServiceClient } from '@/lib/supabase/service'

export interface WarmConnection {
  userId: string
  fullName: string
  avatarUrl: string | null
  type: 'mutual' | 'interest'
  context: string
}

export async function getWarmIntroductions(
  newUserId: string,
  newGroupId: string
): Promise<WarmConnection[]> {
  const svc = createServiceClient()

  // Get all members of the new group (excluding the new user)
  const { data: groupMembers } = await svc
    .from('group_members')
    .select('user_id')
    .eq('group_id', newGroupId)
    .eq('status', 'approved')
    .neq('user_id', newUserId)

  if (!groupMembers || groupMembers.length === 0) return []

  const memberIds = groupMembers.map(m => m.user_id)

  // Find mutual connections: members who share OTHER groups with the new user
  const { data: newUserGroups } = await svc
    .from('group_members')
    .select('group_id, groups ( name )')
    .eq('user_id', newUserId)
    .eq('status', 'approved')
    .neq('group_id', newGroupId)

  const newUserGroupIds = (newUserGroups ?? []).map(g => g.group_id)

  let mutualConnections: WarmConnection[] = []
  if (newUserGroupIds.length > 0) {
    // Find group members who are also in the new user's other groups
    const { data: sharedMembers } = await svc
      .from('group_members')
      .select('user_id, group_id, groups ( name )')
      .in('group_id', newUserGroupIds)
      .in('user_id', memberIds)
      .eq('status', 'approved')

    // Deduplicate by user_id, keep first shared group as context
    const seen = new Set<string>()
    for (const sm of sharedMembers ?? []) {
      if (seen.has(sm.user_id)) continue
      seen.add(sm.user_id)
      const groupName = (sm.groups as unknown as { name: string })?.name ?? 'another group'

      // Fetch profile
      const { data: profile } = await svc
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', sm.user_id)
        .single()

      if (profile) {
        mutualConnections.push({
          userId: sm.user_id,
          fullName: profile.full_name ?? 'Member',
          avatarUrl: profile.avatar_url,
          type: 'mutual',
          context: `Also in ${groupName}`,
        })
      }
    }
  }

  // Return up to 3 mutual connections
  if (mutualConnections.length > 0) {
    return mutualConnections.slice(0, 3)
  }

  // Fallback: interest-based matching
  const { data: newUserProfile } = await svc
    .from('profiles')
    .select('full_name, interests')
    .eq('id', newUserId)
    .single()

  const userInterests: string[] = (newUserProfile as Record<string, unknown>)?.interests as string[] ?? []

  if (userInterests.length === 0) return []

  // Find members with overlapping interests
  const interestMatches: WarmConnection[] = []
  for (const memberId of memberIds.slice(0, 20)) {
    const { data: memberProfile } = await svc
      .from('profiles')
      .select('full_name, avatar_url, interests')
      .eq('id', memberId)
      .single()

    const memberInterests: string[] = (memberProfile as Record<string, unknown>)?.interests as string[] ?? []
    const shared = userInterests.filter(i => memberInterests.includes(i))

    if (shared.length > 0 && memberProfile) {
      interestMatches.push({
        userId: memberId,
        fullName: memberProfile.full_name ?? 'Member',
        avatarUrl: memberProfile.avatar_url,
        type: 'interest',
        context: `Shares interest in ${shared[0]}`,
      })
    }
    if (interestMatches.length >= 2) break
  }

  return interestMatches
}
