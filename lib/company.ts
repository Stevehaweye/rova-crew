// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyRecord {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_colour: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function extractDomain(email: string): string {
  const parts = email.split('@')
  return (parts[1] ?? '').toLowerCase().trim()
}

// ─── Client-side lookup ──────────────────────────────────────────────────────

export async function lookupCompanyByEmail(
  email: string
): Promise<CompanyRecord | null> {
  try {
    const res = await fetch(
      `/api/company/lookup?email=${encodeURIComponent(email)}`
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.company ?? null
  } catch {
    return null
  }
}
