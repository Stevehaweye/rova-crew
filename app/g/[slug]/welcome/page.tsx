import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { getWarmIntroductions } from '@/lib/warm-introductions'
import WelcomeClient from './welcome-client'

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const svc = createServiceClient()

  // Fetch group
  const { data: group } = await svc
    .from('groups')
    .select('id, name, slug, primary_colour, logo_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) redirect('/home')

  // Verify membership
  const { data: membership } = await svc
    .from('group_members')
    .select('status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .maybeSingle()

  if (!membership) redirect(`/g/${slug}`)

  // Get warm introductions
  const connections = await getWarmIntroductions(user.id, group.id)

  // Get next upcoming event
  const now = new Date().toISOString()
  const { data: nextEvent } = await svc
    .from('events')
    .select('id, title, starts_at, location')
    .eq('group_id', group.id)
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Get user's profile for name
  const { data: profile } = await svc
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const colour = group.primary_colour?.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour ?? '0D7377'}`

  return (
    <WelcomeClient
      group={{
        id: group.id,
        name: group.name,
        slug: group.slug,
        colour,
        logoUrl: group.logo_url,
      }}
      userName={profile?.full_name?.split(' ')[0] ?? 'there'}
      connections={connections}
      nextEvent={
        nextEvent
          ? {
              id: nextEvent.id,
              title: nextEvent.title,
              startsAt: nextEvent.starts_at,
              location: nextEvent.location,
            }
          : null
      }
    />
  )
}
