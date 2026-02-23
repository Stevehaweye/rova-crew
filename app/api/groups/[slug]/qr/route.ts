import QRCode from 'qrcode'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url = `${appUrl}/g/${slug}`

  // Generate QR code as SVG — no canvas dependency required
  const svg = await QRCode.toString(url, {
    type: 'svg',
    width: 400,
    margin: 2,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  })

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
