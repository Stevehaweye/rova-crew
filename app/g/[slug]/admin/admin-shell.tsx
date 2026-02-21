'use client'

import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { InviteModal } from './invite-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Group {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_colour: string
  category: string
  tagline: string | null
}

interface Profile {
  full_name: string
  avatar_url: string | null
}

interface RecentMember {
  userId: string
  fullName: string
  avatarUrl: string | null
  joinedAt: string
}

interface UpcomingEvent {
  id: string
  title: string
  startsAt: string
  endsAt: string
  location: string | null
  maxCapacity: number | null
  rsvpCount: number
}

export interface AdminData {
  group: Group
  profile: Profile
  memberCount: number
  membersThisWeek: number
  recentMembers: RecentMember[]
  appUrl: string
  upcomingEvents: UpcomingEvent[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hex(c: string) {
  return c.startsWith('#') ? c : `#${c}`
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function firstInitial(name: string) {
  return (name[0] ?? '?').toUpperCase()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function healthScore(memberCount: number): number {
  // Week 1 formula — full formula unlocks in Week 5
  return memberCount > 0 ? 50 : 0
}

function healthColor(score: number): string {
  if (score >= 70) return '#16A34A'
  if (score >= 40) return '#D97706'
  return '#DC2626'
}

function healthLabel(score: number): string {
  if (score >= 70) return 'Great shape'
  if (score >= 40) return 'Building up'
  return 'Just starting'
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UsersIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function CalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}

function PoundIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
    </svg>
  )
}

function HeartIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function XIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  )
}

function ArrowTopRightIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  )
}

function CogIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
  )
}

// ─── Health Score Ring ────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const color = healthColor(score)
  const label = healthLabel(score)
  // r = 15.9155 → circumference ≈ 100 (convenient unit scale)
  const r = 15.9155
  const circumference = 100
  const dashArray = `${(score / 100) * circumference} ${circumference - (score / 100) * circumference}`

  return (
    <div className="flex items-center gap-3 mt-1">
      <div className="relative w-14 h-14 flex-shrink-0">
        {/* -rotate-90 starts the arc at 12 o'clock */}
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="#F3F4F6" strokeWidth="3" />
          <circle
            cx="18" cy="18" r={r}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={dashArray}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black" style={{ color }}>{score}</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900 leading-none">
          {score}
          <span className="text-sm font-normal text-gray-400">/100</span>
        </p>
        <p className="text-xs font-semibold mt-1" style={{ color }}>{label}</p>
      </div>
    </div>
  )
}

// ─── Welcome Banner ───────────────────────────────────────────────────────────

