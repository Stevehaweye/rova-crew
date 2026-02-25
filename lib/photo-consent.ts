import { createServiceClient } from '@/lib/supabase/service'

/**
 * Check which members have photo consent restrictions ('ask' or 'never').
 * Used by the WOW 7 Summary Card to decide whether to show individual
 * photos/names or only aggregate data.
 */
export async function getConsentRestrictedMembers(
  groupId: string,
  userIds: string[]
): Promise<{
  restricted: string[]
  hasRestrictions: boolean
}> {
  if (userIds.length === 0) {
    return { restricted: [], hasRestrictions: false }
  }

  const svc = createServiceClient()

  const { data: rows } = await svc
    .from('photo_consent_preferences')
    .select('user_id, consent_level')
    .eq('group_id', groupId)
    .in('user_id', userIds)
    .in('consent_level', ['ask', 'never'])

  const restricted = (rows ?? []).map((r) => r.user_id)

  return {
    restricted,
    hasRestrictions: restricted.length > 0,
  }
}

/**
 * Get a single user's consent level for a group.
 * Returns 'always' if no preference row exists (default).
 */
export async function getUserConsentLevel(
  userId: string,
  groupId: string
): Promise<'always' | 'ask' | 'never'> {
  const svc = createServiceClient()

  const { data } = await svc
    .from('photo_consent_preferences')
    .select('consent_level')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .maybeSingle()

  return (data?.consent_level as 'always' | 'ask' | 'never') ?? 'always'
}
