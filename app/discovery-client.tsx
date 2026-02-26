'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupCard {
  id: string
  name: string
  slug: string
  tagline: string | null
  category: string
  logoUrl: string | null
  heroUrl: string | null
  primaryColour: string
  memberCount: number
  nextEventDate: string | null
  location: string | null
}

interface UpcomingEvent {
  id: string
  title: string
  startsAt: string
  location: string | null
}

interface Props {
  groups: GroupCard[]
  trendingGroups?: GroupCard[]
  recommendedGroups?: GroupCard[]
  stats: { communities: number; members: number; eventsThisMonth: number }
  isLoggedIn?: boolean
  jsonLd?: string
  upcomingEvents?: UpcomingEvent[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAL = '#0D7377'
const GOLD = '#C9982A'

const CATEGORIES = [
  { label: 'All', emoji: '' },
  { label: 'Running', emoji: '🏃' },
  { label: 'Cycling', emoji: '🚴' },
  { label: 'Walking', emoji: '🥾' },
  { label: 'Yoga', emoji: '🧘' },
  { label: 'Football', emoji: '⚽' },
  { label: 'Book Club', emoji: '📚' },
  { label: 'Social', emoji: '🍽️' },
  { label: 'Photography', emoji: '📷' },
  { label: 'Volunteer', emoji: '🤝' },
  { label: 'Dog Walking', emoji: '🐕' },
  { label: 'Knitting', emoji: '🧶' },
  { label: 'Other', emoji: '✨' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstInitial(name: string) {
  return (name[0] ?? '?').toUpperCase()
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ stats, isLoggedIn }: { stats: Props['stats']; isLoggedIn?: boolean }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0D7377 0%, #0A5C60 50%, #074548 100%)',
      }}
    >
      {/* Dot grid texture */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,255,255,0.08), transparent)',
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-20 sm:py-28 lg:py-36 text-center min-h-[50vh] sm:min-h-[70vh] flex flex-col items-center justify-center">
        {/* Wordmark */}
        <div className="mb-6">
          <span className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-[0.12em] text-white">
            ROVA
          </span>
          <span
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-[0.12em]"
            style={{ color: GOLD }}
          >
            CREW
          </span>
        </div>

        {/* Tagline */}
        <h1 className="text-white text-xl sm:text-2xl lg:text-3xl font-light tracking-wide mb-4">
          Your community. Organised.
        </h1>
        <p className="text-white/60 text-sm sm:text-base max-w-lg mx-auto leading-relaxed mb-10">
          Join or create activity groups, manage events, and never miss a thing — all in one place.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-12">
          <a
            href="#groups"
            className="px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all hover:shadow-lg hover:shadow-white/10 hover:-translate-y-0.5"
            style={{ backgroundColor: '#fff', color: TEAL }}
          >
            Find a group near you
          </a>
          <Link
            href={isLoggedIn ? '/groups/new' : '/auth?next=/groups/new'}
            className="px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide border-2 border-white/30 text-white transition-all hover:border-white/60 hover:bg-white/5 hover:-translate-y-0.5"
          >
            Create your community
          </Link>
        </div>

