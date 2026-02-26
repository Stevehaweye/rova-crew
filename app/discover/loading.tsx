import { Skeleton } from '@/components/ui/Skeleton'

export default function DiscoverLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hero section skeleton */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200">
        <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-20 sm:py-28 lg:py-36 text-center min-h-[50vh] sm:min-h-[70vh] flex flex-col items-center justify-center">
          {/* Wordmark */}
          <Skeleton className="h-14 sm:h-20 w-72 sm:w-96 mb-6 mx-auto" />
          {/* Tagline */}
          <Skeleton className="h-7 w-64 mb-4 mx-auto" />
          <Skeleton className="h-4 w-80 mb-10 mx-auto" />
          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-12">
            <Skeleton className="h-12 w-48 rounded-xl" />
            <Skeleton className="h-12 w-52 rounded-xl" />
          </div>
          {/* Stats strip */}
          <div className="flex items-center justify-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </section>

      {/* Filter bar skeleton */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          {/* Search input */}
          <Skeleton className="h-12 w-full rounded-xl mb-3" />
          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton
                key={i}
                className="h-8 w-20 sm:w-24 rounded-full flex-shrink-0"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Trending section skeleton */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-56 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <Skeleton className="h-28 w-full rounded-none" />
              <div className="p-3">
                <Skeleton className="h-4 w-32 mb-2" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Group cards grid skeleton */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
            >
              {/* Image area */}
              <Skeleton className="h-[200px] w-full rounded-none" />
              {/* Body */}
              <div className="flex-1 px-4 pt-4 pb-2">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-3/4 mb-3" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              {/* Footer */}
              <div className="px-4 pb-4 pt-2 mt-auto">
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
