import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import BlastComposer from '@/components/BlastComposer'

export default async function AdminBlastPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ title?: string; body?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth?next=/g/${slug}/admin/blast`)

  // Group fetch
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()
  if (!group) redirect('/home')

  // Role check
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

  const serviceClient = createServiceClient()

  // Approved member count
  const { count: memberCount } = await serviceClient
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', group.id)
    .eq('status', 'approved')

  // Last blast for rate limit display
  const { data: lastBlast } = await serviceClient
    .from('message_blasts')
    .select('sent_at')
    .eq('group_id', group.id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const colour = group.primary_colour.startsWith('#') ? group.primary_colour : `#${group.primary_colour}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href={`/g/${group.slug}/admin`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <Link href="/home" className="select-none">
            <span className="text-base font-black tracking-[0.14em]" style={{ color: '#0D7377' }}>ROVA</span>
            <span className="text-base font-black tracking-[0.14em]" style={{ color: '#C9982A' }}>CREW</span>
          </Link>
          <span className="text-gray-300 text-lg">&middot;</span>
          <span className="text-sm font-semibold text-gray-600">Message Blast</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Message Blast</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Send an urgent push notification + email to all members of <strong>{group.name}</strong>
          </p>
        </div>

        <BlastComposer
          groupSlug={group.slug}
          groupName={group.name}
          groupColour={colour}
          memberCount={memberCount ?? 0}
          lastBlastAt={lastBlast?.sent_at ?? null}
          initialTitle={sp.title ?? ''}
          initialBody={sp.body ?? ''}
        />
      </main>
    </div>
  )
}
