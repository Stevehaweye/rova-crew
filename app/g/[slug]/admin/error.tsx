'use client'

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="h-1 bg-[#0D7377]" />
        <div className="p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-gray-900 font-bold text-lg mb-1">Unable to load admin dashboard</h2>
          <p className="text-gray-500 text-sm mb-6">We couldn&apos;t fetch the dashboard data right now.</p>
          <button
            onClick={reset}
            className="w-full py-2.5 bg-[#0D7377] text-white rounded-xl text-sm font-semibold hover:bg-[#0B6163] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
