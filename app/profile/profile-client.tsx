'use client'

import { useRouter } from 'next/navigation'
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
