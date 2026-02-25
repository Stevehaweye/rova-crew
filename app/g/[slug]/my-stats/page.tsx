import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyStatsData } from '@/lib/my-stats'
import MyStatsClient from './my-stats-client'

export default async function MyStatsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/g/${slug}/my-stats`)

  // Group fetch
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()
  if (!group) redirect('/home')

  // Membership check (must be approved member)
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.status !== 'approved') {
    redirect(`/g/${slug}`)
  }

  const colour = group.primary_colour?.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour ?? '0D7377'}`

  // Fetch all stats data
  const data = await getMyStatsData(user.id, group.id)

  return (
    <MyStatsClient
      data={data}
      groupName={group.name}
      groupSlug={group.slug}
      colour={colour}
    />
  )
}
