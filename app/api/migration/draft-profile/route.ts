import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const VALID_CATEGORIES = [
  'Running',
  'Cycling',
  'Walking',
  'Yoga',
  'Football',
  'Book Club',
  'Social',
  'Photography',
  'Volunteer',
  'Dog Walking',
  'Knitting',
  'Other',
] as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, context } = await request.json()

  if (!name || typeof name !== 'string' || name.trim().length < 3) {
    return NextResponse.json(
      { error: 'Name must be at least 3 characters' },
      { status: 400 }
    )
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `You are helping someone migrate their WhatsApp group to ROVA Crew, a community platform for sports and social groups. Generate a group profile based on the group name and any context provided. Return ONLY valid JSON with these fields:
- "description": A warm, inviting 2-3 sentence description (max 280 chars)
- "tagline": A catchy one-liner (max 60 chars)
- "category": Must be exactly one of: Running, Cycling, Walking, Yoga, Football, Book Club, Social, Photography, Volunteer, Dog Walking, Knitting, Other

Return ONLY the JSON object, no markdown or explanation.`,
      messages: [
        {
          role: 'user',
          content: `Group name: "${name.trim()}"${context ? `\nAdditional context: "${context.trim()}"` : ''}`,
        },
      ],
    })

    const text =
      message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text)

    return NextResponse.json({
      description:
        typeof parsed.description === 'string'
          ? parsed.description.slice(0, 300)
          : '',
      tagline:
        typeof parsed.tagline === 'string'
          ? parsed.tagline.slice(0, 60)
          : '',
      category: (VALID_CATEGORIES as readonly string[]).includes(
        parsed.category
      )
        ? parsed.category
        : 'Other',
    })
  } catch (err) {
    console.error('[migration/draft-profile] AI error:', err)
    return NextResponse.json({
      description: '',
      tagline: '',
      category: 'Other',
    })
  }
}
