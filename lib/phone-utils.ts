// ─── Phone number parsing & WhatsApp utilities ────────────────────────────

/**
 * Parse a raw string of phone numbers (comma, newline, or space separated)
 * into an array of cleaned phone strings.
 */
export function parsePhoneNumbers(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizePhone)
    .filter((p) => p.length >= 7)
}

/**
 * Normalize a phone number: strip everything except digits and leading +.
 * If no country code, default to +44 (UK).
 */
export function normalizePhone(phone: string): string {
  // Strip spaces, dashes, parentheses, dots
  let cleaned = phone.replace(/[\s\-().]/g, '')

  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2)
  }

  // If starts with 0 (UK local), convert to +44
  if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
    cleaned = '+44' + cleaned.slice(1)
  }

  // If no + prefix and looks like a full number, add +
  if (!cleaned.startsWith('+') && cleaned.length >= 10) {
    cleaned = '+' + cleaned
  }

  // Strip any remaining non-digit/non-+ characters
  cleaned = cleaned.replace(/[^\d+]/g, '')

  return cleaned
}

/**
 * Validate that a string looks like a plausible phone number.
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

/**
 * Generate a WhatsApp deep link for a phone number with a message.
 */
export function generateWhatsAppUrl(phone: string, message: string): string {
  // wa.me expects the number without + prefix
  const num = phone.replace(/^\+/, '')
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`
}
