import { createServiceClient } from '@/lib/supabase/service'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  company_id: string | null
  work_location: string | null
  department: string | null
}

interface ScopeRow {
  group_id: string
  scope_type: string
  company_id: string | null
  scope_location: string | null
  scope_department: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalise(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim()
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Returns group IDs visible to this user, respecting scope.
 * Used by discover page and home feed.
 *
 * Returns `null` when no filtering is needed (user has no company,
 * so they only see public groups — the caller should apply its own
 * `is_public = true` filter in that case).
 */
export async function getVisibleGroupIds(
  profile: UserProfile
): Promise<string[] | null> {
  // Users without a company see only public groups — no scope filtering needed
  if (!profile.company_id) return null

  const svc = createServiceClient()

  // Fetch all scope rows for this company in one query
  const { data: scopes } = await svc
    .from('group_scope')
    .select('group_id, scope_type, company_id, scope_location, scope_department')
    .eq('company_id', profile.company_id)

  const visibleIds: string[] = []

  for (const s of (scopes ?? []) as ScopeRow[]) {
    switch (s.scope_type) {
      case 'company':
        // Company-wide — every employee sees it
        visibleIds.push(s.group_id)
        break

      case 'location':
        if (
          profile.work_location &&
          s.scope_location &&
          normalise(profile.work_location) === normalise(s.scope_location)
        ) {
          visibleIds.push(s.group_id)
        }
        break

      case 'department':
        if (
          profile.department &&
          s.scope_department &&
          normalise(profile.department) === normalise(s.scope_department)
        ) {
          visibleIds.push(s.group_id)
        }
        break

      case 'loc_dept':
        if (
          profile.work_location &&
          profile.department &&
          s.scope_location &&
          s.scope_department &&
          normalise(profile.work_location) === normalise(s.scope_location) &&
          normalise(profile.department) === normalise(s.scope_department)
        ) {
          visibleIds.push(s.group_id)
        }
        break

      // 'invitation' scopes are never surfaced in discovery
      default:
        break
    }
  }

  return visibleIds
}

/**
 * Returns company-scoped group IDs that the user can see but hasn't joined.
 * Useful for "Suggested groups" sections on the home page.
 */
export async function getCompanyGroupSuggestions(
  profile: UserProfile,
  joinedGroupIds: string[],
  limit = 4
): Promise<string[]> {
  const visibleIds = await getVisibleGroupIds(profile)
  if (!visibleIds) return []

  const joinedSet = new Set(joinedGroupIds)
  return visibleIds.filter((id) => !joinedSet.has(id)).slice(0, limit)
}

// ─── Access Checks ─────────────────────────────────────────────────────────

/**
 * Check whether a user can access a specific group based on its scope.
 * Used by API route guards (RSVP, checkout, flyer, etc.).
 *
 * Rules:
 * 1. No group_scope row → truly public → allow
 * 2. scope_type = 'public' → allow
 * 3. No userId (unauthenticated) → deny
 * 4. User is approved member of the group → allow
 * 5. User's company/location/department matches scope → allow
 * 6. Otherwise → deny
 */
export async function canAccessGroup(
  groupId: string,
  userId: string | null
): Promise<boolean> {
  const svc = createServiceClient()

  const { data: scopeRow } = await svc
    .from('group_scope')
    .select('scope_type, company_id, scope_location, scope_department')
    .eq('group_id', groupId)
    .maybeSingle()

  // No scope row or public scope → truly public
  if (!scopeRow || scopeRow.scope_type === 'public') return true

  // Enterprise-scoped but no user
  if (!userId) return false

  // Approved members always get access
  const { data: membership } = await svc
    .from('group_members')
    .select('status')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (membership?.status === 'approved') return true

  // Check company scope match
  const { data: profile } = await svc
    .from('profiles')
    .select('company_id, work_location, department')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || profile.company_id !== scopeRow.company_id) return false

  switch (scopeRow.scope_type) {
    case 'company':
      return true
    case 'location':
      return !!(
        profile.work_location && scopeRow.scope_location &&
        normalise(profile.work_location) === normalise(scopeRow.scope_location)
      )
    case 'department':
      return !!(
        profile.department && scopeRow.scope_department &&
        normalise(profile.department) === normalise(scopeRow.scope_department)
      )
    case 'loc_dept':
      return !!(
        profile.work_location && profile.department &&
        scopeRow.scope_location && scopeRow.scope_department &&
        normalise(profile.work_location) === normalise(scopeRow.scope_location) &&
        normalise(profile.department) === normalise(scopeRow.scope_department)
      )
    default:
      return false
  }
}

/**
 * Given an array of group IDs, return the subset that have NO
 * enterprise scope (i.e. truly public groups).
 * Used by listing pages to strip enterprise groups from public results.
 */
export async function filterPublicGroupIds(groupIds: string[]): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set()

  const svc = createServiceClient()
  const { data: scopedRows } = await svc
    .from('group_scope')
    .select('group_id')
    .in('group_id', groupIds)

  const scopedIds = new Set((scopedRows ?? []).map((r: { group_id: string }) => r.group_id))
  return new Set(groupIds.filter((id) => !scopedIds.has(id)))
}
