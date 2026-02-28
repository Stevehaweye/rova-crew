import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canAccessGroup } from '@/lib/discovery'

// ─── Format dimensions ──────────────────────────────────────────────────────

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  stories: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  print: { width: 2480, height: 3508 },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const fmt = request.nextUrl.searchParams.get('format') ?? 'stories'
    const dims = FORMAT_DIMENSIONS[fmt] ?? FORMAT_DIMENSIONS.stories
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    // Check if flyer already exists in storage
    const storagePath = `flyers/${eventId}-${fmt}.png`
    const { data: existing } = await svc.storage
      .from('group-logos')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60)

    if (existing?.signedUrl) {
      return NextResponse.json({ url: existing.signedUrl })
    }

    // Fetch event + group
    const { data: event } = await svc
      .from('events')
      .select(
        'id, title, starts_at, ends_at, location, cover_url, group_id, groups ( name, slug, logo_url, primary_colour )'
      )
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Enterprise scope check
    const hasAccess = await canAccessGroup(event.group_id, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this event.' }, { status: 403 })
    }

    const group = event.groups as unknown as {
      name: string
      slug: string
      logo_url: string | null
      primary_colour: string
    }

    const colour = group.primary_colour.startsWith('#')
      ? group.primary_colour
      : `#${group.primary_colour}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const eventUrl = `${appUrl}/events/${eventId}`
    const startDate = new Date(event.starts_at)
    const endDate = event.ends_at ? new Date(event.ends_at) : startDate

    const dateStr = format(startDate, 'EEEE d MMMM yyyy')
    const timeStr = `${format(startDate, 'h:mm a')} – ${format(endDate, 'h:mm a')}`

    // Generate QR code data URL
    const qrDataUrl = await QRCode.toDataURL(eventUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#111827', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })

    // Layout scale factors based on format
    const scale = dims.width / 1080
    const coverHeight = fmt === 'square' ? Math.round(dims.height * 0.35) : fmt === 'print' ? Math.round(dims.height * 0.35) : 768
    const titleSize = Math.round(56 * scale)
    const dateSize = Math.round(28 * scale)
    const timeSize = Math.round(24 * scale)
    const qrSize = Math.round(200 * scale)
    const padding = Math.round(60 * scale)

    // Build flyer
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: dims.width,
            height: dims.height,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* Background gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(160deg, ${colour}ee, ${colour}cc, ${colour}88)`,
              display: 'flex',
            }}
          />

          {/* Top: Group identity */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              padding: `${padding}px ${padding}px ${Math.round(padding * 0.67)}px`,
              position: 'relative',
              zIndex: 2,
            }}
          >
            {group.logo_url ? (
              <img
                src={group.logo_url}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  border: '3px solid rgba(255,255,255,0.3)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {group.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
                display: 'flex',
              }}
            >
              {group.name}
            </div>
          </div>

          {/* Middle: Cover photo area */}
          <div
            style={{
              height: coverHeight,
              width: '100%',
              display: 'flex',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {event.cover_url ? (
              <img
                src={event.cover_url}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  position: 'absolute',
                }}
              />
            ) : null}
            {/* Gradient overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: event.cover_url
                  ? 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7))'
                  : `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.15) 100%)`,
                display: 'flex',
              }}
            />
            {/* Pattern if no cover */}
            {!event.cover_url && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.12,
                  backgroundImage:
                    'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                  display: 'flex',
                }}
              />
            )}
          </div>

          {/* Center: Event details */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: `${Math.round(padding * 0.67)}px ${padding}px`,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Event title */}
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 700,
                color: 'white',
                textAlign: 'center',
                lineHeight: 1.15,
                marginBottom: 24,
                textShadow: '0 2px 12px rgba(0,0,0,0.3)',
                maxWidth: 960,
                display: 'flex',
              }}
            >
              {event.title}
            </div>

            {/* Date */}
            <div
              style={{
                fontSize: dateSize,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.9)',
                textAlign: 'center',
                marginBottom: 8,
                display: 'flex',
              }}
            >
              {dateStr}
            </div>

            {/* Time */}
            <div
              style={{
                fontSize: timeSize,
                color: 'rgba(255,255,255,0.75)',
                textAlign: 'center',
                marginBottom: 16,
                display: 'flex',
              }}
            >
              {timeStr}
            </div>

            {/* Location */}
            {event.location && (
              <div
                style={{
                  fontSize: 22,
                  color: 'rgba(255,255,255,0.7)',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                📍 {event.location}
              </div>
            )}
          </div>

          {/* Bottom: QR code */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingBottom: 80,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: 24,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
            >
              <img
                src={qrDataUrl}
                style={{ width: qrSize, height: qrSize }}
              />
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 20,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                letterSpacing: 3,
                display: 'flex',
              }}
            >
              Scan to RSVP
            </div>
          </div>

          {/* Footer watermark */}
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: 16,
                color: 'rgba(255,255,255,0.35)',
                display: 'flex',
              }}
            >
              rova.crew
            </div>
          </div>
        </div>
      ),
      {
        width: dims.width,
        height: dims.height,
      }
    )

    // Convert to buffer
    const imageBuffer = await imageResponse.arrayBuffer()

    // Upload to Supabase Storage
    const { error: uploadErr } = await svc.storage
      .from('group-logos')
      .upload(storagePath, Buffer.from(imageBuffer), {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[flyer] upload error:', uploadErr)
    }

    // Generate signed URL
    const { data: signedData } = await svc.storage
      .from('group-logos')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60)

    if (signedData?.signedUrl) {
      return NextResponse.json({ url: signedData.signedUrl })
    }

    // Fallback: return image directly
    return new NextResponse(Buffer.from(imageBuffer), {
      headers: { 'Content-Type': 'image/png' },
    })
  } catch (err) {
    console.error('[flyer] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