function WelcomeBanner({
  groupUrl,
  groupId,
  onInviteClick,
}: {
  groupUrl: string
  groupId: string
  onInviteClick: () => void
}) {
  // Start hidden to prevent flash; show after localStorage check on mount
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const key = `rova_welcome_dismissed_${groupId}`
    if (!localStorage.getItem(key)) setVisible(true)
  }, [groupId])

  function handleDismiss() {
    localStorage.setItem(`rova_welcome_dismissed_${groupId}`, '1')
    setVisible(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(groupUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!visible) return null

  return (
    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ backgroundColor: '#0D7377' }}>
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -bottom-6 right-16 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
        aria-label="Dismiss"
      >
        <XIcon />
      </button>

      <div className="relative">
        <h2 className="text-xl font-black text-white mb-1">🎉 Your group is live!</h2>
        <p className="text-white/70 text-sm mb-4">
          Share your group link to invite your first members:
        </p>

        {/* Copy row */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 min-w-0 bg-white/15 border border-white/20 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <span className="text-white/60 flex-shrink-0"><LinkIcon /></span>
            <span className="text-xs text-white/90 truncate font-mono">{groupUrl}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
            style={
              copied
                ? { backgroundColor: 'rgba(209,250,229,0.9)', color: '#065F46' }
                : { backgroundColor: 'white', color: '#0D7377' }
            }
          >
            {copied ? <><CheckIcon /> Copied!</> : 'Copy link'}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* QR / invite modal shortcut */}
          <button
            onClick={onInviteClick}
            className="text-sm font-semibold text-white/80 hover:text-white transition-colors text-left"
          >
            Show QR code &amp; more options &rarr;
          </button>

          {/* WhatsApp — placeholder */}
          <button
            disabled
            className="flex items-center gap-1.5 text-white/40 text-sm font-semibold cursor-not-allowed"
          >
            📱 Send WhatsApp migration message →
            <span className="text-[10px] bg-white/15 text-white/50 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Week 6
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar content (shared by desktop + mobile overlay) ─────────────────────

const NAV_ITEMS = [
  { icon: '📊', label: 'Dashboard',      key: 'dashboard',     available: true  },
  { icon: '📅', label: 'Events',         key: 'events',        available: true  },
  { icon: '👥', label: 'Members',        key: 'members',       available: false },
  { icon: '📣', label: 'Announcements',  key: 'announcements', available: false },
  { icon: '🏆', label: 'Hall of Fame',   key: 'hof',           available: false },
  { icon: '⚙️', label: 'Settings',       key: 'settings',      available: false },
]

function SidebarContent({
  group,
  colour,
  activeKey = 'dashboard',
}: {
  group: Group
  colour: string
  activeKey?: string
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Group identity header */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-sm overflow-hidden"
            style={{ backgroundColor: colour }}
          >
            {group.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.logo_url} alt={group.name} className="w-full h-full object-cover" />
            ) : (
              <span>{firstInitial(group.name)}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{group.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Admin panel</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeKey

          if (item.available) {
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={
                  isActive
                    ? { backgroundColor: colour + '18', color: colour }
                    : { color: '#6B7280' }
                }
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: colour }}
                  />
                )}
              </div>
            )
          }

          return (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm opacity-40 cursor-not-allowed"
            >
              <div className="flex items-center gap-3 text-gray-500 font-medium">
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                Soon
              </span>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-[10px] text-center text-gray-300 font-medium">
          Powered by{' '}
          <span className="font-black" style={{ color: '#0D7377' }}>ROVA</span>
          <span className="font-black" style={{ color: '#C9982A' }}>CREW</span>
        </p>
      </div>
    </div>
  )
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────

