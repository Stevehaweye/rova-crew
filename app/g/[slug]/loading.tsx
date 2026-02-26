import { Skeleton } from '@/components/ui/Skeleton'

export default function GroupLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hero banner skeleton */}
      <section className="relative h-72 sm:h-[400px] overflow-hidden">
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />

        {/* Nav bar skeleton */}
        <div className="absolute top-0 left-0 right-0 z-10 px-5 sm:px-10 pt-5 flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
        </div>

        {/* Hero content — bottom-left */}
        <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-10 pb-8 max-w-5xl">
          {/* Logo circle */}
          <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mb-4" />
          {/* Title */}
          <Skeleton className="h-10 sm:h-14 w-64 sm:w-80 mb-2" />
          {/* Tagline */}
          <Skeleton className="h-5 w-48 sm:w-64" />
        </div>
      </section>

      {/* Stats bar skeleton */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 sm:px-10 py-3.5 flex items-center gap-5 sm:gap-8 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>

      {/* Main content skeleton */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
          {/* Left column */}
          <div className="space-y-8 min-w-0">
            {/* About section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <Skeleton className="h-5 w-16 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </div>

            {/* Upcoming Events section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl border border-gray-100"
                  >
                    <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-48 mb-1.5" />
                      <Skeleton className="h-3 w-36 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-8 w-14 rounded-full flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Member Wall section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="flex flex-col items-center text-center">
                    <Skeleton className="w-14 h-14 rounded-full mb-2" />
                    <Skeleton className="h-3 w-12 mb-1.5" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column (sidebar) */}
          <div className="space-y-5 lg:sticky lg:top-8">
            {/* Join card skeleton */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-4 w-40 mb-4" />
              <Skeleton className="h-12 w-full rounded-xl mb-3" />
              <Skeleton className="h-3 w-32 mx-auto" />
            </div>

            {/* Group Chat link skeleton */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="w-4 h-4 rounded flex-shrink-0" />
              </div>
            </div>

            {/* Organised by skeleton */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <Skeleton className="h-3 w-20 mb-3" />
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div>
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-10 w-full rounded-xl mt-4" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
