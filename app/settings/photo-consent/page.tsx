import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import PhotoConsentClient from './photo-consent-client'

export default async function PhotoConsentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth?next=/settings/photo-consent')

  const svc = createServiceClient()

  const [membershipsResult, consentResult] = await Promise.all([
    supabase
      .from('group_members')
      .select('group_id, groups ( id, name, slug, logo_url, primary_colour )')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .order('joined_at', { ascending: true }),

    svc
      .from('photo_consent_preferences')
      .select('group_id, consent_level')
      .eq('user_id', user.id),
  ])

  const memberships = membershipsResult.data ?? []

  // Build groups array
  const groups = memberships.map((m) => {
    const g = m.groups as unknown as {
      id: string
      name: string
      slug: string
      logo_url: string | null
      primary_colour: string
    }
    const colour = g.primary_colour?.startsWith('#')
      ? g.primary_colour
      : `#${g.primary_colour ?? '0D7377'}`

    return {
      id: g.id,
      name: g.name,
      slug: g.slug,
      logoUrl: g.logo_url,
      colour,
    }
  })

  // Build consent map: group_id -> consent_level (default: 'always')
  const initialConsent: Record<string, 'always' | 'ask' | 'never'> = {}
  for (const row of consentResult.data ?? []) {
    initialConsent[row.group_id] = row.consent_level ?? 'always'
  }

  return <PhotoConsentClient groups={groups} initialConsent={initialConsent} />
}
