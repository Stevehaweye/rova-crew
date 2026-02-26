import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone, isValidPhone } from '@/lib/phone-utils'

// ─── POST: Create invites for a list of phone numbers ─────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    // Fetch group
    const { data: group } = await svc
      .from('groups')
      .select('id, name')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Admin check
    const { data: membership } = await svc
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

    const { phones } = (await request.json()) as { phones: string[] }

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({ error: 'No phone numbers provided' }, { status: 400 })
    }

    if (phones.length > 200) {
      return NextResponse.json({ error: 'Max 200 invites at a time' }, { status: 400 })
    }

    // Normalize and validate
    const normalized = phones
      .map(normalizePhone)
      .filter(isValidPhone)

    if (normalized.length === 0) {
      return NextResponse.json({ error: 'No valid phone numbers found' }, { status: 400 })
    }

    // Bulk insert with ON CONFLICT DO NOTHING
    const rows = normalized.map((phone) => ({
      group_id: group.id,
      phone,
    }))

    const { error: insertErr } = await svc
      .from('group_invites')
      .upsert(rows, { onConflict: 'group_id,phone', ignoreDuplicates: true })

    if (insertErr) {
      console.error('[invites] insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to create invites' }, { status: 500 })
    }

    // Fetch the created/existing invites
    const { data: invites } = await svc
      .from('group_invites')
      .select('phone, invite_token, status, created_at')
      .eq('group_id', group.id)
      .in('phone', normalized)
      .order('created_at', { ascending: false })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rovacrew.com'

    const result = (invites ?? []).map((inv) => ({
      phone: inv.phone,
      inviteToken: inv.invite_token,
      inviteUrl: `${appUrl}/g/${slug}?invite=${inv.invite_token}`,
      status: inv.status,
    }))

    return NextResponse.json({ invites: result })
  } catch (err) {
    console.error('[invites] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ─── GET: List invites for a group ────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    const { data: group } = await svc
      .from('groups')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Admin check
    const { data: membership } = await svc
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

    const { data: invites } = await svc
      .from('group_invites')
      .select('id, phone, invite_token, status, created_at, accepted_at')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false })
      .limit(500)

    return NextResponse.json({ invites: invites ?? [] })
  } catch (err) {
    console.error('[invites] list error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
