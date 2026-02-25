import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateEventSummary } from '@/lib/post-event-summary'
import { getConsentRestrictedMembers } from '@/lib/photo-consent'

export async function GET(
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

    // Check if card already exists in storage
    const storagePath = `${eventId}.png`
    const { data: existing } = await svc.storage
      .from('summary-cards')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60) // 7 days

    if (existing?.signedUrl) {
      return NextResponse.json({ url: existing.signedUrl })
    }

    // Generate summary data
    const summary = await generateEventSummary(eventId)
    if (!summary) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check consent restrictions
    const attendeeIds = summary.attendees.map((a) => a.userId)
    const { hasRestrictions } = await getConsentRestrictedMembers(
      summary.group.id,
      attendeeIds
    )

    // Generate 1080x1080 card image
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: 1080,
            height: 1080,
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
              background: `linear-gradient(135deg, ${summary.group.colour}ff, ${summary.group.colour}88, ${summary.group.colour}44)`,
              display: 'flex',
            }}
          />

          {/* Top section with cover photo or colour block */}
          <div
            style={{
              height: 432,
              width: '100%',
              display: 'flex',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {summary.event.coverUrl && !hasRestrictions ? (
              <img
                src={summary.event.coverUrl}
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
                background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.6))',
                display: 'flex',
              }}
            />
          </div>

          {/* Centre content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 60px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Group logo placeholder */}
            {summary.group.logoUrl ? (
              <img
                src={summary.group.logoUrl}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  marginBottom: 24,
                  border: '3px solid rgba(255,255,255,0.3)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  marginBottom: 24,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {summary.group.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Event title */}
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: 'white',
                textAlign: 'center',
                lineHeight: 1.2,
                marginBottom: 16,
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                maxWidth: 900,
                display: 'flex',
              }}
            >
              {summary.event.title}
            </div>

            {/* Date and location */}
            <div
              style={{
                fontSize: 24,
                color: 'rgba(255,255,255,0.85)',
                textAlign: 'center',
                marginBottom: 32,
                display: 'flex',
              }}
            >
              {summary.event.date}
              {summary.event.location ? ` · ${summary.event.location}` : ''}
            </div>

            {/* Attendance count */}
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: 'white',
                backgroundColor: 'rgba(0,0,0,0.25)',
                borderRadius: 16,
                padding: '12px 32px',
                display: 'flex',
              }}
            >
              {summary.attendance.attendedCount} people attended
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
                fontSize: 18,
                color: 'rgba(255,255,255,0.4)',
                display: 'flex',
              }}
            >
              rova.crew
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
      }
    )

    // Convert ImageResponse to buffer
    const imageBuffer = await imageResponse.arrayBuffer()

    // Upload to Supabase Storage
    const { error: uploadErr } = await svc.storage
      .from('summary-cards')
      .upload(storagePath, Buffer.from(imageBuffer), {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[summary-card] upload error:', uploadErr)
      // Still return the image even if storage upload fails
    }

    // Generate signed URL
    const { data: signedData } = await svc.storage
      .from('summary-cards')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60)

    if (signedData?.signedUrl) {
      return NextResponse.json({ url: signedData.signedUrl })
    }

    // Fallback: return image directly
    return new NextResponse(Buffer.from(imageBuffer), {
      headers: { 'Content-Type': 'image/png' },
    })
  } catch (err) {
    console.error('[summary-card] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
