import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EventForm from './event-form'

export default async function NewEventPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = createClient()

  // ── Auth check ──────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/g/${params.slug}/admin/events/new`)

  // ── Fetch group ─────────────────────────────────────────────────────────────
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!group) redirect('/home')

  // ── Role check: must be super_admin or co_admin ─────────────────────────────
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'super_admin' || membership.role === 'co_admin')

  if (!isAdmin) redirect(`/g/${params.slug}/admin`)

  return (
    <EventForm
      group={{
        id: group.id,
        name: group.name,
        slug: group.slug,
        logoUrl: group.logo_url,
        primaryColour: group.primary_colour,
      }}
      userId={user.id}
    />
  )
}
