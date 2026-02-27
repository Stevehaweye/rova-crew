import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST() {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const svc = createServiceClient()

    // Fetch user's current profile to get company_id
    const { data: profile } = await svc
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json(
        { error: 'No company association found' },
        { status: 400 }
      )
    }

    const originalCompanyId = profile.company_id

    // 1. Clear company fields from profile
    const { error: profileErr } = await svc
      .from('profiles')
      .update({
        company_id: null,
        work_email: null,
        work_location: null,
        department: null,
        work_email_is_primary: false,
      })
      .eq('id', user.id)

    if (profileErr) {
      console.error('[depart-company] profile update error:', profileErr)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    // 2. Fetch company-scoped group IDs (exclude public scope)
    const { data: scopeRows } = await svc
      .from('group_scope')
      .select('group_id')
      .eq('company_id', originalCompanyId)
      .neq('scope_type', 'public')

    const scopedGroupIds = (scopeRows ?? []).map((r) => r.group_id)

    // 3. Mark user as 'departed' in company-scoped groups
    if (scopedGroupIds.length > 0) {
      const { error: memberErr } = await svc
        .from('group_members')
        .update({ status: 'departed' })
        .eq('user_id', user.id)
        .in('group_id', scopedGroupIds)

      if (memberErr) {
        console.error('[depart-company] group_members update error:', memberErr)
        // Non-fatal: profile already updated, log and continue
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[depart-company] unexpected error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
