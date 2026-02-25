import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import PhotosClient from './photos-client'

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/events/${eventId}/photos`)

  const svc = createServiceClient()

  // Fetch event + group
  const { data: event } = await svc
    .from('events')
    .select('id, title, group_id, groups ( id, name, slug, primary_colour )')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) redirect('/home')

  const group = event.groups as unknown as {
    id: string
    name: string
    slug: string
    primary_colour: string
  }

  const colour = group.primary_colour?.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour ?? '0D7377'}`

  // Check membership + role
  const { data: membership } = await svc
    .from('group_members')
    .select('role, status')
    .eq('group_id', event.group_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.status !== 'approved') redirect(`/g/${group.slug}`)

  const isAdmin =
    membership.role === 'super_admin' || membership.role === 'co_admin'

  // Fetch user profile
  const { data: profile } = await svc
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  // Fetch consent preference
  const { data: consent } = await svc
    .from('photo_consent_preferences')
    .select('consent_level')
    .eq('user_id', user.id)
    .eq('group_id', event.group_id)
    .maybeSingle()

  // Fetch group members (for lightbox mentions/comments)
  const { data: members } = await svc
    .from('group_members')
    .select('user_id, profiles:user_id ( full_name, avatar_url )')
    .eq('group_id', event.group_id)
    .eq('status', 'approved')
    .limit(100)

  const groupMembers = (members ?? []).map((m) => {
    const p = m.profiles as unknown as { full_name: string; avatar_url: string | null }
    return {
      id: m.user_id,
      fullName: p?.full_name ?? 'Member',
      avatarUrl: p?.avatar_url ?? null,
    }
  })

  return (
    <PhotosClient
      event={{ id: event.id, title: event.title }}
      group={{ id: event.group_id, name: group.name, slug: group.slug, colour }}
      currentUser={{
        id: user.id,
        fullName: profile?.full_name ?? 'Member',
        avatarUrl: profile?.avatar_url ?? null,
      }}
      isAdmin={isAdmin}
      consentLevel={consent?.consent_level ?? null}
      groupMembers={groupMembers}
    />
  )
}
