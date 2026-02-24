import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { channelId } = body as { channelId: string }

    if (!channelId) {
      return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    await serviceClient.from('channel_members').upsert(
      {
        channel_id: channelId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'channel_id,user_id' }
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[chat/read] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
