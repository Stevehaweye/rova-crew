import { Skeleton } from '@/components/ui/Skeleton'

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Top Nav skeleton */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Page header */}
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* My Groups section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-3">
                {/* Group card skeletons */}
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Colour bar */}
                    <Skeleton className="w-1.5 flex-shrink-0 rounded-none" />
                    {/* Content */}
                    <div className="flex-1 px-4 py-4 flex items-center gap-4 min-w-0">
                      <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Skeleton className="h-5 w-40 mb-1.5" />
                        <Skeleton className="h-3 w-24 mb-2" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Coming Up section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-5 w-36" />
              </div>
              <div className="space-y-3">
                {/* Event card skeletons */}
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Colour bar */}
                    <Skeleton className="w-1.5 flex-shrink-0 rounded-none" />
                    <div className="flex-1 px-4 py-4 flex items-center gap-4 min-w-0">
                      {/* Date block */}
                      <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <Skeleton className="h-3 w-20 mb-1.5" />
                        <Skeleton className="h-5 w-48 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-4 w-12 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="mt-8 lg:mt-0 space-y-4">
            {/* Streak card skeleton */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <Skeleton className="h-3 w-20 mb-4" />
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div>
                  <Skeleton className="h-8 w-8 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-48 mb-4" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-28 mt-2" />
            </div>

            {/* Quick stats card skeleton */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <Skeleton className="h-3 w-20 mb-4" />
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp nudge skeleton */}
            <div className="rounded-2xl p-4 bg-gray-50">
              <div className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-36 mb-1.5" />
                  <Skeleton className="h-3 w-44 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
