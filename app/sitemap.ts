import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/service'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rovacrew.com'
  const svc = createServiceClient()

  // Static pages
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/discover`,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ]

  // Dynamic: public groups
  const { data: groups } = await svc
    .from('groups')
    .select('slug, updated_at')
    .eq('is_public', true)

  const groupEntries: MetadataRoute.Sitemap = (groups ?? []).map((g) => ({
    url: `${baseUrl}/g/${g.slug}`,
    lastModified: g.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Dynamic: upcoming public events
  const { data: events } = await svc
    .from('events')
    .select('id, updated_at, groups!inner(is_public)')
    .eq('groups.is_public', true)
    .gte('starts_at', new Date().toISOString())
    .limit(100)

  const eventEntries: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
    url: `${baseUrl}/events/${e.id}`,
    lastModified: e.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticEntries, ...groupEntries, ...eventEntries]
}
