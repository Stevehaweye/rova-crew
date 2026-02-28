import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendRsvpConfirmationEmail, sendWaitlistEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-sender'
import { checkRsvpMilestone } from '@/lib/rsvp-milestones'
import { awardSpiritPoints } from '@/lib/spirit-points'
import { canAccessGroup } from '@/lib/discovery'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const status = body?.status as string | undefined
    const rawPlusOnes = (body?.plus_ones as Array<{ name: string; email?: string }> | undefined)
      ?.filter((p) => p.name?.trim())

    if (!status || !['going', 'maybe', 'not_going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Fetch event config for plus-one rules
    const svcConfig = createServiceClient()
    const { data: evtConfig } = await svcConfig
      .from('events')
      .select('max_capacity, plus_ones_allowed, max_plus_ones_per_member, plus_ones_count_toward_capacity, group_id')
      .eq('id', eventId)
      .single()

    if (!evtConfig) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Enterprise scope check
    const hasAccess = await canAccessGroup(evtConfig.group_id, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this event.' }, { status: 403 })
    }

    const plusOnesAllowed = evtConfig?.plus_ones_allowed ?? true
    const maxPerMember = evtConfig?.max_plus_ones_per_member ?? 3
    const plusOnesCountTowardCapacity = evtConfig?.plus_ones_count_toward_capacity ?? true

    // Enforce plus-one rules
    let plusOnes = rawPlusOnes
    if (!plusOnesAllowed) {
      plusOnes = undefined
    } else if (plusOnes) {
      plusOnes = plusOnes.slice(0, maxPerMember)
    }

    // Capacity check: auto-waitlist if event is full
    let finalStatus = status
    if (status === 'going') {
      const svc = createServiceClient()

      if (evtConfig?.max_capacity) {
        const [{ count: goingCount }, { count: plusOneCount }] = await Promise.all([
          svc
            .from('rsvps')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .eq('status', 'going')
            .neq('user_id', user.id),
          plusOnesCountTowardCapacity
            ? svc
                .from('event_plus_ones')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .neq('user_id', user.id)
            : Promise.resolve({ count: 0 }),
        ])

        const newPlusOneCount = plusOnesCountTowardCapacity ? (plusOnes?.length ?? 0) : 0
        const totalNeeded = (goingCount ?? 0) + (plusOneCount ?? 0) + 1 + newPlusOneCount
        if (totalNeeded > evtConfig.max_capacity) {
          finalStatus = 'waitlisted'
        }
      }
    }

    // Upsert RSVP (use service client to bypass RLS)
    const svcRsvp = createServiceClient()
    const { error: upsertErr } = await svcRsvp
      .from('rsvps')
      .upsert(
        { event_id: eventId, user_id: user.id, status: finalStatus },
        { onConflict: 'event_id,user_id' }
      )

    if (upsertErr) {
      console.error('[rsvp] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 })
    }

    // Handle plus-ones
    const svcPlusOne = createServiceClient()
    if (finalStatus === 'going' && plusOnes && plusOnes.length > 0) {
      // Delete existing plus-ones for this user+event, then insert new ones
      await svcPlusOne
        .from('event_plus_ones')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id)

      const plusOneRows = plusOnes.map((p) => ({
        event_id: eventId,
        user_id: user.id,
        guest_name: p.name.trim(),
        guest_email: p.email?.trim() || null,
      }))

      const { error: plusErr } = await svcPlusOne
        .from('event_plus_ones')
        .insert(plusOneRows)

      if (plusErr) {
        console.error('[rsvp] plus-one insert error:', plusErr)
      } else if (evtConfig?.group_id) {
        // Award guest_invite spirit points (fire-and-forget)
        awardSpiritPoints(user.id, evtConfig.group_id, 'guest_invite', eventId)
          .catch((err) => console.error('[rsvp] guest_invite spirit points error:', err))
      }
    } else if (finalStatus !== 'going') {
      // Remove plus-ones when not going
      await svcPlusOne
        .from('event_plus_ones')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id)
    }

    // Auto-add to channel_members when RSVPing going/maybe (not waitlisted)
    if (finalStatus === 'going' || finalStatus === 'maybe') {
      const svcClient = createServiceClient()
      const { data: eventChannel } = await svcClient
        .from('channels')
        .select('id')
        .eq('event_id', eventId)
        .eq('type', 'event_chat')
        .maybeSingle()

      if (eventChannel) {
        await svcClient.from('channel_members').upsert(
          {
            channel_id: eventChannel.id,
            user_id: user.id,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: 'channel_id,user_id' }
        )
      }
    }

    // Milestone check (fire-and-forget)
    if (finalStatus === 'going') {
      const svcMilestone = createServiceClient()
      const { count: currentGoingCount } = await svcMilestone
        .from('rsvps')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'going')

      if (currentGoingCount !== null) {
        const { data: evtData } = await svcMilestone
          .from('events')
          .select('group_id, max_capacity')
          .eq('id', eventId)
          .single()

        if (evtData) {
          checkRsvpMilestone(
            eventId,
            evtData.group_id,
            currentGoingCount,
            evtData.max_capacity,
            user.id
          ).catch((err) => console.error('[rsvp] milestone check error:', err))

          // First RSVP spirit points — award if this user is the only one going
          if (currentGoingCount === 1) {
            awardSpiritPoints(user.id, evtData.group_id, 'first_rsvp', eventId)
              .catch((err) => console.error('[rsvp] spirit points error:', err))
          }
        }
      }
    }

    // Send confirmation email for free events when status is 'going'
    if (finalStatus === 'going') {
      const serviceClient = createServiceClient()

      // Fetch event + group details
      const { data: event } = await serviceClient
        .from('events')
        .select('id, title, starts_at, ends_at, location, group_id, payment_type, groups ( name, slug )')
        .eq('id', eventId)
        .single()

      if (event && (event.payment_type === 'free' || !event.payment_type)) {
        // Fetch user profile for display name
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single()

        // Use auth email (always available) with profiles.email as fallback
        const recipientEmail = user.email || profile?.email
        if (recipientEmail) {
          const group = event.groups as unknown as { name: string; slug: string }
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
          const startDate = new Date(event.starts_at)
          const endDate = event.ends_at ? new Date(event.ends_at) : startDate
          const eventUrl = `${appUrl}/events/${eventId}`

          // Generate QR code from user ID
          const qrCodeBase64 = await QRCode.toDataURL(user.id, {
            width: 400,
            margin: 2,
            color: { dark: '#111827', light: '#FFFFFF' },
            errorCorrectionLevel: 'M',
          })

          // Await email send to ensure it completes before function terminates
          const emailResult = await sendRsvpConfirmationEmail(recipientEmail, {
            recipientName: profile?.full_name || 'there',
            eventTitle: event.title,
            eventDate: format(startDate, 'EEEE d MMMM yyyy'),
            eventTime: `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`,
            eventLocation: event.location,
            mapsUrl: event.location
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
              : null,
            eventUrl,
            groupName: group.name,
            qrCodeBase64,
            paidAmount: null,
            isGuest: false,
            signUpUrl: null,
          })
          if (!emailResult.success) {
            console.error('[rsvp] email send failed:', emailResult.error)
          }
        }
      }
    }

    // Waitlist promotion: when someone cancels, promote the first waitlisted user
    if (status === 'not_going') {
      const svc = createServiceClient()

      const { data: evt } = await svc
        .from('events')
        .select('id, title, starts_at, ends_at, location, max_capacity, group_id, groups ( name, slug )')
        .eq('id', eventId)
        .single()

      if (evt?.max_capacity) {
        // Check if there's now a free spot
        const { count: goingCount } = await svc
          .from('rsvps')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'going')

        if ((goingCount ?? 0) < evt.max_capacity) {
          // Find first waitlisted user
          const { data: nextInLine } = await svc
            .from('rsvps')
            .select('user_id')
            .eq('event_id', eventId)
            .eq('status', 'waitlisted')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()

          if (nextInLine) {
            // Promote to going
            await svc
              .from('rsvps')
              .update({ status: 'going' })
              .eq('event_id', eventId)
              .eq('user_id', nextInLine.user_id)

            const group = evt.groups as unknown as { name: string; slug: string }
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
            const eventUrl = `${appUrl}/events/${eventId}`
            const startDate = new Date(evt.starts_at)
            const endDate = evt.ends_at ? new Date(evt.ends_at) : startDate

            // Send push notification
            sendPushToUser(nextInLine.user_id, {
              title: `You're in! A spot opened up`,
              body: `${evt.title} — ${format(startDate, 'EEEE d MMM')} with ${group.name}`,
              url: eventUrl,
            }, 'waitlist').catch((err) => console.error('[rsvp] waitlist push error:', err))

            // Send email
            const { data: promotedProfile } = await svc
              .from('profiles')
              .select('full_name, email')
              .eq('id', nextInLine.user_id)
              .single()

            if (promotedProfile?.email) {
              const wlResult = await sendWaitlistEmail({
                recipientEmail: promotedProfile.email,
                recipientName: promotedProfile.full_name || 'there',
                eventTitle: evt.title,
                eventDate: format(startDate, 'EEEE d MMMM yyyy'),
                eventTime: `${format(startDate, 'h:mm a')} – ${format(endDate, 'h:mm a')}`,
                eventLocation: evt.location,
                eventUrl,
                groupName: group.name,
              })
              if (!wlResult.success) {
                console.error('[rsvp] waitlist email failed:', wlResult.error)
              }
            }

            // Auto-add promoted user to event chat channel
            const { data: eventChannel } = await svc
              .from('channels')
              .select('id')
              .eq('event_id', eventId)
              .eq('type', 'event_chat')
              .maybeSingle()

            if (eventChannel) {
              await svc.from('channel_members').upsert(
                {
                  channel_id: eventChannel.id,
                  user_id: nextInLine.user_id,
                  last_read_at: new Date().toISOString(),
                },
                { onConflict: 'channel_id,user_id' }
              )
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: finalStatus,
      plusOnes: finalStatus === 'going' ? (plusOnes?.length ?? 0) : 0,
    })
  } catch (err) {
    console.error('[rsvp] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
