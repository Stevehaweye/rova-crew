import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const PHOTOS_PER_PAGE = 120

interface PhotoRow {
  id: string
  event_id: string
  storage_path: string
  created_at: string
  uploader_id: string
}

export default async function GroupPhotosPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/auth?next=/g/${slug}/photos`)

  const svc = createServiceClient()

  const { data: group } = await svc
    .from('groups')
    .select('id, name, slug, primary_colour')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) redirect('/home')

  // Approved-member check — matches per-event photos page
  const { data: membership } = await svc
    .from('group_members')
    .select('status')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.status !== 'approved') redirect(`/g/${slug}`)

  const colour = group.primary_colour?.startsWith('#')
    ? group.primary_colour
    : `#${group.primary_colour ?? '0D7377'}`

  // Fetch the most recent photos for this group across every event.
  const { data: photoRows } = await svc
    .from('event_photos')
    .select('id, event_id, storage_path, created_at, uploader_id')
    .eq('group_id', group.id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(PHOTOS_PER_PAGE)

  const photos = (photoRows ?? []) as PhotoRow[]

  // Batch-fetch events referenced by these photos so we can group + label.
  const eventIds = Array.from(new Set(photos.map((p) => p.event_id)))
  const eventMap = new Map<string, { title: string; startsAt: string }>()
  if (eventIds.length > 0) {
    const { data: events } = await svc
      .from('events')
      .select('id, title, starts_at')
      .in('id', eventIds)
    for (const e of events ?? []) {
      eventMap.set(e.id, { title: e.title, startsAt: e.starts_at })
    }
  }

  // Sign every URL in parallel. Cheap because they all hit the same bucket.
  const signed = await Promise.all(
    photos.map(async (p) => {
      const { data } = await svc.storage
        .from('event-photos')
        .createSignedUrl(p.storage_path, 3600)
      return {
        id: p.id,
        eventId: p.event_id,
        url: data?.signedUrl ?? null,
      }
    })
  )

  // Group by event, preserving the "most recent first" order from the DB.
  const byEvent = new Map<
    string,
    { title: string; startsAt: string; photos: { id: string; url: string }[] }
  >()

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i]
    const s = signed[i]
    if (!s.url) continue
    const event = eventMap.get(p.event_id)
    if (!event) continue
    if (!byEvent.has(p.event_id)) {
      byEvent.set(p.event_id, {
        title: event.title,
        startsAt: event.startsAt,
        photos: [],
      })
    }
    byEvent.get(p.event_id)!.photos.push({ id: p.id, url: s.url })
  }

  const eventGroups = Array.from(byEvent.entries()).map(([eventId, group]) => ({
    eventId,
    ...group,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href={`/g/${slug}/admin`}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700"
            >
              ← Back to admin
            </Link>
            <h1 className="text-2xl font-black text-gray-900 mt-1">Photos</h1>
            <p className="text-sm text-gray-500 mt-1">
              Everything shared across{' '}
              <span className="font-semibold text-gray-700">{group.name}</span>
            </p>
          </div>
        </div>

        {eventGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-4xl mb-3 select-none">📸</p>
            <p className="text-sm font-semibold text-gray-700">No photos yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Photos uploaded from any event in this group will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {eventGroups.map((grp) => (
              <section
                key={grp.eventId}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">
                      {grp.title}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(grp.startsAt).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      · {grp.photos.length} photo
                      {grp.photos.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Link
                    href={`/events/${grp.eventId}/photos`}
                    className="text-xs font-semibold hover:opacity-75"
                    style={{ color: colour }}
                  >
                    Open album →
                  </Link>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {grp.photos.map((photo) => (
                    <Link
                      key={photo.id}
                      href={`/events/${grp.eventId}/photos`}
                      className="aspect-square overflow-hidden rounded-lg bg-gray-100 group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            {photos.length >= PHOTOS_PER_PAGE && (
              <p className="text-center text-xs text-gray-500">
                Showing the most recent {PHOTOS_PER_PAGE} photos across the
                group. Open a specific event album to see every photo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
