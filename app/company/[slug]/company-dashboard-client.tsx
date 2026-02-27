'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Company {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  primaryColour: string
}

interface CompanyGroup {
  id: string
  name: string
  slug: string
  tagline: string | null
  category: string
  logoUrl: string | null
  primaryColour: string
  memberCount: number
  nextEventDate: string | null
  scopeType: string
  isMember: boolean
}

interface Colleague {
  id: string
  fullName: string
  avatarUrl: string | null
  workLocation: string | null
  department: string | null
}

interface Props {
  company: Company
  groups: CompanyGroup[]
  colleagues: Colleague[]
  totalMembers: number
  clubCount: number
  inviteLink: string
  primaryDomain: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function scopeLabel(scopeType: string): string {
  switch (scopeType) {
    case 'company':
      return 'Company-wide'
    case 'location':
      return 'Location'
    case 'department':
      return 'Department'
    case 'loc_dept':
      return 'Location + Dept'
    case 'public':
      return 'Public'
    default:
      return scopeType
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
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

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompanyDashboardClient({
  company,
  groups,
  colleagues,
  totalMembers,
  clubCount,
  inviteLink,
  primaryDomain,
}: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 3000)
    return () => clearTimeout(t)
  }, [copied])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = inviteLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeftIcon />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base font-black tracking-[0.12em]" style={{ color: '#0D7377' }}>
              ROVA
            </span>
            <span className="text-base font-black tracking-[0.12em]" style={{ color: '#C9982A' }}>
              CREW
            </span>
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-sm font-semibold text-gray-700 truncate">{company.name}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Header Card ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-4 mb-4">
            {/* Company logo or initial */}
            <div
              className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: company.primaryColour }}
            >
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-2xl">
                  {company.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {totalMembers} member{totalMembers !== 1 ? 's' : ''} on ROVA Crew
                <span className="mx-1.5 text-gray-300">&middot;</span>
                {clubCount} club{clubCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: '#0D737715', color: '#0D7377' }}
          >
            <ShieldCheckIcon />
            You&apos;re a verified {company.name} employee
          </div>
        </div>

        {/* ── Clubs at Company ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Clubs at {company.name}
            </h2>
          </div>

          {groups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 text-gray-400">
                <UsersIcon />
              </div>
              <p className="font-semibold text-gray-700 text-sm">No clubs yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Be the first to{' '}
                <Link href="/groups/new" className="font-semibold hover:underline" style={{ color: '#0D7377' }}>
                  start a club
                </Link>{' '}
                at {company.name}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Colour bar */}
                  <div className="h-1.5" style={{ backgroundColor: group.primaryColour }} />

                  <div className="p-5">
                    {/* Group header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                        style={{ backgroundColor: group.primaryColour }}
                      >
                        {group.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={group.logoUrl}
                            alt={group.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initials(group.name)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {group.name}
                        </p>
                        {group.tagline && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{group.tagline}</p>
                        )}
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span
                        className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${group.primaryColour}15`,
                          color: group.primaryColour,
                        }}
                      >
                        {scopeLabel(group.scopeType)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <UsersIcon />
                        {group.memberCount}
                      </span>
                      {group.nextEventDate && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <CalendarIcon />
                          {format(new Date(group.nextEventDate), 'MMM d')}
                        </span>
                      )}
                    </div>

                    {/* Action button */}
                    {group.isMember ? (
                      <Link
                        href={`/g/${group.slug}`}
                        className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
                      >
                        View
                        <ChevronRightIcon />
                      </Link>
                    ) : (
                      <Link
                        href={`/g/${group.slug}`}
                        className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                        style={{ backgroundColor: '#0D7377' }}
                      >
                        Join
                        <ChevronRightIcon />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Colleagues on ROVA ──────────────────────────────────────────── */}
        {colleagues.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Colleagues on ROVA</h2>
              <span className="text-xs text-gray-400">Recently joined</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {colleagues.map((colleague) => (
                <div
                  key={colleague.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center text-center"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden mb-2 bg-gray-100">
                    {colleague.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={colleague.avatarUrl}
                        alt={colleague.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-gray-400">
                        {initials(colleague.fullName)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate w-full">
                    {colleague.fullName.split(' ')[0]}
                  </p>
                  {(colleague.workLocation || colleague.department) && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate w-full">
                      {colleague.department ?? colleague.workLocation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Invite Your Team ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#0D737712', color: '#0D7377' }}
            >
              <LinkIcon />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900 mb-1">
                Invite Your Team
              </h2>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Know a colleague who isn&apos;t on ROVA Crew yet? Share this link.
              </p>

              {/* Copyable link */}
              <div className="flex items-stretch gap-2 mb-3">
                <div className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-600 truncate font-mono">
                  {inviteLink}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: copied ? '#059669' : '#0D7377' }}
                >
                  {copied ? (
                    <>
                      <CheckIcon />
                      Copied
                    </>
                  ) : (
                    <>
                      <ClipboardIcon />
                      Copy link
                    </>
                  )}
                </button>
              </div>

              {primaryDomain && (
                <p className="text-xs text-gray-400 leading-relaxed">
                  When they sign up with their{' '}
                  <span className="font-semibold text-gray-500">@{primaryDomain}</span> email,
                  they&apos;ll be automatically connected to {company.name}.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
