import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Fetch group
    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Admin check
    const { data: membership } = await supabase
      .from('group_members')
      .select('role, status')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin =
      membership?.status === 'approved' &&
      (membership.role === 'super_admin' || membership.role === 'co_admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()

    // Build update object from valid fields
    const updates: Record<string, unknown> = {}

    // Group profile fields
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
    if (typeof body.tagline === 'string') updates.tagline = body.tagline.trim() || null
    if (typeof body.description === 'string') updates.description = body.description.trim() || null
    if (typeof body.category === 'string') updates.category = body.category || null
    if (typeof body.is_public === 'boolean') updates.is_public = body.is_public
    if (typeof body.join_approval_required === 'boolean') updates.join_approval_required = body.join_approval_required

    if (typeof body.allow_dm === 'boolean') updates.allow_dm = body.allow_dm
    if (typeof body.tier_theme === 'string') updates.tier_theme = body.tier_theme
    if (typeof body.badge_announcements_enabled === 'boolean') {
      updates.badge_announcements_enabled = body.badge_announcements_enabled
    }
    if (typeof body.board_monthly_enabled === 'boolean') updates.board_monthly_enabled = body.board_monthly_enabled
    if (typeof body.board_alltime_enabled === 'boolean') updates.board_alltime_enabled = body.board_alltime_enabled
    if (typeof body.board_spirit_enabled === 'boolean') updates.board_spirit_enabled = body.board_spirit_enabled
    if (typeof body.board_streak_enabled === 'boolean') updates.board_streak_enabled = body.board_streak_enabled
    if (typeof body.crew_score_visible === 'boolean') updates.crew_score_visible = body.crew_score_visible
    if (typeof body.hall_of_fame_visibility === 'string') updates.hall_of_fame_visibility = body.hall_of_fame_visibility
    if (Array.isArray(body.custom_tier_names)) updates.custom_tier_names = body.custom_tier_names
    if (typeof body.watermark_photos === 'boolean') updates.watermark_photos = body.watermark_photos
    if (typeof body.location === 'string') updates.location = body.location.trim() || null
    if (typeof body.hero_url === 'string') updates.hero_url = body.hero_url || null
    if (typeof body.hero_focal_x === 'number') updates.hero_focal_x = Math.max(0, Math.min(100, Math.round(body.hero_focal_x)))
    if (typeof body.hero_focal_y === 'number') updates.hero_focal_y = Math.max(0, Math.min(100, Math.round(body.hero_focal_y)))
    if (typeof body.payments_enabled === 'boolean') updates.payments_enabled = body.payments_enabled
    if (typeof body.payment_admin_id === 'string') updates.payment_admin_id = body.payment_admin_id

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    await serviceClient
      .from('groups')
      .update(updates)
      .eq('id', group.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[group-settings] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
