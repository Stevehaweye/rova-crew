'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  name: string
  email: string
  avatarUrl: string | null
  groupsJoined: number
  eventsAttended: number
  memberSince: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(fullName: string) {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProfileClient({
  name,
  email,
  avatarUrl,
  groupsJoined,
  eventsAttended,
  memberSince,
}: Props) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <p className="text-sm font-bold tracking-[0.14em] select-none">
            <span style={{ color: '#0D7377' }}>ROVA</span>
            <span style={{ color: '#C9982A' }}>CREW</span>
          </p>
          <p className="text-sm font-semibold text-gray-400">Profile</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Avatar + name */}
        <div className="flex flex-col items-center mb-8">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-md mb-4"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-md ring-4 ring-white mb-4"
              style={{ backgroundColor: '#0D7377' }}
            >
              {initials(name)}
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{email}</p>
          <p className="text-xs text-gray-400 mt-1">
            Member since {format(new Date(memberSince), 'MMMM yyyy')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{groupsJoined}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">
              {groupsJoined === 1 ? 'Group' : 'Groups'} joined
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{eventsAttended}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">
              {eventsAttended === 1 ? 'Event' : 'Events'} RSVP&apos;d
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <Link
            href="/settings/notifications"
            className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
              />
            </svg>
            Notification settings
          </Link>
          <div className="border-t border-gray-100" />
          <Link
            href="/settings/gamification"
            className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-4.5A3.375 3.375 0 0 0 13.125 10.875h-2.25A3.375 3.375 0 0 0 7.5 14.25v4.5m9-13.5a2.25 2.25 0 1 0-4.5 0 2.25 2.25 0 0 0 4.5 0ZM12 7.5a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z"
              />
            </svg>
            Gamification settings
          </Link>
          <div className="border-t border-gray-100" />
          <Link
            href="/settings/photo-consent"
            className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
              />
            </svg>
            Photo privacy
          </Link>
          <div className="border-t border-gray-100" />
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
              />
            </svg>
            Sign out
          </button>
        </div>
      </main>
    </div>
  )
}
