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

// Bump when the flyer template changes so old cached PNGs get regenerated.
const TEMPLATE_VERSION = 2

// ─── Helpers ────────────────────────────────────────────────────────────────

function normaliseHex(raw: string | null | undefined): string {
  if (!raw) return '#0D7377'
  return raw.startsWith('#') ? raw : `#${raw}`
}

/** Perceived luminance (0–1). >0.6 = "light" for our purposes. */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 0.3
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Truncate a description to something readable on a flyer. */
function truncate(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1).trimEnd() + '…'
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

    const storagePath = `flyers/${eventId}-${fmt}-v${TEMPLATE_VERSION}.png`
    const { data: existing } = await svc.storage
      .from('group-logos')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60)

    if (existing?.signedUrl) {
      return NextResponse.json({ url: existing.signedUrl })
    }

    const { data: event } = await svc
      .from('events')
      .select(
        'id, title, description, starts_at, ends_at, location, cover_url, group_id, groups ( name, slug, logo_url, primary_colour )'
      )
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

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

    const brand = normaliseHex(group.primary_colour)
    // Guarantee readable contrast: the content panel is always dark so the
    // white event text stays legible regardless of the group's brand colour.
    // The brand colour is used as an accent — top strip, date pill, tint on
    // the panel — never as the base background.
    const brandIsLight = luminance(brand) > 0.55
    const panelBg = '#0F172A' // slate-900 — high-contrast base for white text
    const accent = brandIsLight ? '#111827' : brand // avoid pale-on-white

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const eventUrl = `${appUrl}/events/${eventId}`
    const startDate = new Date(event.starts_at)
    const endDate = event.ends_at ? new Date(event.ends_at) : startDate

    const dateStr = format(startDate, 'EEEE d MMMM yyyy')
    const timeStr = `${format(startDate, 'h:mm a')} – ${format(endDate, 'h:mm a')}`
    const description = typeof event.description === 'string' ? truncate(event.description, 220) : null

    // Scale every size by the canvas width so print (2480px) is legible.
    const scale = dims.width / 1080
    const px = (base: number) => Math.round(base * scale)

    // Layout sizes (base = 1080-wide canvas).
    const brandStripHeight = px(14)
    const headerPadX = px(56)
    const headerPadY = px(40)
    const headerLogoSize = px(96)
    const headerNameSize = px(38)
    const coverHeight = Math.round(dims.height * (fmt === 'stories' ? 0.42 : 0.44))
    const contentPad = px(64)
    const titleSize = fmt === 'print' ? px(80) : px(68)
    const datePillPadX = px(28)
    const datePillPadY = px(14)
    const dateSize = px(30)
    const timeSize = px(26)
    const locationSize = px(30)
    const descriptionSize = px(24)
    const qrSize = px(240)
    const qrLabelSize = px(24)
    const qrUrlSize = px(20)

    const qrDataUrl = await QRCode.toDataURL(eventUrl, {
      width: qrSize,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })

    const displayUrl = eventUrl.replace(/^https?:\/\//, '')

    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: dims.width,
            height: dims.height,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'sans-serif',
            backgroundColor: panelBg,
          }}
        >
          {/* Brand strip */}
          <div style={{ height: brandStripHeight, width: '100%', backgroundColor: accent, display: 'flex' }} />

          {/* Header: logo + group name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: px(24),
              padding: `${headerPadY}px ${headerPadX}px`,
            }}
          >
            {group.logo_url ? (
              <img
                src={group.logo_url}
                style={{
                  width: headerLogoSize,
                  height: headerLogoSize,
                  borderRadius: px(20),
                  border: `${px(4)}px solid rgba(255,255,255,0.35)`,
                }}
              />
            ) : (
              <div
                style={{
                  width: headerLogoSize,
                  height: headerLogoSize,
                  borderRadius: px(20),
                  backgroundColor: accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: px(40),
                  fontWeight: 800,
                }}
              >
                {group.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: headerNameSize,
                  fontWeight: 800,
                  color: 'white',
                  letterSpacing: -0.5,
                  display: 'flex',
                }}
              >
                {group.name}
              </div>
              <div
                style={{
                  fontSize: px(20),
                  color: 'rgba(255,255,255,0.55)',
                  marginTop: px(4),
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  display: 'flex',
                }}
              >
                You&apos;re invited
              </div>
            </div>
          </div>

          {/* Cover photo */}
          <div style={{ height: coverHeight, width: '100%', display: 'flex', position: 'relative', overflow: 'hidden' }}>
            {event.cover_url ? (
              <img
                src={event.cover_url}
                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: accent, display: 'flex' }} />
            )}
            {/* Bottom fade so title anchors on top of image */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, transparent 55%, rgba(15,23,42,0.95))',
                display: 'flex',
              }}
            />
          </div>

          {/* Content panel */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: `${contentPad}px ${contentPad}px ${px(48)}px`,
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 900,
                color: 'white',
                lineHeight: 1.05,
                letterSpacing: -1,
                display: 'flex',
              }}
            >
              {event.title}
            </div>

            {/* Date pill + time */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: px(20),
                marginTop: px(36),
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  backgroundColor: accent,
                  padding: `${datePillPadY}px ${datePillPadX}px`,
                  borderRadius: px(999),
                  fontSize: dateSize,
                  fontWeight: 700,
                  color: 'white',
                  display: 'flex',
                }}
              >
                {dateStr}
              </div>
              <div
                style={{
                  fontSize: timeSize,
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 600,
                  display: 'flex',
                }}
              >
                {timeStr}
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div
                style={{
                  fontSize: locationSize,
                  color: 'white',
                  fontWeight: 600,
                  marginTop: px(24),
                  display: 'flex',
                  alignItems: 'center',
                  gap: px(10),
                }}
              >
                <span style={{ display: 'flex' }}>📍</span>
                <span style={{ display: 'flex' }}>{event.location}</span>
              </div>
            )}

            {/* Description */}
            {description && (
              <div
                style={{
                  fontSize: descriptionSize,
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.45,
                  marginTop: px(28),
                  maxWidth: dims.width - contentPad * 2,
                  display: 'flex',
                }}
              >
                {description}
              </div>
            )}

            {/* Bottom row: QR + label */}
            <div
              style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: px(28),
              }}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: px(20),
                  padding: px(16),
                  display: 'flex',
                }}
              >
                <img src={qrDataUrl} style={{ width: qrSize, height: qrSize }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: px(6) }}>
                <div
                  style={{
                    fontSize: qrLabelSize,
                    color: 'white',
                    fontWeight: 800,
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    display: 'flex',
                  }}
                >
                  Scan to RSVP
                </div>
                <div
                  style={{
                    fontSize: qrUrlSize,
                    color: 'rgba(255,255,255,0.55)',
                    display: 'flex',
                  }}
                >
                  {displayUrl}
                </div>
                <div
                  style={{
                    fontSize: qrUrlSize,
                    color: 'rgba(255,255,255,0.35)',
                    marginTop: px(6),
                    display: 'flex',
                  }}
                >
                  rova.crew
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: dims.width,
        height: dims.height,
      }
    )

    const imageBuffer = await imageResponse.arrayBuffer()

    const { error: uploadErr } = await svc.storage
      .from('group-logos')
      .upload(storagePath, Buffer.from(imageBuffer), {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[flyer] upload error:', uploadErr)
    }

    const { data: signedData } = await svc.storage
      .from('group-logos')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60)

    if (signedData?.signedUrl) {
      return NextResponse.json({ url: signedData.signedUrl })
    }

    return new NextResponse(Buffer.from(imageBuffer), {
      headers: { 'Content-Type': 'image/png' },
    })
  } catch (err) {
    console.error('[flyer] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