        {/* Stats strip */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 text-white/40 text-xs sm:text-sm font-medium">
          <span>
            <strong className="text-white/70">{stats.communities}</strong> communities
          </span>
          <span className="text-white/20">·</span>
          <span>
            <strong className="text-white/70">{stats.members}</strong> members
          </span>
          <span className="text-white/20">·</span>
          <span>
            <strong className="text-white/70">{stats.eventsThisMonth}</strong> events this month
          </span>
        </div>
      </div>

      {/* Bottom fade to white */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent" />
    </section>
  )
}

// ─── Search / Filter Bar ──────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
}: {
  search: string
  onSearchChange: (v: string) => void
  category: string
  onCategoryChange: (v: string) => void
}) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        {/* Search input */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search communities..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
            style={{ '--tw-ring-color': TEAL } as React.CSSProperties}
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {CATEGORIES.map((cat) => {
            const active = category === cat.label || (cat.label === 'All' && !category)
            return (
              <button
                key={cat.label}
                onClick={() => onCategoryChange(cat.label === 'All' ? '' : cat.label)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
                style={
                  active
                    ? { backgroundColor: TEAL, color: '#fff' }
                    : { backgroundColor: '#F3F4F6', color: '#4B5563' }
                }
              >
                {cat.emoji && <span className="mr-1">{cat.emoji}</span>}
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Group Card ───────────────────────────────────────────────────────────────

function GroupCardComponent({ group }: { group: GroupCard }) {
  const nextDate = group.nextEventDate
    ? format(new Date(group.nextEventDate), 'EEE d MMM')
    : null

  return (
    <Link
      href={`/g/${group.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-teal-200 flex flex-col"
    >
      {/* Image area */}
      <div className="relative h-[200px] overflow-hidden">
        {group.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.heroUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: group.primaryColour }}>
            {/* Dot pattern */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.2) 100%)',
              }}
            />
          </div>
        )}

        {/* Logo overlay */}
        <div
          className="absolute bottom-3 left-3 w-10 h-10 rounded-xl ring-2 ring-white shadow-lg flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0"
          style={{ backgroundColor: group.primaryColour + 'dd' }}
        >
          {group.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            firstInitial(group.name)
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 pt-4 pb-2">
        <h3 className="font-bold text-gray-900 text-[15px] leading-snug truncate group-hover:text-teal-700 transition-colors">
          {group.name}
        </h3>
        {group.tagline && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
            {group.tagline}
          </p>
        )}

        <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-3">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: group.primaryColour + '15', color: group.primaryColour }}
          >
            {group.category}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <UsersIcon />
            {group.memberCount}
          </span>
          {group.location && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPinIcon />
              {group.location}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <CalendarIcon />
            {nextDate ?? 'No upcoming events'}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 mt-auto">
        <span
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border-2 text-xs font-bold transition-colors group-hover:text-white group-hover:border-transparent"
          style={{
            borderColor: TEAL,
            color: TEAL,
            '--hover-bg': TEAL,
          } as React.CSSProperties}
        >
          <span className="group-hover:hidden">View group</span>
          <span className="hidden group-hover:inline">View group</span>
          <ChevronRight />
        </span>
      </div>
    </Link>
  )
}

// ─── Trending Horizontal Scroll ──────────────────────────────────────────────

function TrendingSection({ groups }: { groups: GroupCard[] }) {
  if (groups.length === 0) return null

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🔥</span>
        <h2 className="text-base font-bold text-gray-900">Trending this month</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 scrollbar-hide">
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/g/${g.slug}`}
            className="flex-shrink-0 w-56 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="h-28 relative overflow-hidden">
              {g.heroUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.heroUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={{ backgroundColor: g.primaryColour }}>
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{
                      backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)',
                      backgroundSize: '16px 16px',
                    }}
                  />
                </div>
              )}
              <div
                className="absolute bottom-2 left-2 w-8 h-8 rounded-lg ring-2 ring-white shadow flex items-center justify-center text-white font-bold text-xs overflow-hidden"
                style={{ backgroundColor: g.primaryColour + 'dd' }}
              >
                {g.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  firstInitial(g.name)
                )}
              </div>
            </div>
            <div className="p-3">
              <p className="font-bold text-sm text-gray-900 truncate">{g.name}</p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <UsersIcon /> {g.memberCount}
                </span>
                {g.location && (
                  <span className="flex items-center gap-0.5 truncate">
                    <MapPinIcon /> {g.location}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ─── Recommended Section ─────────────────────────────────────────────────────

function RecommendedSection({ groups }: { groups: GroupCard[] }) {
  if (groups.length === 0) return null

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">✨</span>
        <h2 className="text-base font-bold text-gray-900">Recommended for you</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {groups.map((g) => (
          <GroupCardComponent key={g.id} group={g} />
        ))}
      </div>
    </section>
  )
}

// ─── Upcoming Events Section ─────────────────────────────────────────────

function UpcomingEventsSection({ events }: { events: UpcomingEvent[] }) {
  if (events.length === 0) return null

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📅</span>
        <h2 className="text-base font-bold text-gray-900">Upcoming events</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {events.map((ev) => {
          const start = new Date(ev.startsAt)
          const dateStr = format(start, 'EEE d MMM')
          const timeStr = format(start, 'h:mm a')
          return (
            <Link
              key={ev.id}
              href={`/events/${ev.id}`}
              className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 hover:shadow-md hover:border-gray-200 transition-all"
            >
              <div
                className="w-11 h-11 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: TEAL }}
              >
                <span className="text-[9px] font-bold uppercase leading-none">
                  {format(start, 'MMM')}
                </span>
                <span className="text-base font-black leading-none">
                  {start.getDate()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {dateStr} &middot; {timeStr}
                  {ev.location && <> &middot; {ev.location}</>}
                </p>
              </div>
              <ChevronRight />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ isLoggedIn, onCategorySelect }: { isLoggedIn?: boolean; onCategorySelect: (cat: string) => void }) {
  return (
    <div className="text-center py-20 px-6">
      <div className="text-5xl mb-4 select-none">🔍</div>
      <p className="font-semibold text-gray-700 text-base mb-2">No groups found</p>
      <p className="text-gray-400 text-sm mb-6">Try a different search or browse by category:</p>
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {CATEGORIES.filter((c) => c.label !== 'All').slice(0, 6).map((cat) => (
          <button
            key={cat.label}
            onClick={() => onCategorySelect(cat.label)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>
      <Link
        href={isLoggedIn ? '/groups/new' : '/auth?next=/groups/new'}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
        style={{ backgroundColor: TEAL }}
      >
        Be the first — create a group <ChevronRight />
      </Link>
    </div>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      num: '1',
      icon: '👥',
      title: 'Create or join a group',
      desc: 'Start your community in minutes or find one that matches your interests.',
    },
    {
      num: '2',
      icon: '🎉',
      title: 'RSVP to events in seconds',
      desc: 'See what\'s happening, RSVP with one tap, and get your check-in QR code.',
    },
    {
      num: '3',
      icon: '✨',
      title: 'Your community, beautifully organised',
      desc: 'Track attendance, celebrate streaks, and watch your crew grow together.',
    },
  ]

  return (
    <section className="bg-white border-t border-gray-100">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
          How it works
        </h2>
        <p className="text-gray-400 text-center text-sm mb-14 max-w-md mx-auto">
          Everything your community needs, nothing it doesn&apos;t.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="text-5xl mb-5 select-none">{s.icon}</div>
              <div
                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black text-white mb-3"
                style={{ backgroundColor: TEAL }}
              >
                {s.num}
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-2">{s.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="border-t border-gray-100"
      style={{ backgroundColor: '#FAFAFA' }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Wordmark */}
          <div>
            <span className="text-lg font-black tracking-[0.12em]" style={{ color: TEAL }}>
              ROVA
            </span>
            <span className="text-lg font-black tracking-[0.12em]" style={{ color: GOLD }}>
              CREW
            </span>
            <p className="text-xs text-gray-400 mt-1">
              Built for real communities.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-gray-600 transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DiscoveryClient({ groups, trendingGroups, recommendedGroups, stats, isLoggedIn, jsonLd, upcomingEvents }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sortBy, setSortBy] = useState<'most_active' | 'newest' | 'most_members'>('most_active')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const result = groups.filter((g) => {
      if (category && g.category !== category) return false
      if (q && !g.name.toLowerCase().includes(q) && !g.tagline?.toLowerCase().includes(q) && !g.location?.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
    // Sort
    if (sortBy === 'most_members') {
      result.sort((a, b) => b.memberCount - a.memberCount)
    } else if (sortBy === 'newest') {
      result.sort((a, b) => b.memberCount - a.memberCount) // fallback — groups already sorted by created_at desc from server
    }
    return result
  }, [groups, search, category, sortBy])

  const hasActiveFilter = search.trim() !== '' || category !== ''

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* JSON-LD for SEO */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}

      {/* Nav overlay on hero */}
      <nav className="absolute top-0 left-0 right-0 z-20 px-5 sm:px-8 pt-5 flex items-center justify-between max-w-6xl mx-auto">
        <span className="select-none">
          <span className="text-base font-black tracking-[0.14em] text-white/90">ROVA</span>
          <span className="text-base font-black tracking-[0.14em]" style={{ color: GOLD }}>CREW</span>
        </span>
        <Link
          href={isLoggedIn ? '/home' : '/auth'}
          className="px-4 py-2 rounded-lg text-xs font-bold text-white/80 border border-white/20 hover:bg-white/10 hover:border-white/40 transition-all"
        >
          {isLoggedIn ? '\u2190 Dashboard' : 'Sign in'}
        </Link>
      </nav>

      {/* Hero */}
      <Hero stats={stats} isLoggedIn={isLoggedIn} />

      {/* Filter bar */}
      <div id="groups">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
        />
      </div>

      {/* Trending — only show when no active filter */}
      {!hasActiveFilter && trendingGroups && trendingGroups.length > 0 && <TrendingSection groups={trendingGroups} />}

      {/* Recommended — only show when no active filter and user is logged in */}
      {!hasActiveFilter && isLoggedIn && recommendedGroups && recommendedGroups.length > 0 && <RecommendedSection groups={recommendedGroups} />}

      {/* Upcoming events — only show when no active filter */}
      {!hasActiveFilter && upcomingEvents && upcomingEvents.length > 0 && <UpcomingEventsSection events={upcomingEvents} />}

      {/* Groups grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-4">
          {hasActiveFilter ? (
            <p className="text-xs text-gray-400">
              {filtered.length} group{filtered.length !== 1 ? 's' : ''} found
            </p>
          ) : (
            <span />
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1"
            style={{ '--tw-ring-color': TEAL } as React.CSSProperties}
          >
            <option value="most_active">Most active</option>
            <option value="newest">Newest</option>
            <option value="most_members">Most members</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState isLoggedIn={isLoggedIn} onCategorySelect={(cat) => { setCategory(cat); setSearch('') }} />
        ) : (
          <>
            {!hasActiveFilter && ((trendingGroups?.length ?? 0) > 0 || (recommendedGroups?.length ?? 0) > 0) && (
              <h2 className="text-base font-bold text-gray-900 mb-4">All communities</h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {filtered.map((g) => (
                <GroupCardComponent key={g.id} group={g} />
              ))}
            </div>
          </>
        )}
      </main>

      {/* How it works */}
      <HowItWorks />

      {/* Footer */}
      <Footer />
    </div>
  )
}
