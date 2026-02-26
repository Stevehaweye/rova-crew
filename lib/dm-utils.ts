import { createServiceClient } from '@/lib/supabase/service'

/**
 * Find or create a DM channel between two users.
 * Returns the channel ID.
 */
export async function findOrCreateDmChannel(
  userA: string,
  userB: string
): Promise<string> {
  const svc = createServiceClient()

  // ── Find existing DM channel ─────────────────────────────────────────────
  const { data: aMemberships } = await svc
    .from('channel_members')
    .select('channel_id, channels!inner(id, type)')
    .eq('user_id', userA)

  const dmChannelIds = (aMemberships ?? [])
    .filter((cm) => (cm.channels as unknown as { type: string })?.type === 'dm')
    .map((cm) => cm.channel_id)

  if (dmChannelIds.length > 0) {
    const { data: existing } = await svc
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', userB)
      .in('channel_id', dmChannelIds)
      .limit(1)
      .maybeSingle()

    if (existing) return existing.channel_id
  }

  // ── Create new DM channel ────────────────────────────────────────────────
  const { data: newChannel, error: channelErr } = await svc
    .from('channels')
    .insert({ type: 'dm', group_id: null, name: 'DM' })
    .select('id')
    .single()

  if (channelErr || !newChannel) {
    throw new Error(`Failed to create DM channel: ${channelErr?.message}`)
  }

  const now = new Date().toISOString()
  await svc.from('channel_members').insert([
    { channel_id: newChannel.id, user_id: userA, last_read_at: now },
    { channel_id: newChannel.id, user_id: userB, last_read_at: now },
  ])

  return newChannel.id
}
