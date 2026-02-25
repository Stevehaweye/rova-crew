import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyBoardData } from '@/lib/monthly-board'
import BoardClient from './board-client'

export default async function BoardPage({
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
  if (!user) redirect(`/auth?next=/g/${slug}/board`)

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

  // Fetch board data
  const boardData = await getMonthlyBoardData(group.id, user.id)

  return (
    <BoardClient
      boardData={boardData}
      groupColour={colour}
      groupSlug={group.slug}
      groupName={group.name}
      currentUserId={user.id}
    />
  )
}
