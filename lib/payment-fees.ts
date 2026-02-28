/**
 * ROVA platform fee: 5% of gross, minimum 30p
 */
export function calculatePlatformFeePence(grossPence: number): number {
  return Math.max(Math.round(grossPence * 0.05), 30)
}

/**
 * Estimate the net amount the creator receives after Stripe + ROVA fees.
 * Uses UK domestic card rate: 1.4% + 20p
 * Actual net varies by card type (European cards: 2.5% + 20p).
 */
export function estimateNetPence(grossPence: number): number {
  if (grossPence <= 0) return 0
  const stripeFee = Math.round(grossPence * 0.014) + 20
  const platformFee = calculatePlatformFeePence(grossPence)
  return grossPence - stripeFee - platformFee
}

/**
 * Format pence as pounds string: 448 → "4.48"
 */
export function penceToPounds(pence: number): string {
  return (pence / 100).toFixed(2)
}

/**
 * Estimate net in pounds from a gross pounds string (for UI inputs).
 * Returns null if input is invalid or net would be zero/negative.
 */
export function estimateNetPounds(grossPounds: string): string | null {
  const gross = parseFloat(grossPounds)
  if (isNaN(gross) || gross < 1) return null
  const netPence = estimateNetPence(Math.round(gross * 100))
  if (netPence <= 0) return null
  return penceToPounds(netPence)
}
