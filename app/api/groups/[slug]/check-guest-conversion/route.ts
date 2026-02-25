import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { awardSpiritPoints } from '@/lib/spirit-points'

export async function POST(
  _request: NextRequest,
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

    // Fetch user's email
    const { data: profile } = await svc
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .maybeSingle()

    // Fallback to auth email if profile doesn't have one
    const email = profile?.email || user.email
    if (!email) {
      return NextResponse.json({ converted: false, reason: 'no_email' })
    }

    // Fetch the group
    const { data: group } = await svc
      .from('groups')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Find guest_rsvps matching this email for events in this group
    const { data: guestRsvps } = await svc
      .from('guest_rsvps')
      .select('id, event_id, events!inner ( id, created_by, group_id )')
      .eq('email', email.toLowerCase())
      .eq('events.group_id', group.id)

    if (!guestRsvps || guestRsvps.length === 0) {
      return NextResponse.json({ converted: false })
    }

    // Collect unique event creators (organisers) to credit
    const organisers = new Set<string>()
    for (const gr of guestRsvps) {
      const evt = gr.events as unknown as { created_by: string }
      if (evt?.created_by && evt.created_by !== user.id) {
        organisers.add(evt.created_by)
      }
    }

    // Award spirit points to each organiser + increment guest_converts
    let conversions = 0
    for (const organiserId of organisers) {
      await awardSpiritPoints(organiserId, group.id, 'guest_conversion', user.id)

      // Increment guest_converts counter
      const { data: stats } = await svc
        .from('member_stats')
        .select('guest_converts')
        .eq('user_id', organiserId)
        .eq('group_id', group.id)
        .maybeSingle()

      await svc.from('member_stats').upsert(
        {
          user_id: organiserId,
          group_id: group.id,
          guest_converts: (stats?.guest_converts ?? 0) + 1,
        },
        { onConflict: 'user_id,group_id' }
      )

      conversions++
    }

    return NextResponse.json({ converted: conversions > 0, conversions })
  } catch (err) {
    console.error('[check-guest-conversion] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
