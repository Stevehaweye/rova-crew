import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import RateClient from './rate-client'

export default async function RatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/events/${id}/rate`)

  const svc = createServiceClient()

  // Fetch event + group
  const { data: event } = await svc
    .from('events')
    .select('id, title, group_id, groups ( name, slug, primary_colour )')
    .eq('id', id)
    .maybeSingle()

  if (!event) redirect('/home')

  const group = event.groups as unknown as {
    name: string
    slug: string
    primary_colour: string
  }

  const colour = group.primary_colour?.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour ?? '0D7377'}`

  // Check existing rating
  const { data: existingRating } = await svc
    .from('event_ratings')
    .select('id, rating, comment')
    .eq('event_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <RateClient
      event={{ id: event.id, title: event.title }}
      group={{ name: group.name, slug: group.slug, colour }}
      existingRating={existingRating}
    />
  )
}
