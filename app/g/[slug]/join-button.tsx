'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type JoinStatus = 'idle' | 'loading' | 'joined' | 'pending' | 'error'

export interface JoinCardProps {
  groupId: string
  groupSlug: string
  groupName: string
  groupColour: string
  requireApproval: boolean
  memberCount: number
  /** null = not a member, 'approved' | 'pending' from DB */
  initialStatus: 'approved' | 'pending' | null
  isLoggedIn: boolean
  membershipFeeEnabled?: boolean
  membershipFeePence?: number | null
}

// ─── Animated checkmark ───────────────────────────────────────────────────────

function AnimatedCheck({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
        style={{
          strokeDasharray: 30,
          strokeDashoffset: animate ? 0 : 30,
          transition: 'stroke-dashoffset 0.55s cubic-bezier(0.65, 0, 0.35, 1) 0.1s',
        }}
      />
    </svg>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Join Card ────────────────────────────────────────────────────────────────

export function JoinCard({
  groupId,
  groupSlug,
  groupName,
  groupColour,
  requireApproval,
  memberCount,
  initialStatus,
  isLoggedIn,
  membershipFeeEnabled,
  membershipFeePence,
}: JoinCardProps) {
  const router = useRouter()

  const [status, setStatus] = useState<JoinStatus>(
    initialStatus === 'approved' ? 'joined' :
    initialStatus === 'pending'  ? 'pending' :
    'idle'
  )
  const [localCount, setLocalCount] = useState(memberCount)
  const [errorMsg, setErrorMsg] = useState('')
  const [checkAnimated, setCheckAnimated] = useState(initialStatus === 'approved')

  // Trigger checkmark draw animation after joining
  useEffect(() => {
    if (status === 'joined') {
      const t = setTimeout(() => setCheckAnimated(true), 160)
      return () => clearTimeout(t)
    }
  }, [status])

  const isPaidGroup = membershipFeeEnabled && membershipFeePence && membershipFeePence > 0
  const feeLabel = isPaidGroup ? `£${(membershipFeePence / 100).toFixed(2)}/month` : null

  async function handleJoin() {
    if (!isLoggedIn) {
      router.push(`/auth?next=/g/${groupSlug}`)
      return
    }

    setStatus('loading')
    setErrorMsg('')

    // For paid groups, redirect to subscription checkout
    if (isPaidGroup) {
      try {
        const res = await fetch('/api/stripe/subscription-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: groupId }),
        })

        const data = await res.json()

        if (!res.ok) {
          setStatus('error')
          setErrorMsg(data.error || 'Something went wrong.')
          return
        }

        if (data.url) {
          window.location.href = data.url
          return
        }

        setStatus('error')
        setErrorMsg('Could not create checkout session.')
      } catch {
        setStatus('error')
        setErrorMsg('Network error. Please try again.')
      }
      return
    }

    // Free group — direct join
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/auth?next=/g/${groupSlug}`)
      return
    }

    const newStatus = requireApproval ? 'pending' : 'approved'

    const { error: memberErr } = await supabase
      .from('group_members')
      .upsert(
        { group_id: groupId, user_id: user.id, role: 'member', status: newStatus },
        { onConflict: 'group_id,user_id' }
      )

    if (memberErr) {
      setStatus('error')
      setErrorMsg(memberErr.message)
      return
    }

    if (newStatus === 'approved') {
      await supabase
        .from('member_stats')
        .upsert(
          { user_id: user.id, group_id: groupId },
          { onConflict: 'user_id,group_id' }
        )
      setLocalCount((c) => c + 1)
      setStatus('joined')
    } else {
      setStatus('pending')
    }
  }

  const isJoined  = status === 'joined'
  const isPending = status === 'pending'
  const isLoading = status === 'loading'
  const isIdle    = status === 'idle'

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl" style={{ backgroundColor: groupColour }}>

      {/* Header */}
      <div className="px-6 pt-7 pb-5">
        <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-2">
          Community
        </p>
        <h3 className="text-white font-bold text-xl leading-snug mb-3">
          {isJoined  ? 'You\u2019re in the crew!' :
           isPending ? 'Request submitted' :
           `Join ${groupName}`}
        </h3>
        <div className="flex items-center gap-1.5 text-white/70 text-sm font-medium">
          <UsersIcon />
          {localCount} member{localCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Action area */}
      <div className="px-6 pb-6 pt-1 space-y-3">

        {status === 'error' && (
          <div className="rounded-xl bg-red-900/30 border border-red-400/20 px-3 py-2">
            <p className="text-red-200 text-xs">{errorMsg}</p>
          </div>
        )}

        {isJoined ? (
          <div
            className="w-full py-3.5 rounded-xl bg-white flex items-center justify-center gap-2 font-bold text-sm"
            style={{ color: groupColour }}
          >
            <AnimatedCheck animate={checkAnimated} />
            You&apos;re a member
          </div>
        ) : isPending ? (
          <div className="w-full py-3.5 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center gap-2 font-semibold text-sm text-white">
            <ClockIcon />
            Request sent &mdash; awaiting approval
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-white font-bold text-sm transition-all duration-200 hover:shadow-lg hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ color: groupColour }}
          >
            {isLoading ? (
              <><Spinner /> {isPaidGroup ? 'Redirecting\u2026' : 'Joining\u2026'}</>
            ) : isPaidGroup ? (
              `Join — ${feeLabel} \u2192`
            ) : requireApproval ? (
              'Request to join \u2192'
            ) : (
              'Join the crew \u2192'
            )}
          </button>
        )}

        {isIdle && requireApproval && (
          <p className="text-white/55 text-xs text-center flex items-center justify-center gap-1.5">
            <LockIcon />
            Admin approval required
          </p>
        )}

        {!isLoggedIn && isIdle && (
          <p className="text-white/55 text-xs text-center">
            You&apos;ll be asked to sign in first
          </p>
        )}

        {isJoined && (
          <a
            href={`/g/${groupSlug}`}
            className="block text-center text-white/60 text-xs hover:text-white/90 transition-colors py-1"
          >
            View group page
          </a>
        )}
      </div>
    </div>
  )
}
