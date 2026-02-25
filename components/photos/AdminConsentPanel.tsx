'use client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemberConsent {
  userId: string
  fullName: string
  avatarUrl: string | null
  consentLevel: 'always' | 'ask' | 'never' | null
}

interface AdminConsentPanelProps {
  groupId: string
  members: MemberConsent[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const DOT_COLOURS: Record<string, string> = {
  always: '#22C55E',
  ask: '#F59E0B',
  never: '#EF4444',
}

const LEVEL_LABELS: Record<string, string> = {
  always: 'Always',
  ask: 'Ask first',
  never: 'Never',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminConsentPanel({ members }: AdminConsentPanelProps) {
  const optedOut = members.filter((m) => m.consentLevel === 'never')
  const askFirst = members.filter((m) => m.consentLevel === 'ask')
  const hasRestrictions = optedOut.length > 0 || askFirst.length > 0

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
        <svg className="w-4.5 h-4.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-900">Member Consent</h3>
        {hasRestrictions && (
          <span className="ml-auto text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            {optedOut.length + askFirst.length} restricted
          </span>
        )}
      </div>

      {/* Warning banners for opted-out members */}
      {optedOut.length > 0 && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">&#9888;&#65039;</span>
            <div>
              {optedOut.map((m) => (
                <p key={m.userId} className="text-xs font-medium text-red-700">
                  {m.fullName} has opted out of group photos. Please ensure no photos of them are uploaded.
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ask-first banner */}
      {askFirst.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">&#x1F7E1;</span>
            <p className="text-xs font-medium text-amber-700">
              {askFirst.map((m) => m.fullName).join(', ')}{' '}
              {askFirst.length === 1 ? 'has' : 'have'} requested to be asked before external sharing.
            </p>
          </div>
        </div>
      )}

      {/* Member list */}
      {!hasRestrictions ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-400">No members have changed their defaults.</p>
          <p className="text-xs text-gray-400 mt-1">All members are happy to be included in photos.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {members
            .filter((m) => m.consentLevel === 'never' || m.consentLevel === 'ask')
            .map((member) => {
              const level = member.consentLevel ?? 'always'
              const dotColour = DOT_COLOURS[level] ?? DOT_COLOURS.always
              const label = LEVEL_LABELS[level] ?? 'Always'

              return (
                <div key={member.userId} className="flex items-center gap-3 px-4 py-2.5">
                  {/* Avatar */}
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatarUrl}
                      alt={member.fullName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                      {initials(member.fullName)}
                    </div>
                  )}

                  {/* Name */}
                  <p className="flex-1 text-sm font-medium text-gray-900 truncate">
                    {member.fullName}
                  </p>

                  {/* Status dot + label */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: dotColour }}
                    />
                    <span className="text-xs font-medium text-gray-500">{label}</span>
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
