'use client'

import { useState, useCallback, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroupScopeInput {
  scopeType: 'public' | 'company' | 'location' | 'department' | 'loc_dept' | 'invitation'
  companyId?: string
  scopeLocation?: string
  scopeDepartment?: string
}

interface ScopePickerProps {
  userCompany: { id: string; name: string; member_count: number } | null
  userLocation: string | null
  userDepartment: string | null
  onChange: (scope: GroupScopeInput) => void
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GlobeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  )
}

function MapPinUsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
}

// ─── Scope option definition ──────────────────────────────────────────────────

interface ScopeOption {
  type: GroupScopeInput['scopeType']
  label: string
  description: string
  icon: React.ReactNode
  recommended?: boolean
  subtitle?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScopePicker({
  userCompany,
  userLocation,
  userDepartment,
  onChange,
}: ScopePickerProps) {
  const defaultScope: GroupScopeInput['scopeType'] = userCompany ? 'company' : 'public'

  const [selected, setSelected] = useState<GroupScopeInput['scopeType']>(defaultScope)
  const [locationOverride, setLocationOverride] = useState(userLocation ?? '')
  const [departmentOverride, setDepartmentOverride] = useState(userDepartment ?? '')

  // Build the current scope output
  const buildScope = useCallback(
    (type: GroupScopeInput['scopeType'], loc: string, dept: string): GroupScopeInput => {
      const base: GroupScopeInput = { scopeType: type }

      if (userCompany && type !== 'public' && type !== 'invitation') {
        base.companyId = userCompany.id
      }

      if (type === 'location' || type === 'loc_dept') {
        base.scopeLocation = loc.trim() || undefined
      }
      if (type === 'department' || type === 'loc_dept') {
        base.scopeDepartment = dept.trim() || undefined
      }

      return base
    },
    [userCompany]
  )

  // Fire onChange on mount and whenever inputs change
  useEffect(() => {
    onChange(buildScope(selected, locationOverride, departmentOverride))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, locationOverride, departmentOverride])

  function handleSelect(type: GroupScopeInput['scopeType']) {
    setSelected(type)
  }

  // ── Build options list ──────────────────────────────────────────────────

  const options: ScopeOption[] = []

  // Card 1: Public
  options.push({
    type: 'public',
    label: 'Anyone on ROVA',
    description: 'Open to all ROVA users worldwide.',
    icon: <GlobeIcon />,
  })

  // Card 2: Company-wide
  if (userCompany) {
    options.push({
      type: 'company',
      label: `${userCompany.name} \u2014 whole company`,
      description: `Est. ${userCompany.member_count.toLocaleString()} employees`,
      icon: <BuildingIcon />,
      recommended: true,
    })
  }

  // Card 3: Company + Location
  if (userCompany && userLocation) {
    options.push({
      type: 'location',
      label: `${userCompany.name} \u00B7 ${userLocation}`,
      description: 'Employees at this office or city.',
      icon: <MapPinIcon />,
    })
  }

  // Card 4: Company + Department
  if (userCompany && userDepartment) {
    options.push({
      type: 'department',
      label: `${userCompany.name} \u00B7 ${userDepartment} dept`,
      description: 'Department members at any location.',
      icon: <UsersIcon />,
    })
  }

  // Card 5: Company + Location + Department
  if (userCompany && userLocation && userDepartment) {
    options.push({
      type: 'loc_dept',
      label: `${userCompany.name} \u00B7 ${userLocation} \u00B7 ${userDepartment}`,
      description: 'Department members at this location.',
      icon: <MapPinUsersIcon />,
    })
  }

  // Card 6: Invitation only
  options.push({
    type: 'invitation',
    label: 'Invitation only',
    description: 'Private group, invite-only access.',
    icon: <LockIcon />,
  })

  // ── Audience preview text ───────────────────────────────────────────────

  function getPreviewText(): string {
    const company = userCompany?.name ?? 'your company'
    const loc = locationOverride.trim() || userLocation || 'your location'
    const dept = departmentOverride.trim() || userDepartment || 'your department'

    switch (selected) {
      case 'public':
        return 'Anyone on ROVA can discover and join this group.'
      case 'company':
        return `Visible to all verified ${company} employees worldwide.`
      case 'location':
        return `Visible to ${company} employees at ${loc}.`
      case 'department':
        return `Visible to ${company} ${dept} employees at any location.`
      case 'loc_dept':
        return `Visible to ${company} ${dept} employees at ${loc}.`
      case 'invitation':
        return 'Only people you personally invite will be able to join.'
    }
  }

  // ── Whether to show secondary inputs ────────────────────────────────────

  const showLocationInput = selected === 'location' || selected === 'loc_dept'
  const showDepartmentInput = selected === 'department' || selected === 'loc_dept'

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Scope cards */}
      <div className="space-y-2.5">
        {options.map((opt) => {
          const isSelected = selected === opt.type
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => handleSelect(opt.type)}
              className="w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0D7377]"
              style={{
                borderColor: isSelected ? '#0D7377' : '#E5E7EB',
                backgroundColor: isSelected ? '#0D73770A' : '#FFFFFF',
              }}
            >
              <div className="flex items-center gap-3.5">
                {/* Radio circle */}
                <div
                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150"
                  style={{
                    borderColor: isSelected ? '#0D7377' : '#D1D5DB',
                  }}
                >
                  {isSelected && (
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#0D7377' }}
                    />
                  )}
                </div>

                {/* Icon */}
                <span
                  className="flex-shrink-0 transition-colors duration-150"
                  style={{ color: isSelected ? '#0D7377' : '#9CA3AF' }}
                >
                  {opt.icon}
                </span>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-semibold truncate"
                      style={{ color: isSelected ? '#0D7377' : '#111827' }}
                    >
                      {opt.label}
                    </span>
                    {opt.recommended && (
                      <span
                        className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: '#C9982A20', color: '#C9982A' }}
                      >
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{opt.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Secondary inputs for location / department override */}
      {(showLocationInput || showDepartmentInput) && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Confirm scope details
          </p>

          {showLocationInput && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={locationOverride}
                onChange={(e) => setLocationOverride(e.target.value)}
                placeholder="e.g. London, Manchester"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
              />
            </div>
          )}

          {showDepartmentInput && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={departmentOverride}
                onChange={(e) => setDepartmentOverride(e.target.value)}
                placeholder="e.g. Engineering, Marketing"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
              />
            </div>
          )}
        </div>
      )}

      {/* Audience preview */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[#0D73770A] border border-[#0D737720]">
        <svg
          className="w-4 h-4 flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="#0D7377"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        <p className="text-sm text-[#0D7377] leading-snug font-medium">
          {getPreviewText()}
        </p>
      </div>
    </div>
  )
}
