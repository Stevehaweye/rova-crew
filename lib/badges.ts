import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/push-sender'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AwardedBadge {
  slug: string
  name: string
  emoji: string
}

interface BadgeCriteria {
  type: string
  value: number | boolean
  min_events?: number
  action?: string
}

interface BadgeRow {
  id: string
  slug: string
  name: string
  emoji: string
  criteria: BadgeCriteria
}

// ─── checkAndAwardBadges ────────────────────────────────────────────────────

export async function checkAndAwardBadges(
  userId: string,
  groupId: string
): Promise<AwardedBadge[]> {
  const svc = createServiceClient()

  // Parallel fetch all needed data
  const [statsResult, badgesResult, awardsResult, membershipResult, groupResult] =
    await Promise.all([
      svc
        .from('member_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .maybeSingle(),
      svc.from('badges').select('id, slug, name, emoji, criteria'),
      svc
        .from('badge_awards')
        .select('badge_id')
        .eq('user_id', userId)
        .eq('group_id', groupId),
      svc
        .from('group_members')
        .select('joined_at')
        .eq('user_id', userId)
        .eq('group_id', groupId)
        .maybeSingle(),
      svc
        .from('groups')
        .select('created_at, name, slug, badge_announcements_enabled')
        .eq('id', groupId)
        .maybeSingle(),
    ])

  const stats = statsResult.data
  if (!stats) return []

  const badges = (badgesResult.data ?? []) as BadgeRow[]
  const existingAwardIds = new Set((awardsResult.data ?? []).map((a) => a.badge_id))
  const joinedAt = membershipResult.data?.joined_at
    ? new Date(membershipResult.data.joined_at)
    : null
  const group = groupResult.data
  const groupCreatedAt = group?.created_at ? new Date(group.created_at) : null

  // Compute derived values
  const now = new Date()
  const tenureDays = joinedAt
    ? Math.floor((now.getTime() - joinedAt.getTime()) / 86400000)
    : 0
  const isFoundingMember =
    joinedAt && groupCreatedAt
      ? joinedAt.getTime() - groupCreatedAt.getTime() <= 30 * 86400000
      : false

  // Collect spirit_log criteria that need checking
  const unawardedBadges = badges.filter((b) => !existingAwardIds.has(b.id))
  const spiritLogActions = new Set<string>()
  for (const badge of unawardedBadges) {
    const c = badge.criteria
    if (c?.type === 'spirit_log' && c.action) {
      spiritLogActions.add(c.action)
    }
  }

  // Batch query spirit_points_log for action counts (if needed)
  const spiritLogCounts = new Map<string, number>()
  if (spiritLogActions.size > 0) {
    const { data: logRows } = await svc
      .from('spirit_points_log')
      .select('action_type')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .in('action_type', Array.from(spiritLogActions))

    if (logRows) {
      for (const row of logRows) {
        spiritLogCounts.set(
          row.action_type,
          (spiritLogCounts.get(row.action_type) ?? 0) + 1
        )
      }
    }
  }

  // Evaluate each unawarded badge
  const newAwards: { user_id: string; group_id: string; badge_id: string }[] = []
  const awardedBadges: (BadgeRow & { badge_id: string })[] = []

  for (const badge of unawardedBadges) {
    const criteria = badge.criteria
    if (!criteria?.type) continue

    let earned = false

    switch (criteria.type) {
      case 'events_attended':
        earned = stats.events_attended >= (criteria.value as number)
        break
      case 'attendance_rate':
        earned =
          stats.attendance_rate >= (criteria.value as number) &&
          stats.events_attended >= (criteria.min_events ?? 0)
        break
      case 'messages_sent':
        earned = stats.messages_sent >= (criteria.value as number)
        break
      case 'reactions_given':
        earned = stats.reactions_given >= (criteria.value as number)
        break
      case 'guest_converts':
        earned = stats.guest_converts >= (criteria.value as number)
        break
      case 'current_streak':
        // Use best_streak so badges aren't lost when streak resets
        earned = stats.best_streak >= (criteria.value as number)
        break
      case 'tenure_days':
        earned = tenureDays >= (criteria.value as number)
        break
      case 'founding_member':
        earned = isFoundingMember
        break
      case 'spirit_log':
        if (criteria.action) {
          const count = spiritLogCounts.get(criteria.action) ?? 0
          earned = count >= (criteria.value as number)
        }
        break
    }

    if (earned) {
      newAwards.push({ user_id: userId, group_id: groupId, badge_id: badge.id })
      awardedBadges.push({ ...badge, badge_id: badge.id })
    }
  }

  if (newAwards.length === 0) return []

  // Batch insert, skip conflicts (badge already awarded)
  const { error } = await svc
    .from('badge_awards')
    .insert(newAwards)

  if (error) {
    console.error('[badges] award insert error:', error)
    return []
  }

  // Fire-and-forget celebrations for each new badge
  if (group) {
    for (const badge of awardedBadges) {
      awardBadgeCelebration(userId, groupId, badge, group, svc).catch((err) =>
        console.error('[badges] celebration error:', err)
      )
    }
  }

  return awardedBadges.map((b) => ({ slug: b.slug, name: b.name, emoji: b.emoji }))
}

// ─── Badge celebration ──────────────────────────────────────────────────────

async function awardBadgeCelebration(
  userId: string,
  groupId: string,
  badge: { id: string; slug: string; name: string; emoji: string; badge_id: string },
  group: { name: string; slug: string; badge_announcements_enabled: boolean },
  svc: ReturnType<typeof createServiceClient>
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // 1. Push notification
  sendPushToUser(
    userId,
    {
      title: 'New badge earned!',
      body: `You earned the ${badge.emoji} ${badge.name} badge in ${group.name}!`,
      url: `${appUrl}/g/${group.slug}`,
    },
    'badge_celebration'
  ).catch(() => {})

  // 2. System message in announcements channel (if enabled)
  if (group.badge_announcements_enabled) {
    const [channelResult, profileResult] = await Promise.all([
      svc
        .from('channels')
        .select('id')
        .eq('group_id', groupId)
        .eq('type', 'announcements')
        .maybeSingle(),
      svc.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    ])

    const channelId = channelResult.data?.id
    const firstName = profileResult.data?.full_name?.split(' ')[0] ?? 'A member'

    if (channelId) {
      await svc.from('messages').insert({
        channel_id: channelId,
        sender_id: userId,
        content: `${badge.emoji} ${firstName} just earned the ${badge.name} badge!`,
        content_type: 'system',
      })
    }
  }

  // 3. Mark as announced
  await svc
    .from('badge_awards')
    .update({ announced_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .eq('badge_id', badge.badge_id)
}