function TopNav({
  group,
  profile,
  colour,
  onMenuClick,
}: {
  group: Group
  profile: Profile
  colour: string
  onMenuClick: () => void
}) {
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const abbr = initials(profile.full_name)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [dropdownOpen])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 h-14 flex items-center px-4 sm:px-5 gap-3 flex-shrink-0">

      {/* Hamburger (mobile only) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
        aria-label="Open menu"
      >
        <MenuIcon />
      </button>

      {/* Wordmark */}
      <Link href="/home" className="select-none flex-shrink-0">
        <span className="text-base font-black tracking-[0.14em]" style={{ color: '#0D7377' }}>ROVA</span>
        <span className="text-base font-black tracking-[0.14em]" style={{ color: '#C9982A' }}>CREW</span>
      </Link>

      {/* Breadcrumb */}
      <nav className="hidden sm:flex items-center gap-1.5 text-sm min-w-0 flex-1">
        <Link href="/home" className="text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">
          Home
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href={`/g/${group.slug}`}
          className="text-gray-400 hover:text-gray-600 transition-colors truncate max-w-[160px]"
        >
          {group.name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-semibold whitespace-nowrap">Admin</span>
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2 sm:gap-3 flex-shrink-0">

        {/* View public page link */}
        <a
          href={`/g/${group.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors whitespace-nowrap"
        >
          View public page
          <ArrowTopRightIcon />
        </a>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-gray-200 flex-shrink-0" />

        {/* Avatar dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-gray-100 transition-colors"
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ backgroundColor: colour }}
              >
                {abbr}
              </div>
            )}
            <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
              {profile.full_name.split(' ')[0]}
            </span>
            <span className="text-gray-400">
              <ChevronDownIcon />
            </span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50">
              <div className="px-4 py-2.5 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-900 truncate">{profile.full_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Group admin</p>
              </div>
              <Link
                href={`/g/${group.slug}/admin/settings`}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                <CogIcon />
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <SignOutIcon />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  accentColor,
  children,
}: {
  icon: ReactNode
  label: string
  accentColor: string
  children: ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: accentColor + '15', color: accentColor }}
        >
          {icon}
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

function QuickActionCard({
  emoji,
  label,
  description,
  href,
  onClick,
  disabled,
  comingSoon,
}: {
  emoji: string
  label: string
  description: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  comingSoon?: string
}) {
  const inner = (
    <div
      className={[
        'bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-2 h-full transition-all duration-200',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-md hover:border-gray-200 active:scale-[0.98]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none">{emoji}</span>
        {comingSoon && (
          <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {comingSoon}
          </span>
        )}
      </div>
      <p className="font-bold text-gray-900 text-sm">{label}</p>
      <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
    </div>
  )

  if (disabled) return <div className="h-full">{inner}</div>
  if (href) return <Link href={href} className="block h-full">{inner}</Link>
  return (
    <button type="button" onClick={onClick} className="block h-full w-full text-left">
      {inner}
    </button>
  )
}

// ─── Recent Member Row ────────────────────────────────────────────────────────

function RecentMemberRow({ member, colour }: { member: RecentMember; colour: string }) {
  const name = member.fullName || 'Member'

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatarUrl}
          alt={name}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
          style={{ backgroundColor: colour }}
        >
          {initials(name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-400 mt-0.5">Joined {formatDate(member.joinedAt)}</p>
      </div>
      <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-500 flex-shrink-0">
        🌱 Newcomer
      </span>
    </div>
  )
}

// ─── Admin Shell ──────────────────────────────────────────────────────────────

export default function AdminShell({
  group,
  profile,
  memberCount,
  membersThisWeek,
  recentMembers,
  appUrl,
  upcomingEvents,
}: AdminData) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  const colour = hex(group.primary_colour)
  const groupUrl = `${appUrl}/g/${group.slug}`
  const score = healthScore(memberCount)
  const scoreColor = healthColor(score)

  // Close mobile sidebar on desktop resize
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top Nav */}
      <TopNav
        group={group}
        profile={profile}
        colour={colour}
        onMenuClick={() => setSidebarOpen(true)}
      />

      <div className="flex flex-1 min-h-0">

        {/* ── Desktop Sidebar ──────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-white border-r border-gray-100 overflow-y-auto">
          <SidebarContent group={group} colour={colour} activeKey="dashboard" />
        </aside>

        {/* ── Mobile Sidebar Overlay ───────────────────────────────── */}
        <div
          className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ${
            sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
              sidebarOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setSidebarOpen(false)}
          />
          {/* Panel */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-64 bg-white shadow-2xl transition-transform duration-300 flex flex-col ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-end px-4 pt-4">
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                aria-label="Close menu"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent group={group} colour={colour} activeKey="dashboard" />
            </div>
          </div>
        </div>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

            {/* Page header */}
            <div>
              <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Here&apos;s how{' '}
                <span className="font-semibold text-gray-700">{group.name}</span>{' '}
                is doing.
              </p>
            </div>

            {/* ── Row 1: Stat Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Total Members */}
              <StatCard icon={<UsersIcon />} label="Total Members" accentColor="#0D7377">
                <p className="text-3xl font-black text-gray-900">{memberCount}</p>
                {membersThisWeek > 0 ? (
                  <p className="text-xs font-semibold text-green-600 mt-1.5 flex items-center gap-1">
                    ↑ +{membersThisWeek} this week
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1.5">No new joins this week</p>
                )}
              </StatCard>

              {/* Upcoming Events */}
              <StatCard icon={<CalendarIcon />} label="Upcoming Events" accentColor="#7C3AED">
                <p className="text-3xl font-black text-gray-900">{upcomingEvents.length}</p>
                <p className="text-xs text-gray-400 mt-1.5 truncate">
                  Next:{' '}
                  <span className="text-gray-600 font-medium">
                    {upcomingEvents.length > 0 ? upcomingEvents[0].title : 'None planned'}
                  </span>
                </p>
              </StatCard>

              {/* Monthly Revenue */}
              <StatCard icon={<PoundIcon />} label="Monthly Revenue" accentColor="#059669">
                <p className="text-3xl font-black text-gray-900">£0.00</p>
                <p className="mt-1.5">
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Unlocks Week 4
                  </span>
                </p>
              </StatCard>

              {/* Group Health */}
              <StatCard icon={<HeartIcon />} label="Group Health" accentColor={scoreColor}>
                <HealthRing score={score} />
              </StatCard>
            </div>

            {/* ── Row 2: Quick Actions ──────────────────────────────── */}
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <QuickActionCard
                  emoji="📅"
                  label="Create Event"
                  description={upcomingEvents.length > 0 ? `You have ${upcomingEvents.length} upcoming event${upcomingEvents.length !== 1 ? 's' : ''}` : 'Schedule your next meetup or session'}
                  href={`/g/${group.slug}/admin/events/new`}
                />
                <QuickActionCard
                  emoji="📣"
                  label="Send Announcement"
                  description="Broadcast a message to all members"
                  href={`/g/${group.slug}/admin/announce`}
                  disabled
                  comingSoon="Week 3"
                />
                <QuickActionCard
                  emoji="👋"
                  label="Invite Members"
                  description="Share your group link or QR code"
                  onClick={() => setShareModalOpen(true)}
                />
                <QuickActionCard
                  emoji="📱"
                  label="Get Your Flyer"
                  description="Download a branded promo flyer"
                  disabled
                  comingSoon="Week 6"
                />
              </div>
            </div>

            {/* ── Row 3: Upcoming Events ──────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">Upcoming Events</h2>
                <Link
                  href={`/g/${group.slug}/admin/events`}
                  className="text-xs font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: colour }}
                >
                  View all events &rarr;
                </Link>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-4xl mb-3 select-none">📅</p>
                  <p className="text-sm text-gray-400 mb-3">No upcoming events yet.</p>
                  <Link
                    href={`/g/${group.slug}/admin/events/new`}
                    className="text-sm font-semibold hover:opacity-70 transition-opacity"
                    style={{ color: colour }}
                  >
                    Create your first event &rarr;
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {upcomingEvents.map((ev) => {
                    const start = new Date(ev.startsAt)
                    const dateStr = start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                    const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        {/* Date block */}
                        <div
                          className="flex-shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center text-white"
                          style={{ backgroundColor: colour }}
                        >
                          <span className="text-[9px] font-bold uppercase leading-none">
                            {start.toLocaleDateString('en-GB', { month: 'short' })}
                          </span>
                          <span className="text-lg font-black leading-none">{start.getDate()}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {dateStr} &middot; {timeStr}
                            {ev.location && <> &middot; {ev.location}</>}
                          </p>
                        </div>

                        {/* RSVP count */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-gray-900">{ev.rsvpCount}</p>
                          <p className="text-[10px] text-gray-400">going</p>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          <Link
                            href={`/events/${ev.id}`}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Row 4: Recent Members ──────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-gray-900">Recent Members</h2>
                <Link
                  href={`/g/${group.slug}/members`}
                  className="text-xs font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: colour }}
                >
                  View all members &rarr;
                </Link>
              </div>

              {recentMembers.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-gray-400">No members yet.</p>
                  <button
                    onClick={() => setShareModalOpen(true)}
                    className="mt-3 text-sm font-semibold hover:opacity-70 transition-opacity"
                    style={{ color: colour }}
                  >
                    Invite your first members &rarr;
                  </button>
                </div>
              ) : (
                <div>
                  {recentMembers.map((m) => (
                    <RecentMemberRow key={m.userId} member={m} colour={colour} />
                  ))}
                </div>
              )}
            </div>

            {/* ── Row 4: Welcome Banner (first visit only) ──────────── */}
            <WelcomeBanner
              groupUrl={groupUrl}
              groupId={group.id}
              onInviteClick={() => setShareModalOpen(true)}
            />

          </div>
        </main>
      </div>

      {/* Invite Modal */}
      {shareModalOpen && (
        <InviteModal
          groupUrl={groupUrl}
          groupName={group.name}
          groupSlug={group.slug}
          groupColour={colour}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  )
}
