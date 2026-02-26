'use client'

import { useState, useEffect, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Don't show if already in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if previously dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(ios)

    if (ios) {
      // On iOS, show the manual instructions after a short delay
      const t = setTimeout(() => setShowPrompt(true), 3000)
      return () => clearTimeout(t)
    }

    // Android / Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    setShowPrompt(false)
    sessionStorage.setItem('pwa-prompt-dismissed', '1')
  }

  async function handleInstall() {
    if (!deferredPrompt.current) return
    await deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    deferredPrompt.current = null
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0D7377] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">RC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Add ROVA Crew to your home screen</p>
            {isIOS ? (
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                Tap the <span className="inline-block">
                  <svg className="w-3.5 h-3.5 inline -mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
                  </svg>
                </span>{' '}
                Share button in Safari, then select &quot;Add to Home Screen&quot;
              </p>
            ) : (
              <p className="text-gray-500 text-xs mt-1">
                Works like a native app — no app store needed
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1"
            aria-label="Dismiss install prompt"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!isIOS && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full py-2.5 rounded-xl bg-[#0D7377] text-white text-sm font-semibold hover:bg-[#0B6163] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Install
          </button>
        )}
      </div>
    </div>
  )
}
