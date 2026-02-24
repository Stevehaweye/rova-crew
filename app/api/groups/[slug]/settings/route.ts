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
    const { allow_dm } = body as { allow_dm: boolean }

    if (typeof allow_dm !== 'boolean') {
      return NextResponse.json({ error: 'Invalid value for allow_dm' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    await serviceClient
      .from('groups')
      .update({ allow_dm })
      .eq('id', group.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[group-settings] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
