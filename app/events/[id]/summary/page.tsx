import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateEventSummary } from '@/lib/post-event-summary'
import SummaryClient from './summary-client'

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/events/${id}/summary`)

  const summary = await generateEventSummary(id)

  if (!summary) redirect('/home')

  return <SummaryClient summary={summary} currentUserId={user.id} />
}
