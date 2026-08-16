import { format, isToday, isYesterday } from 'date-fns'

/**
 * Two-letter initials for an avatar fallback.
 * "Steve Purdham" → "SP", "cher" → "C", "" → "".
 */
export function initials(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
}

/** Day-header separator used in chat streams. */
export function formatDateSeparator(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE d MMM')
}
