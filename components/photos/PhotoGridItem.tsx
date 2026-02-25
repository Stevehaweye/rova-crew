'use client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PhotoData {
  id: string
  photoUrl: string
  reactionCount: number
  isFeatured: boolean
  isAlbumCover: boolean
  isHidden: boolean
}

interface Props {
  photo: PhotoData
  isAdmin: boolean
  onClick: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PhotoGridItem({ photo, isAdmin, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden group focus:outline-none focus:ring-2 focus:ring-white/30"
    >
      {/* Photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.photoUrl}
        alt=""
        className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${
          photo.isHidden ? 'grayscale opacity-50' : ''
        }`}
        loading="lazy"
      />

      {/* Featured badge */}
      {photo.isFeatured && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className="text-xs">⭐</span>
          <span className="text-[10px] font-bold text-white">Featured</span>
        </div>
      )}

      {/* Album cover badge */}
      {photo.isAlbumCover && !photo.isFeatured && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className="text-xs">🖼</span>
          <span className="text-[10px] font-bold text-gray-700">Cover</span>
        </div>
      )}

      {/* Hidden badge (admin only) */}
      {photo.isHidden && isAdmin && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="bg-red-500/90 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-xs font-bold text-white">Hidden</span>
          </div>
        </div>
      )}

      {/* Heart count */}
      {photo.reactionCount > 0 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className="text-xs">❤️</span>
          <span className="text-xs font-semibold text-white">{photo.reactionCount}</span>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
    </button>
  )
}
