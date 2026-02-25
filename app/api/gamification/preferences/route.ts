import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_KEYS = [
  'hide_from_board',
  'private_crew_score',
  'mute_badge_announcements',
  'mute_gamification_push',
] as const

type PrefKey = (typeof ALLOWED_KEYS)[number]

const DEFAULTS: Record<PrefKey, boolean> = {
  hide_from_board: false,
  private_crew_score: false,
  mute_badge_announcements: false,
  mute_gamification_push: false,
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
    const { data: rows } = await svc
      .from('member_gamification_prefs')
      .select('group_id, hide_from_board, private_crew_score, mute_badge_announcements, mute_gamification_push')
      .eq('user_id', user.id)

    // Build a map of group_id -> prefs (merged with defaults)
    const result: Record<string, Record<PrefKey, boolean>> = {}

    if (rows) {
      for (const row of rows) {
        result[row.group_id] = {
          hide_from_board: row.hide_from_board ?? false,
          private_crew_score: row.private_crew_score ?? false,
          mute_badge_announcements: row.mute_badge_announcements ?? false,
          mute_gamification_push: row.mute_gamification_push ?? false,
        }
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[gamification-prefs] GET error:', err)
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
    const groupId = body?.group_id as string
    const key = body?.key as string
    const value = body?.value as boolean

    if (!groupId) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    if (!key || !ALLOWED_KEYS.includes(key as PrefKey)) {
      return NextResponse.json({ error: 'Invalid preference key' }, { status: 400 })
    }

    if (typeof value !== 'boolean') {
      return NextResponse.json({ error: 'Value must be a boolean' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Upsert the preference
    const { error: upsertErr } = await svc
      .from('member_gamification_prefs')
      .upsert(
        {
          user_id: user.id,
          group_id: groupId,
          [key]: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,group_id' }
      )

    if (upsertErr) {
      console.error('[gamification-prefs] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
    }

    // Backward compatibility: sync hide_from_board → member_stats.hide_from_monthly_board
    if (key === 'hide_from_board') {
      const { error: syncErr } = await svc
        .from('member_stats')
        .update({ hide_from_monthly_board: value })
        .eq('user_id', user.id)
        .eq('group_id', groupId)

      if (syncErr) {
        console.error('[gamification-prefs] sync hide_from_monthly_board error:', syncErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[gamification-prefs] PUT error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
