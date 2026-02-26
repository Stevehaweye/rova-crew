import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      slug,
      tagline,
      description,
      category,
      location,
      logoUrl,
      primaryColour,
      isPublic,
      joinApprovalRequired,
      migrationSource,
    } = body

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Insert group via service client (bypasses RLS)
    const { data: group, error: groupErr } = await serviceClient
      .from('groups')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        tagline: tagline?.trim() || null,
        description: description?.trim() || null,
        category: category || null,
        location: location?.trim() || null,
        logo_url: logoUrl || null,
        primary_colour: (primaryColour || '0D7377').replace('#', ''),
        is_public: isPublic ?? true,
        join_approval_required: joinApprovalRequired ?? false,
        created_by: user.id,
        ...(migrationSource ? { migration_source: migrationSource } : {}),
      })
      .select('id, slug')
      .single()

    if (groupErr) {
      console.error('[api/groups] insert error:', groupErr)
      return NextResponse.json({ error: groupErr.message }, { status: 500 })
    }

    // Add creator as super_admin (via service client — guaranteed to succeed)
    const { error: memberErr } = await serviceClient
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
        role: 'super_admin',
        status: 'approved',
      })

    if (memberErr) {
      console.error('[api/groups] member insert error:', memberErr)
      return NextResponse.json({ error: 'Group created but failed to set admin role' }, { status: 500 })
    }

    // Initialise member_stats row
    await serviceClient.from('member_stats').insert({
      user_id: user.id,
      group_id: group.id,
    })

    return NextResponse.json({ success: true, groupId: group.id, slug: group.slug })
  } catch (err) {
    console.error('[api/groups] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
