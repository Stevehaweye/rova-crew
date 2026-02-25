import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHallOfFameRecords } from '@/lib/hall-of-fame'
import HallOfFameClient from './hall-of-fame-client'

export default async function HallOfFamePage({
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
  if (!user) redirect(`/auth?next=/g/${slug}/hall-of-fame`)

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

  // Fetch hall of fame records
  const records = await getHallOfFameRecords(group.id)

  return (
    <HallOfFameClient
      records={records}
      groupName={group.name}
      groupSlug={group.slug}
      colour={colour}
    />
  )
}
