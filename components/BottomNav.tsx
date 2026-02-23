'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ─── Route visibility ────────────────────────────────────────────────────────

const NAV_ROUTES = ['/home', '/discover', '/wallet', '/profile']

function shouldShow(pathname: string): boolean {
  return NAV_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
}

function isActive(href: string, pathname: string): boolean {
  if (href === '/home') return pathname === '/home'
  return pathname === href || pathname.startsWith(href + '/')
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TEAL = '#0D7377'
const GRAY = '#6B7280'

interface Tab {
  href: string
  label: string
  icon: (active: boolean) => React.ReactNode
}

const TABS: Tab[] = [
  {
    href: '/home',
    label: 'Home',
    icon: (active) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2 : 1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    ),
  },
  {
    href: '/discover',
    label: 'Discover',
    icon: (active) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2 : 1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
    ),
  },
  {
    href: '/wallet',
    label: 'Card',
    icon: (active) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2 : 1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm-3.375 3.75a2.625 2.625 0 0 1 5.25 0v.375c0 .621-.504 1.125-1.125 1.125H8.25c-.621 0-1.125-.504-1.125-1.125v-.375Z"
        />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2 : 1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        />
      </svg>
    ),
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function BottomNav() {
  const pathname = usePathname()

  if (!shouldShow(pathname)) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch max-w-lg mx-auto">
        {TABS.map((tab) => {
          const active = isActive(tab.href, pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
              style={{ color: active ? TEAL : GRAY }}
            >
              {tab.icon(active)}
              <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
