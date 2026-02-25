import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_KEYS = [
  'event_reminders',
  'waitlist_updates',
  'new_events',
  'direct_messages',
  'mentions',
  'group_chat',
  'event_chat',
  'announcements',
  'rsvp_milestones',
  'health_alerts',
] as const

type PreferenceKey = (typeof ALLOWED_KEYS)[number]

const DEFAULTS: Record<PreferenceKey, boolean> = {
  event_reminders: true,
  waitlist_updates: true,
  new_events: true,
  direct_messages: true,
  mentions: true,
  group_chat: true,
  event_chat: true,
  announcements: true,
  rsvp_milestones: true,
  health_alerts: true,
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()
    const { data: prefs } = await svc
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Return existing prefs merged with defaults, or just defaults
    const result: Record<string, boolean> = { ...DEFAULTS }
    if (prefs) {
      for (const key of ALLOWED_KEYS) {
        if (prefs[key] !== null && prefs[key] !== undefined) {
          result[key] = prefs[key]
        }
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[notification-prefs] GET error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const key = body?.key as string
    const value = body?.value as boolean

    if (!key || !ALLOWED_KEYS.includes(key as PreferenceKey)) {
      return NextResponse.json({ error: 'Invalid preference key' }, { status: 400 })
    }

    if (typeof value !== 'boolean') {
      return NextResponse.json({ error: 'Value must be a boolean' }, { status: 400 })
    }

    const svc = createServiceClient()
    const { error: upsertErr } = await svc
      .from('user_notification_preferences')
      .upsert(
        {
          user_id: user.id,
          [key]: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertErr) {
      console.error('[notification-prefs] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notification-prefs] PUT error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
