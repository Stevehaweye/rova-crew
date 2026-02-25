import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PostEventHighlight {
  eventId: string
  eventTitle: string
  endsAt: string
  groupName: string
  groupColour: string
  groupSlug: string
  attendedCount: number
  avgRating: number
  photoCount: number
  coverPhotoUrl: string | null
  milestones: Array<{ memberName: string; badgeName: string; badgeEmoji: string }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hex(c: string) {
  return c.startsWith('#') ? c : `#${c}`
}

// ─── PostEventCard ──────────────────────────────────────────────────────────

export default function PostEventCard({ highlight }: { highlight: PostEventHighlight }) {
  const colour = hex(highlight.groupColour)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Hero image / colour banner */}
      <div className="relative h-44 sm:h-52">
        {highlight.coverPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={highlight.coverPhotoUrl}
            alt={highlight.eventTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${colour}, ${colour}cc)`,
            }}
          />
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Event name — bottom left */}
        <div className="absolute bottom-3 left-4 right-20">
          <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">
            {highlight.eventTitle}
          </h3>
        </div>

        {/* Photo count badge — bottom right */}
        {highlight.photoCount > 0 && (
          <div className="absolute bottom-3 right-4 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <span>📷</span>
            <span>{highlight.photoCount}</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-4 py-4">
        {/* Group name */}
        <p className="text-xs font-medium text-gray-400 mb-2">{highlight.groupName}</p>

        {/* Stats row */}
        <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
          <span>👥 {highlight.attendedCount} attended</span>
          {highlight.avgRating > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span>{highlight.avgRating.toFixed(1)}★</span>
            </>
          )}
          {highlight.photoCount > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span>{highlight.photoCount} photo{highlight.photoCount !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>

        {/* Milestones */}
        {highlight.milestones.length > 0 && (
          <div className="mt-3 space-y-1">
            {highlight.milestones.slice(0, 3).map((m, i) => (
              <p key={i} className="text-sm text-gray-600">
                🏆 <span className="font-medium text-gray-900">{m.memberName}</span> earned{' '}
                <span className="font-medium">{m.badgeEmoji} {m.badgeName}</span>
              </p>
            ))}
          </div>
        )}

        {/* CTA buttons */}
        <div className="mt-4 flex gap-3">
          {highlight.photoCount > 0 && (
            <Link
              href={`/events/${highlight.eventId}/photos`}
              className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: colour }}
            >
              📷 Browse photos
            </Link>
          )}
          <Link
            href={`/events/${highlight.eventId}/summary`}
            className={`${highlight.photoCount > 0 ? 'flex-1' : 'w-full'} text-center py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-colors`}
          >
            📋 View full recap
          </Link>
        </div>
      </div>
    </div>
  )
}
