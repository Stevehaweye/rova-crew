'use client'

import Link from 'next/link'
import type { HallOfFameRecord } from '@/lib/hall-of-fame'

interface HallOfFameClientProps {
  records: HallOfFameRecord[]
  groupName: string
  groupSlug: string
  colour: string
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function RecordCard({ record, colour }: { record: HallOfFameRecord; colour: string }) {
  const hasHolder = record.holderId !== null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-4">
        <span className="text-3xl select-none">{record.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {record.label}
          </p>
          {hasHolder ? (
            <div className="flex items-center gap-2 mt-1.5">
              {record.holderAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={record.holderAvatarUrl}
                  alt={record.holderName}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm"
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: colour }}
                >
                  {initials(record.holderName)}
                </div>
              )}
              <span className="text-sm font-bold text-gray-900 truncate">
                {record.holderName}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-300 mt-1.5">No holder yet</p>
          )}
        </div>
        <div className="text-right">
          {hasHolder ? (
            <span
              className="inline-block text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: colour + '15', color: colour }}
            >
              {record.value}
            </span>
          ) : (
            <span className="text-sm text-gray-300">{record.value}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HallOfFameClient({
  records,
  groupName,
  groupSlug,
  colour,
}: HallOfFameClientProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/g/${groupSlug}`}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Hall of Fame</h1>
            <p className="text-xs text-gray-500">{groupName}</p>
          </div>
        </div>
      </div>

      {/* Records */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {records.map((record) => (
          <RecordCard key={record.slug} record={record} colour={colour} />
        ))}
      </div>
    </div>
  )
}
