import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendRsvpConfirmationEmail, sendWaitlistEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-sender'

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

    if (!status || !['going', 'maybe', 'not_going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Capacity check: auto-waitlist if event is full
    let finalStatus = status
    if (status === 'going') {
      const svc = createServiceClient()
      const { data: evt } = await svc
        .from('events')
        .select('max_capacity')
        .eq('id', eventId)
        .single()

      if (evt?.max_capacity) {
        const { count: goingCount } = await svc
          .from('rsvps')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'going')
          .neq('user_id', user.id)

        if ((goingCount ?? 0) >= evt.max_capacity) {
          finalStatus = 'waitlisted'
        }
      }
    }

    // Upsert RSVP
    const { error: upsertErr } = await supabase
      .from('rsvps')
      .upsert(
        { event_id: eventId, user_id: user.id, status: finalStatus },
        { onConflict: 'event_id,user_id' }
      )

    if (upsertErr) {
      console.error('[rsvp] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 })
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
        // Fetch user profile
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single()

        if (profile?.email) {
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

          // Fire-and-forget email
          sendRsvpConfirmationEmail(profile.email, {
            recipientName: profile.full_name || 'there',
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
          }).catch((err) => console.error('[rsvp] email send error:', err))
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
            }).catch((err) => console.error('[rsvp] waitlist push error:', err))

            // Send email
            const { data: promotedProfile } = await svc
              .from('profiles')
              .select('full_name, email')
              .eq('id', nextInLine.user_id)
              .single()

            if (promotedProfile?.email) {
              sendWaitlistEmail({
                recipientEmail: promotedProfile.email,
                recipientName: promotedProfile.full_name || 'there',
                eventTitle: evt.title,
                eventDate: format(startDate, 'EEEE d MMMM yyyy'),
                eventTime: `${format(startDate, 'h:mm a')} – ${format(endDate, 'h:mm a')}`,
                eventLocation: evt.location,
                eventUrl,
                groupName: group.name,
              }).catch((err) => console.error('[rsvp] waitlist email error:', err))
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

    return NextResponse.json({ success: true, status: finalStatus })
  } catch (err) {
    console.error('[rsvp] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
