import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_LEVELS = ['always', 'ask', 'never'] as const
type ConsentLevel = (typeof ALLOWED_LEVELS)[number]

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
      .from('photo_consent_preferences')
      .select('group_id, consent_level')
      .eq('user_id', user.id)

    // Build a map of group_id -> consent_level
    const result: Record<string, ConsentLevel> = {}

    if (rows) {
      for (const row of rows) {
        result[row.group_id] = row.consent_level ?? 'always'
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[photo-consent] GET error:', err)
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
    const consentLevel = body?.consent_level as string

    if (!groupId) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    if (!consentLevel || !ALLOWED_LEVELS.includes(consentLevel as ConsentLevel)) {
      return NextResponse.json({ error: 'consent_level must be always, ask, or never' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { error: upsertErr } = await svc
      .from('photo_consent_preferences')
      .upsert(
        {
          user_id: user.id,
          group_id: groupId,
          consent_level: consentLevel,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,group_id' }
      )

    if (upsertErr) {
      console.error('[photo-consent] upsert error:', upsertErr)
      return NextResponse.json({ error: `Failed to save preference: ${upsertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[photo-consent] PUT error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
