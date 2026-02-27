import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/platform-admin'
import PlatformAdminClient from './platform-admin-client'

export default async function PlatformAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth')
  if (!isPlatformAdmin(user.email ?? null)) notFound()

  return <PlatformAdminClient userEmail={user.email!} />
}
