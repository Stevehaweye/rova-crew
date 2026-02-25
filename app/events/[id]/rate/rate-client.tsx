'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  event: { id: string; title: string }
  group: { name: string; slug: string; colour: string }
  existingRating: { id: string; rating: number; comment: string | null } | null
}

function StarIcon({ filled, size = 48 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? '#F59E0B' : 'none'}
      stroke={filled ? '#F59E0B' : '#D1D5DB'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

export default function RateClient({ event, group, existingRating }: Props) {
  const router = useRouter()
  const [rating, setRating] = useState(existingRating?.rating ?? 0)
  const [comment, setComment] = useState(existingRating?.comment ?? '')
  const [showComment, setShowComment] = useState(!!existingRating?.comment)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [tappedStar, setTappedStar] = useState<number | null>(null)

  const isUpdate = !!existingRating

  function handleStarTap(star: number) {
    setRating(star)
    setError('')
    setTappedStar(star)
    setTimeout(() => setTappedStar(null), 200)
  }

  async function handleSubmit() {
    if (rating === 0) {
      setError('Please select a rating')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/events/${event.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Something went wrong')
        setSubmitting(false)
        return
      }

      setSubmitted(true)
    } catch {
      setError('Something went wrong')
      setSubmitting(false)
    }
  }

  // Redirect to photos after thank-you
  useEffect(() => {
    if (!submitted) return
    const timer = setTimeout(() => {
      router.push(`/events/${event.id}/photos`)
    }, 2000)
    return () => clearTimeout(timer)
  }, [submitted, event.id, router])

  // Thank-you state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🌟</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Thanks for rating!</h1>
          <p className="text-gray-600">
            Your feedback helps {group.name} grow.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 text-center">
        <p className="text-sm text-gray-500 mb-1">{group.name}</p>
        <h1 className="text-lg font-semibold text-gray-900">{event.title}</h1>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-12">
        {/* Question */}
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          {isUpdate ? (
            <>
              You rated this{' '}
              {'★'.repeat(existingRating.rating)}
              {'☆'.repeat(5 - existingRating.rating)}
              <br />
              <span className="text-lg font-normal text-gray-600">Update your rating?</span>
            </>
          ) : (
            <>How was {event.title}?</>
          )}
        </h2>

        {/* Stars */}
        <div className="flex items-center gap-3 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleStarTap(star)}
              className="transition-transform duration-150 active:scale-110"
              style={{
                transform: tappedStar === star ? 'scale(1.25)' : 'scale(1)',
              }}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            >
              <StarIcon filled={star <= rating} />
            </button>
          ))}
        </div>

        {/* Comment toggle / textarea */}
        {!showComment ? (
          <button
            type="button"
            onClick={() => setShowComment(true)}
            className="text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            Add a comment ↓
          </button>
        ) : (
          <div className="w-full max-w-sm mb-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 200))}
              placeholder="Anything to add? (optional)"
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 resize-none"
              style={{ '--tw-ring-color': group.colour } as React.CSSProperties}
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {comment.length}/200
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full max-w-sm flex items-center justify-center px-4 py-3.5 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: group.colour }}
        >
          {submitting ? 'Submitting...' : isUpdate ? 'Update rating' : 'Submit rating'}
        </button>
      </div>
    </div>
  )
}
