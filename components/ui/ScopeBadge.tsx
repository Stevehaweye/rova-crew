interface ScopeBadgeProps {
  companyName: string | null | undefined
  companyColour?: string | null
  /** `md` shows icon + company name. `sm` collapses to a circular icon-only
   *  chip suitable for thumbnails / tight card grids (<200px wide). */
  size?: 'sm' | 'md'
  className?: string
}

function normaliseColour(raw: string | null | undefined): string {
  if (!raw) return '#0D7377' // ROVA teal fallback
  return raw.startsWith('#') ? raw : `#${raw}`
}

/**
 * Corner overlay for club cards / hero images that indicates the club is
 * scoped to a specific company. Public clubs render NOTHING — the absence
 * of a badge is itself the signal ("this is open to everyone").
 *
 * Position the badge from the parent with an absolute-position wrapper:
 *   <div className="absolute top-3 left-3"><ScopeBadge ... /></div>
 */
export function ScopeBadge({
  companyName,
  companyColour,
  size = 'md',
  className = '',
}: ScopeBadgeProps) {
  if (!companyName) return null

  const bg = normaliseColour(companyColour)

  if (size === 'sm') {
    return (
      <span
        title={`${companyName} · corporate club`}
        aria-label={`${companyName} corporate club`}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[13px] shadow-md ring-2 ring-white/80 ${className}`}
        style={{ backgroundColor: bg }}
      >
        <span aria-hidden="true">🏢</span>
      </span>
    )
  }

  return (
    <span
      aria-label={`${companyName} corporate club`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[11px] font-semibold shadow-md ring-1 ring-black/5 max-w-[160px] ${className}`}
      style={{ backgroundColor: bg }}
    >
      <span aria-hidden="true" className="text-[12px] leading-none">🏢</span>
      <span className="truncate">{companyName}</span>
    </span>
  )
}
