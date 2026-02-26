import { Skeleton } from '@/components/ui/Skeleton'

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Nav skeleton */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 h-14 flex items-center px-4 sm:px-5 gap-3 flex-shrink-0">
        <Skeleton className="lg:hidden w-8 h-8 rounded-lg flex-shrink-0" />
        <Skeleton className="h-5 w-28 flex-shrink-0" />
        <div className="hidden sm:flex items-center gap-1.5 flex-1 min-w-0">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          <Skeleton className="hidden sm:block h-4 w-28" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar skeleton */}
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-white border-r border-gray-100">
          {/* Group identity */}
          <div className="px-4 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
              <div className="min-w-0">
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
          {/* Nav items */}
          <nav className="flex-1 px-3 py-3 space-y-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="w-5 h-5 rounded flex-shrink-0" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </nav>
          <div className="px-4 py-4 border-t border-gray-100">
            <Skeleton className="h-3 w-28 mx-auto" />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Page header */}
            <div>
              <Skeleton className="h-7 w-32 mb-2" />
              <Skeleton className="h-4 w-56" />
            </div>

            {/* Stat Cards grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="w-9 h-9 rounded-xl" />
                  </div>
                  <Skeleton className="h-8 w-12 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div>
              <Skeleton className="h-4 w-24 mb-3" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-2"
                  >
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Events table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-3 rounded-xl"
                  >
                    <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-44 mb-1" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <Skeleton className="h-4 w-6 mb-1" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      <Skeleton className="h-7 w-12 rounded-lg" />
                      <Skeleton className="h-7 w-10 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Members table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-0">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0"
                  >
                    <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
