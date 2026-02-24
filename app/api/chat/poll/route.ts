import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const channelId = request.nextUrl.searchParams.get('channelId')
    const after = request.nextUrl.searchParams.get('after') // ISO timestamp

    if (!channelId) {
      return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Verify user is a member of this channel
    const { data: membership } = await svc
      .from('channel_members')
      .select('user_id')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Not a channel member' }, { status: 403 })
    }

    // Fetch recent messages
    let query = svc
      .from('messages')
      .select('id, sender_id, content, content_type, image_url, is_pinned, edited_at, deleted_at, deleted_by, reply_to_id, created_at, profiles:sender_id ( full_name, avatar_url )')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(15)

    if (after) {
      query = query.gt('created_at', after)
    }

    const { data: messages } = await query

    return NextResponse.json({ messages: messages ?? [] })
  } catch (err) {
    console.error('[chat/poll] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
