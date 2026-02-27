import { createClient } from '@/lib/supabase/server'

/**
 * Check if an email matches the platform admin email.
 * Used in server components to conditionally render admin nav links.
 */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email || !process.env.PLATFORM_ADMIN_EMAIL) return false
  return email.toLowerCase() === process.env.PLATFORM_ADMIN_EMAIL.toLowerCase()
}

/**
 * Guard for platform admin API routes.
 * Throws an object with { status, message } if not authorised.
 */
export async function requirePlatformAdmin(): Promise<{
  id: string
  email: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    throw { status: 401, message: 'Authentication required' }
  }

  if (!isPlatformAdmin(user.email)) {
    throw { status: 403, message: 'Access denied' }
  }

  return { id: user.id, email: user.email }
}
