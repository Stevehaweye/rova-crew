import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { awardSpiritPoints } from '@/lib/spirit-points'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    // Fetch event to get group_id
    const { data: event } = await svc
      .from('events')
      .select('group_id')
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Award spirit points for flyer share
    await awardSpiritPoints(user.id, event.group_id, 'flyer_share', eventId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[flyer-share] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
