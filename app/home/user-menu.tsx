'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function UserMenu({
  name,
  avatarUrl,
  initials,
  groupSlug,
  isAdmin,
  companySlug,
  companyName,
}: {
  name: string
  avatarUrl: string | null
  initials: string
  groupSlug?: string | null
  isAdmin?: boolean
  companySlug?: string | null
  companyName?: string | null
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 focus:outline-none"
      >
        <span className="text-sm font-medium text-gray-600 hidden sm:block">{name}</span>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: '#0D7377' }}
          >
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-100 shadow-lg py-1 z-50">
          {isAdmin && (
            <Link
              href="/platform-admin"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
              style={{ color: '#0D7377' }}
            >
              Platform Admin
            </Link>
          )}
          {companySlug && companyName && (
            <Link
              href={`/company/${companySlug}`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {companyName}
            </Link>
          )}
          {groupSlug && (
            <Link
              href={`/g/${groupSlug}/my-stats`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              My Progress
            </Link>
          )}
          <Link
            href="/settings/account"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Account settings
          </Link>
          <Link
            href="/settings/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Notification settings
          </Link>
          <Link
            href="/settings/payments"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Payment settings
          </Link>
          <div className="border-t border-gray-100 my-0.5" />
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
