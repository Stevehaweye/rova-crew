import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendRsvpConfirmationEmail } from '@/lib/email'

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

    // Upsert RSVP
    const { error: upsertErr } = await supabase
      .from('rsvps')
      .upsert(
        { event_id: eventId, user_id: user.id, status },
        { onConflict: 'event_id,user_id' }
      )

    if (upsertErr) {
      console.error('[rsvp] upsert error:', upsertErr)
      return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 })
    }

    // Auto-add to channel_members when RSVPing going/maybe
    if (status === 'going' || status === 'maybe') {
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
    if (status === 'going') {
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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[rsvp] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
