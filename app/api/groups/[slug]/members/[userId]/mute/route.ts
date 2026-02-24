import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function verifyAdmin(currentUserId: string, slug: string) {
  const serviceClient = createServiceClient()

  const { data: group } = await serviceClient
    .from('groups')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (!group) return null

  const { data: membership } = await serviceClient
    .from('group_members')
    .select('role, status')
    .eq('group_id', group.id)
    .eq('user_id', currentUserId)
    .maybeSingle()

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'super_admin' || membership.role === 'co_admin')

  return isAdmin ? { serviceClient, groupId: group.id } : null
}

// POST — mute a member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  try {
    const { slug, userId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (user.id === userId) {
      return NextResponse.json({ error: 'Cannot mute yourself' }, { status: 400 })
    }

    const result = await verifyAdmin(user.id, slug)
    if (!result) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    const body = await request.json()
    const { duration } = body as { duration: '1h' | '24h' | '7d' | 'permanent' }

    let mutedUntil: string
    if (duration === 'permanent') {
      mutedUntil = '9999-12-31T23:59:59Z'
    } else {
      const ms: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      }
      mutedUntil = new Date(Date.now() + (ms[duration] ?? ms['1h'])).toISOString()
    }

    const { error } = await result.serviceClient
      .from('group_members')
      .update({ muted_until: mutedUntil })
      .eq('group_id', result.groupId)
      .eq('user_id', userId)

    if (error) {
      console.error('[mute] error:', error)
      return NextResponse.json({ error: 'Failed to mute' }, { status: 500 })
    }

    return NextResponse.json({ success: true, mutedUntil })
  } catch (err) {
    console.error('[mute] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — unmute a member
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  try {
    const { slug, userId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const result = await verifyAdmin(user.id, slug)
    if (!result) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    const { error } = await result.serviceClient
      .from('group_members')
      .update({ muted_until: null })
      .eq('group_id', result.groupId)
      .eq('user_id', userId)

    if (error) {
      console.error('[unmute] error:', error)
      return NextResponse.json({ error: 'Failed to unmute' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[unmute] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
