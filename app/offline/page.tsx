'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D7377] to-[#0B5E61] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
          <svg className="w-10 h-10 text-white/80" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0" />
            <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-white text-2xl font-bold mb-2">You&apos;re offline</h1>
        <p className="text-white/70 text-sm mb-8 leading-relaxed">
          Check your internet connection and try again. Cached pages may still be available.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-white text-[#0D7377] font-semibold rounded-xl hover:bg-white/90 transition-colors text-sm"
        >
          Try again
        </button>

        <p className="text-white/40 text-xs mt-8 font-medium tracking-wider">ROVA CREW</p>
      </div>
    </div>
  )
}
