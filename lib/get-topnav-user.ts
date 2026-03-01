import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isPlatformAdmin } from '@/lib/platform-admin'
import type { TopNavUser } from '@/components/TopNav'

/**
 * Fetch user data needed for the shared TopNav component.
 * Use this in server pages that don't already fetch profile data.
 * If the page already fetches profile/company data, build TopNavUser inline instead.
 */
export async function getTopNavUser(): Promise<TopNavUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const svc = createServiceClient()

  const [profileResult, membershipResult] = await Promise.all([
    svc
      .from('profiles')
      .select('full_name, avatar_url, company_id')
      .eq('id', user.id)
      .maybeSingle(),
    svc
      .from('group_members')
      .select('groups ( slug )')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle(),
  ])

  const profile = profileResult.data
  const fullName = profile?.full_name ?? user.email?.split('@')[0] ?? 'User'
  const initials = fullName
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
  const groupSlug =
    (membershipResult.data?.groups as unknown as { slug: string })?.slug ?? null

  let companySlug: string | null = null
  let companyName: string | null = null
  if (profile?.company_id) {
    const { data: company } = await svc
      .from('companies')
      .select('slug, name')
      .eq('id', profile.company_id)
      .maybeSingle()
    if (company) {
      companySlug = company.slug
      companyName = company.name
    }
  }

  return {
    name: fullName,
    avatarUrl: profile?.avatar_url ?? null,
    initials,
    groupSlug,
    isAdmin: isPlatformAdmin(user.email),
    companySlug,
    companyName,
  }
}
