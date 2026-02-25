import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { generateEventReport } from '@/lib/event-report'
import ReportClient from './report-client'

export default async function EventReportPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id: eventId } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/g/${slug}/admin/events/${eventId}/report`)

  // Group fetch
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()
  if (!group) redirect('/home')

  // Admin role check
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'super_admin' || membership.role === 'co_admin')
  if (!isAdmin) redirect(`/g/${slug}`)

  // Generate report
  const report = await generateEventReport(eventId)
  if (!report) redirect(`/g/${slug}/admin/events`)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href={`/g/${slug}/admin/events?tab=past`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <Link href="/home" className="select-none">
            <span className="text-base font-black tracking-[0.14em]" style={{ color: '#0D7377' }}>
              ROVA
            </span>
            <span className="text-base font-black tracking-[0.14em]" style={{ color: '#C9982A' }}>
              CREW
            </span>
          </Link>
          <span className="text-gray-300 text-lg">·</span>
          <span className="text-sm font-semibold text-gray-600">Event Report</span>
        </div>
      </nav>

      <ReportClient report={report} groupSlug={slug} />
    </div>
  )
}
