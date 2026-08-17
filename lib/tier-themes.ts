// ─── Tier themes (shared between server and client) ─────────────────────────

export const TIER_THRESHOLDS = [
  { min: 0,   max: 199,  level: 1 },
  { min: 200, max: 399,  level: 2 },
  { min: 400, max: 699,  level: 3 },
  { min: 700, max: 899,  level: 4 },
  { min: 900, max: 1000, level: 5 },
] as const

export const TIER_THEMES: Record<string, [string, string, string, string, string]> = {
  generic:       ['Newcomer',   'Regular',    'Dedicated',    'Veteran',    'Legend'],
  running:       ['Rookie',     'Pacer',      'Racer',        'Marathoner', 'Ultra'],
  cycling:       ['Stabiliser', 'Sprinter',   'Climber',      'Peloton',    'Maillot'],
  hiking:        ['Rambler',    'Trekker',    'Pathfinder',   'Summiteer',  'Mountaineer'],
  book_club:     ['Browser',    'Reader',     'Bookworm',     'Curator',    'Librarian'],
  knitting:      ['Caster-on',  'Stitcher',   'Knitter',      'Artisan',    'Master'],
  yoga:          ['Beginner',   'Student',    'Practitioner',  'Yogi',      'Guru'],
  football:      ['Sub',        'Starter',    'Playmaker',    'Captain',    'Legend'],
  padel:         ['Beginner',   'Rally',      'Volley',       'Smash',      'Champion'],
  social:        ['Newbie',     'Regular',    'Connector',    'Influencer', 'Icon'],
  volunteering:  ['Helper',     'Supporter',  'Champion',     'Leader',     'Hero'],
  photography:   ['Snapper',    'Shooter',    'Photographer', 'Artist',     'Visionary'],
}

export interface TierInfo {
  tier: string
  level: number
  threshold: number
}

export function getMemberTier(
  crewScore: number,
  tierTheme?: string,
  customTierNames?: string[] | null
): TierInfo {
  const clamped = Math.max(0, Math.min(1000, Math.round(crewScore)))
  const bracket = TIER_THRESHOLDS.find((t) => clamped >= t.min && clamped <= t.max)!
  const level = bracket.level
  const idx = level - 1

  if (tierTheme === 'custom' && customTierNames && customTierNames.length === 5) {
    return { tier: customTierNames[idx], level, threshold: bracket.min }
  }

  const theme = TIER_THEMES[tierTheme ?? 'generic'] ?? TIER_THEMES.generic
  return { tier: theme[idx], level, threshold: bracket.min }
}

/**
 * Reverse of getMemberTier: given a stored sticky tier name, return its level
 * (1–5). Returns null when the name doesn't match any known theme, so callers
 * can fall back to the score-derived level.
 */
export function getTierLevelByName(
  tierName: string | null | undefined,
  tierTheme?: string,
  customTierNames?: string[] | null
): number | null {
  if (!tierName) return null

  if (tierTheme === 'custom' && customTierNames && customTierNames.length === 5) {
    const idx = customTierNames.indexOf(tierName)
    return idx >= 0 ? idx + 1 : null
  }

  const theme = TIER_THEMES[tierTheme ?? 'generic'] ?? TIER_THEMES.generic
  const idx = theme.indexOf(tierName)
  return idx >= 0 ? idx + 1 : null
}
