import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MigrateWizard from './migrate-wizard'

export default async function MigratePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth?next=/migrate')

  return <MigrateWizard />
}
