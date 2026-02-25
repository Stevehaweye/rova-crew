'use client'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TierBadgeProps {
  tierLevel: 1 | 2 | 3 | 4 | 5
  tierName: string
  size?: 'sm' | 'md' | 'lg'
}

// ─── Size classes ───────────────────────────────────────────────────────────

const SIZE_CLASSES = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
} as const

// ─── Component ──────────────────────────────────────────────────────────────

export function TierBadge({ tierLevel, tierName, size = 'md' }: TierBadgeProps) {
  const sizeClass = SIZE_CLASSES[size]
  const base = `rounded-full font-semibold inline-flex items-center whitespace-nowrap ${sizeClass}`

  switch (tierLevel) {
    // T1 — Grey, plain
    case 1:
      return (
        <span className={`${base} bg-gray-100 text-gray-500`}>
          {tierName}
        </span>
      )

    // T2 — Bronze, subtle glow
    case 2:
      return (
        <span
          className={`${base} bg-amber-50 text-amber-700 ring-1 ring-amber-300/50`}
          style={{ boxShadow: '0 0 6px rgba(180,83,9,0.15)' }}
        >
          {tierName}
        </span>
      )

    // T3 — Silver, pulse
    case 3:
      return (
        <span className={`${base} bg-slate-100 text-slate-600 ring-1 ring-slate-300/50 animate-pulse`}>
          {tierName}
        </span>
      )

    // T4 — Gold, shimmer
    case 4:
      return (
        <span
          className={`${base} bg-gradient-to-r from-yellow-200 via-yellow-100 to-yellow-200 bg-[length:200%_100%] text-yellow-700 ring-1 ring-yellow-400/50 animate-shimmer`}
        >
          {tierName}
        </span>
      )

    // T5 — Platinum/iridescent, shimmer, bold italic
    case 5:
      return (
        <span
          className={`${base} bg-gradient-to-r from-purple-400 via-blue-400 to-teal-400 bg-[length:200%_100%] text-white font-bold italic animate-shimmer`}
        >
          {tierName}
        </span>
      )

    default:
      return (
        <span className={`${base} bg-gray-100 text-gray-500`}>
          {tierName}
        </span>
      )
  }
}
