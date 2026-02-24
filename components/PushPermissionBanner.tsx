'use client'

import { useState, useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const DISMISSED_KEY = 'push-banner-dismissed'

export default function PushPermissionBanner() {
  const { permission, isSubscribed, loading, subscribe } = usePushNotifications()
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flash
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    // Check browser support
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return

    setSupported(true)
    setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true')
  }, [])

  // Don't render if: not supported, already subscribed, denied, or dismissed
  if (!supported || isSubscribed || permission === 'denied' || dismissed) {
    return null
  }

  // Also hide if permission was already granted (they may have subscribed on another device)
  if (permission === 'granted') {
    return null
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  async function handleSubscribe() {
    await subscribe()
    // Banner will auto-hide via isSubscribed becoming true
  }

  return (
    <div className="mx-4 sm:mx-6 mb-6 rounded-xl bg-teal-50 border border-teal-100 px-4 py-3 flex items-center gap-3">
      {/* Bell icon */}
      <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-teal-900">Get notified about events and chat messages</p>
      </div>

      {/* Actions */}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="flex-shrink-0 px-3.5 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors disabled:opacity-60"
      >
        {loading ? 'Enabling...' : 'Turn on'}
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-teal-400 hover:text-teal-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
