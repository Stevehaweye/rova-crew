import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTopNavUser } from '@/lib/get-topnav-user'
import ProfileClient from './profile-client'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth?next=/profile')

  // Fetch profile + stats + topnav user in parallel
  const [profileResult, { count: groupCount }, { count: eventCount }, topNavUser] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single(),
    supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'approved'),
    supabase
      .from('rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'going'),
    getTopNavUser(),
  ])

  const profile = profileResult.data

  return (
    <ProfileClient
      name={profile?.full_name ?? 'Member'}
      email={user.email ?? ''}
      avatarUrl={profile?.avatar_url ?? null}
      groupsJoined={groupCount ?? 0}
      eventsAttended={eventCount ?? 0}
      memberSince={user.created_at ?? new Date().toISOString()}
      topNavUser={topNavUser}
    />
  )
}
