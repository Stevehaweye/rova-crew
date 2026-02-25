import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { calculateGroupHealthScore } from '@/lib/health-score'

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
    const { data: group } = await svc
      .from('groups')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const result = await calculateGroupHealthScore(group.id)
    return NextResponse.json({ score: result.score })
  } catch (err) {
    console.error('[health-score-recalc] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
