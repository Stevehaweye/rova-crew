import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import AnnouncementsAdmin from '@/components/AnnouncementsAdmin'
import type { Announcement, ReactionGroup } from '@/components/AnnouncementsFeed'

export default async function AdminAnnouncementsPage({
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
  if (!user) redirect(`/auth?next=/g/${slug}/admin/announcements`)

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

  // Fetch (or create) the announcements channel
  let { data: channel } = await serviceClient
    .from('channels')
    .select('id')
    .eq('group_id', group.id)
    .eq('type', 'announcements')
    .maybeSingle()

  if (!channel) {
    const { data: created } = await serviceClient
      .from('channels')
      .insert({ group_id: group.id, type: 'announcements', name: 'Announcements' })
      .select('id')
      .single()
    channel = created
  }

  if (!channel) redirect(`/g/${slug}/admin`)

  // Fetch announcements
  const { data: messages } = await serviceClient
    .from('messages')
    .select('id, sender_id, content, content_type, image_url, is_pinned, edited_at, created_at, profiles:sender_id ( full_name, avatar_url )')
    .eq('channel_id', channel.id)
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch reactions for these messages
  const messageIds = (messages ?? []).map((m) => m.id)
  const { data: reactions } = messageIds.length > 0
    ? await serviceClient
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', messageIds)
    : { data: [] }

  // Build reaction groups per message
  const reactionsByMessage: Record<string, ReactionGroup[]> = {}
  for (const r of reactions ?? []) {
    if (!reactionsByMessage[r.message_id]) {
      reactionsByMessage[r.message_id] = []
    }
    const group = reactionsByMessage[r.message_id].find((g) => g.emoji === r.emoji)
    if (group) {
      group.count++
      if (r.user_id === user.id) group.reacted = true
    } else {
      reactionsByMessage[r.message_id].push({
        emoji: r.emoji,
        count: 1,
        reacted: r.user_id === user.id,
      })
    }
  }

  const initialAnnouncements: Announcement[] = (messages ?? []).map((m) => {
    const profile = m.profiles as unknown as { full_name: string; avatar_url: string | null } | null
    return {
      id: m.id,
      content: m.content,
      contentType: m.content_type,
      imageUrl: m.image_url,
      isPinned: m.is_pinned,
      editedAt: m.edited_at,
      createdAt: m.created_at,
      sender: {
        id: m.sender_id,
        fullName: profile?.full_name ?? 'Admin',
        avatarUrl: profile?.avatar_url ?? null,
      },
      reactions: reactionsByMessage[m.id] ?? [],
    }
  })

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
          <span className="text-sm font-semibold text-gray-600">Announcements</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Broadcast messages to all members of <strong>{group.name}</strong>
          </p>
        </div>

        <AnnouncementsAdmin
          channelId={channel.id}
          groupId={group.id}
          groupSlug={group.slug}
          groupColour={colour}
          currentUserId={user.id}
          initialAnnouncements={initialAnnouncements}
        />
      </main>
    </div>
  )
}
