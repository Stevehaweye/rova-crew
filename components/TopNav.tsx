'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import UserMenu from './UserMenu'

export interface TopNavUser {
  name: string
  avatarUrl: string | null
  initials: string
  groupSlug?: string | null
  isAdmin?: boolean
  companySlug?: string | null
  companyName?: string | null
}

export default function TopNav({
  user,
  title,
  showBackButton = false,
  backHref,
  showWordmark = true,
  maxWidth = 'max-w-5xl',
}: {
  user: TopNavUser | null
  title?: string
  showBackButton?: boolean
  backHref?: string
  showWordmark?: boolean
  maxWidth?: string
}) {
  const router = useRouter()

  return (
    <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className={`${maxWidth} mx-auto px-4 sm:px-6 h-14 flex items-center justify-between`}>
        {/* Left side */}
        <div className="flex items-center gap-3 min-w-0">
          {showBackButton && (
            backHref ? (
              <Link
                href={backHref}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </Link>
            ) : (
              <button
                onClick={() => router.back()}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
            )
          )}
          {showWordmark && (
            <Link href="/home" className="select-none flex-shrink-0">
              <span className="text-base font-black tracking-[0.14em]" style={{ color: '#0D7377' }}>
                ROVA
              </span>
              <span className="text-base font-black tracking-[0.14em]" style={{ color: '#C9982A' }}>
                CREW
              </span>
            </Link>
          )}
          {title && (
            <>
              {showWordmark && <span className="text-gray-300 text-lg">&middot;</span>}
              <span className="text-sm font-semibold text-gray-600 truncate">{title}</span>
            </>
          )}
        </div>

        {/* Right side — user menu */}
        {user && (
          <UserMenu
            name={user.name}
            avatarUrl={user.avatarUrl}
            initials={user.initials}
            groupSlug={user.groupSlug}
            isAdmin={user.isAdmin}
            companySlug={user.companySlug}
            companyName={user.companyName}
          />
        )}
      </div>
    </nav>
  )
}
