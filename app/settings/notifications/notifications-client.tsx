'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePushNotifications } from '@/hooks/usePushNotifications'

// ─── Types ───────────────────────────────────────────────────────────────────

type PreferenceKey =
  | 'event_reminders'
  | 'waitlist_updates'
  | 'new_events'
  | 'direct_messages'
  | 'mentions'
  | 'group_chat'
  | 'event_chat'
  | 'announcements'
  | 'rsvp_milestones'

interface Props {
  initialPreferences: Record<PreferenceKey, boolean>
}

interface ToggleItem {
  key: PreferenceKey
  label: string
  description: string
}

// ─── Preference groups ───────────────────────────────────────────────────────

const EVENT_PREFS: ToggleItem[] = [
  {
    key: 'event_reminders',
    label: 'Event reminders',
    description: '7 days, 48 hours, and 2 hours before',
  },
  {
    key: 'waitlist_updates',
    label: 'Waitlist updates',
    description: 'When a spot opens up for you',
  },
  {
    key: 'new_events',
    label: 'New events in my groups',
    description: 'When an event is created',
  },
]

const CHAT_PREFS: ToggleItem[] = [
  {
    key: 'direct_messages',
    label: 'Direct messages',
    description: 'Private messages from members',
  },
  {
    key: 'mentions',
    label: '@mentions in group chat',
    description: 'When someone mentions you',
  },
  {
    key: 'group_chat',
    label: 'Group chat messages',
    description: 'New messages in group chats',
  },
  {
    key: 'event_chat',
    label: 'Event chat messages',
    description: 'New messages in event chats',
  },
]

const COMMUNITY_PREFS: ToggleItem[] = [
  {
    key: 'announcements',
    label: 'Group announcements',
    description: 'Updates from group admins',
  },
  {
    key: 'rsvp_milestones',
    label: 'RSVP milestones',
    description: 'When events hit attendance goals',
  },
]

// ─── Toggle component ────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        disabled
          ? 'cursor-not-allowed opacity-50 bg-gray-200'
          : checked
            ? 'cursor-pointer'
            : 'cursor-pointer bg-gray-200'
      }`}
      style={checked && !disabled ? { backgroundColor: '#0D7377' } : undefined}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationsClient({ initialPreferences }: Props) {
  const [prefs, setPrefs] = useState(initialPreferences)
  const { permission, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications()

  async function handleToggle(key: PreferenceKey) {
    const newValue = !prefs[key]

    // Optimistic update
    setPrefs((prev) => ({ ...prev, [key]: newValue }))

    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: newValue }),
      })

      if (!res.ok) {
        // Revert on error
        setPrefs((prev) => ({ ...prev, [key]: !newValue }))
      }
    } catch {
      // Revert on error
      setPrefs((prev) => ({ ...prev, [key]: !newValue }))
    }
  }

  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window
  const permissionDenied = permission === 'denied'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <p className="text-sm font-bold tracking-[0.14em] select-none">
            <span style={{ color: '#0D7377' }}>ROVA</span>
            <span style={{ color: '#C9982A' }}>CREW</span>
          </p>
          <p className="text-sm font-semibold text-gray-400">Notifications</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to profile
        </Link>

        <h1 className="text-xl font-bold text-gray-900 mb-6">Notification settings</h1>

        {/* ── Section 1: Push Notifications ──────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Push notifications</h2>

          {!notificationsSupported ? (
            <p className="text-sm text-gray-500">
              Push notifications are not supported on this browser.
            </p>
          ) : permissionDenied ? (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 0 0 5.714 0m-5.714 0a1.96 1.96 0 0 1-.346-.033 24.323 24.323 0 0 1-4.58-1.266 1.125 1.125 0 0 1-.253-1.898c.114-.1.236-.19.364-.269a21.053 21.053 0 0 0 4.469-3.86l.354-.407a2.25 2.25 0 1 1 3.182 3.182l-.407.354a21.053 21.053 0 0 0-3.86 4.469 2.06 2.06 0 0 1-.269.364 1.125 1.125 0 0 1-1.898-.253 24.323 24.323 0 0 1-1.266-4.58A1.96 1.96 0 0 1 9.143 17.082Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Notifications blocked</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  You&apos;ve blocked notifications for this site. To re-enable, update your browser settings.
                </p>
              </div>
            </div>
          ) : isSubscribed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#0D73770F' }}>
                  <svg className="w-4 h-4" style={{ color: '#0D7377' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Active on this device</p>
                  <p className="text-xs text-gray-500 mt-0.5">You&apos;ll receive push notifications</p>
                </div>
              </div>
              <button
                onClick={unsubscribe}
                disabled={loading}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loading ? 'Turning off...' : 'Turn off'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 0 0 5.714 0m-5.714 0a1.96 1.96 0 0 1-.346-.033 24.323 24.323 0 0 1-4.58-1.266 1.125 1.125 0 0 1-.253-1.898c.114-.1.236-.19.364-.269a21.053 21.053 0 0 0 4.469-3.86l.354-.407a2.25 2.25 0 1 1 3.182 3.182l-.407.354a21.053 21.053 0 0 0-3.86 4.469 2.06 2.06 0 0 1-.269.364 1.125 1.125 0 0 1-1.898-.253 24.323 24.323 0 0 1-1.266-4.58A1.96 1.96 0 0 1 9.143 17.082Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Notifications are off</p>
                  <p className="text-xs text-gray-500 mt-0.5">Turn on to get alerts on this device</p>
                </div>
              </div>
              <button
                onClick={subscribe}
                disabled={loading}
                className="text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#0D7377' }}
              >
                {loading ? 'Turning on...' : 'Turn on'}
              </button>
            </div>
          )}
        </div>

        {/* ── Section 2: What to notify me about ─────────────────────── */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          What to notify me about
        </h2>

        {/* Events */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Events</p>
          </div>
          {EVENT_PREFS.map((item, i) => (
            <div
              key={item.key}
              className={`flex items-center justify-between px-4 py-3 ${
                i < EVENT_PREFS.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <div className="pr-4">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              </div>
              <Toggle checked={prefs[item.key]} onChange={() => handleToggle(item.key)} />
            </div>
          ))}
        </div>

        {/* Chat */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Chat</p>
          </div>
          {CHAT_PREFS.map((item, i) => (
            <div
              key={item.key}
              className={`flex items-center justify-between px-4 py-3 ${
                i < CHAT_PREFS.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <div className="pr-4">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              </div>
              <Toggle checked={prefs[item.key]} onChange={() => handleToggle(item.key)} />
            </div>
          ))}
        </div>

        {/* Community */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Community</p>
          </div>
          {COMMUNITY_PREFS.map((item, i) => (
            <div
              key={item.key}
              className={`flex items-center justify-between px-4 py-3 ${
                i < COMMUNITY_PREFS.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <div className="pr-4">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              </div>
              <Toggle checked={prefs[item.key]} onChange={() => handleToggle(item.key)} />
            </div>
          ))}

          {/* Message Blasts — always on */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
            <div className="pr-4">
              <p className="text-sm font-medium text-gray-400">Message Blasts</p>
              <p className="text-xs text-gray-400 mt-0.5">Emergency alerts — always on</p>
            </div>
            <Toggle checked={true} onChange={() => {}} disabled />
          </div>
        </div>
      </main>
    </div>
  )
}
