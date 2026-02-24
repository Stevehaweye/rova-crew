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
    const { endpoint, p256dh, auth, userAgent } = body as {
      endpoint: string
      p256dh: string
      auth: string
      userAgent?: string
    }

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    await serviceClient.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent ?? null,
      },
      { onConflict: 'user_id,endpoint' }
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[push/subscribe] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
