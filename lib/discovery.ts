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
