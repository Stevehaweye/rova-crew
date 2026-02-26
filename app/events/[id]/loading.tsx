import { Skeleton } from '@/components/ui/Skeleton'

export default function EventLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-32 lg:pb-10">
      {/* Hero / Cover image skeleton */}
      <section className="relative h-64 sm:h-80 overflow-hidden">
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />

        {/* Nav skeleton */}
        <div className="absolute top-0 left-0 right-0 z-10 px-5 sm:px-10 pt-5 flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Content skeleton at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-10 pb-6 max-w-5xl">
          {/* Group identity row */}
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
            <Skeleton className="h-4 w-24" />
          </div>
          {/* Title */}
          <Skeleton className="h-8 sm:h-10 w-3/4" />
        </div>
      </section>

      {/* Info bar skeleton */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-5 sm:px-10 py-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
          {/* Left column */}
          <div className="space-y-8 min-w-0">
            {/* About this event */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <Skeleton className="h-5 w-32 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </div>

            {/* Contact organiser */}
            <Skeleton className="h-4 w-36" />

            {/* RSVP Card (mobile) */}
            <div className="lg:hidden bg-white rounded-2xl border border-gray-100 shadow-xl p-5">
              <Skeleton className="h-4 w-10 mb-1" />
              <Skeleton className="h-3 w-36 mb-4" />
              <div className="space-y-2.5">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>

            {/* Social Snowball (mobile) */}
            <div className="lg:hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <Skeleton className="h-4 w-28 mb-4" />
              <div className="flex items-center -space-x-2.5 mb-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="w-10 h-10 rounded-full flex-shrink-0" />
                ))}
              </div>
              <Skeleton className="h-4 w-52 mb-4" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>

            {/* Event Chat skeleton */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex flex-col items-center justify-center h-[200px]">
                <Skeleton className="w-10 h-10 rounded-full mb-3" />
                <Skeleton className="h-4 w-44 mb-1" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          </div>

          {/* Right column (sticky sidebar) */}
          <div className="hidden lg:block space-y-5 lg:sticky lg:top-8">
            {/* RSVP Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-5">
              <Skeleton className="h-4 w-10 mb-1" />
              <Skeleton className="h-3 w-36 mb-4" />
              <div className="space-y-2.5">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>

            {/* Social Snowball */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <Skeleton className="h-4 w-28 mb-4" />
              <div className="flex items-center -space-x-2.5 mb-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="w-10 h-10 rounded-full flex-shrink-0" />
                ))}
              </div>
              <Skeleton className="h-4 w-52 mb-4" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>

            {/* Share button */}
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </main>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-30">
        <div className="px-4 py-3 flex items-center gap-2">
          <Skeleton className="flex-1 h-12 rounded-xl" />
          <Skeleton className="flex-1 h-12 rounded-xl" />
          <Skeleton className="flex-1 h-12 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
