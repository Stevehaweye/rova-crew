'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Tab = 'signin' | 'signup'
type FormState = 'idle' | 'loading' | 'success' | 'error'

// ─── Icons ───────────────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function EnvelopeIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ color: '#0D7377' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  )
}

// ─── Feature list for left panel ─────────────────────────────────────────────

const FEATURES = [
  {
    icon: <CalendarIcon />,
    title: 'Events & Attendance',
    desc: 'Track who shows up, every single time.',
  },
  {
    icon: <TrophyIcon />,
    title: 'Crew Scores & Tiers',
    desc: 'Reward loyalty, spirit, and adventure.',
  },
  {
    icon: <UsersIcon />,
    title: 'Group Management',
    desc: 'One organised hub for your whole crew.',
  },
]

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState({ email, onReset }: { email: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      {/* Animated envelope */}
      <div className="relative flex items-center justify-center mb-7">
        <span
          className="absolute inline-flex w-20 h-20 rounded-full animate-ping opacity-10"
          style={{ backgroundColor: '#0D7377' }}
        />
        <span
          className="relative inline-flex items-center justify-center w-16 h-16 rounded-full"
          style={{ backgroundColor: '#0D7377' + '18' }}
        >
          <EnvelopeIcon />
        </span>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
      <p className="text-sm text-gray-500 mb-1">We sent a sign-in link to</p>
      <p className="text-sm font-semibold text-gray-800 mb-7 break-all">{email}</p>

      <p className="text-xs text-gray-400 leading-relaxed">
        Didn&apos;t receive it? Check your spam folder or{' '}
        <button
          type="button"
          onClick={onReset}
          className="underline font-medium"
          style={{ color: '#0D7377' }}
        >
          try again
        </button>
        .
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function reset() {
    setFormState('idle')
    setErrorMsg('')
    setEmail('')
    setFullName('')
  }

  function switchTab(next: Tab) {
    setTab(next)
    setFormState('idle')
    setErrorMsg('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('loading')
    setErrorMsg('')

    const supabase = createClient()
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        ...(tab === 'signup' && { data: { full_name: fullName } }),
      },
    })

    if (error) {
      setFormState('error')
      setErrorMsg(error.message)
    } else {
      setFormState('success')
    }
  }

  const isLoading = formState === 'loading'

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — desktop only ───────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-14 overflow-hidden"
        style={{ backgroundColor: '#0D7377' }}
      >
        {/* Decorative background circles */}
        <div className="absolute -top-28 -right-28 w-[28rem] h-[28rem] rounded-full bg-white opacity-[0.06] pointer-events-none" />
        <div className="absolute -bottom-36 -left-20 w-96 h-96 rounded-full bg-white opacity-[0.06] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full bg-white opacity-[0.03] pointer-events-none" />

        {/* Wordmark */}
        <div className="relative z-10">
          <p className="text-5xl font-black tracking-[0.18em] text-white leading-tight select-none">
            ROVA
          </p>
          <p
            className="text-5xl font-black tracking-[0.18em] leading-tight select-none"
            style={{ color: '#C9982A' }}
          >
            CREW
          </p>
        </div>

        {/* Tagline + features */}
        <div className="relative z-10">
          <p className="text-[2rem] font-light text-white/75 leading-snug">Your community.</p>
          <p className="text-[2rem] font-bold text-white leading-snug mb-12">Organised.</p>

          <div className="space-y-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-white/[0.15]">
                  {f.icon}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-white/55 text-sm mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-white/25 text-xs">
          © {new Date().getFullYear()} ROVA Crew
        </p>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center min-h-screen bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 px-8 py-10 lg:px-10">

            {/* Logo */}
            <div className="text-center mb-8">
              <div className="select-none">
                <span
                  className="text-[1.75rem] font-black tracking-[0.16em]"
                  style={{ color: '#0D7377' }}
                >
                  ROVA
                </span>
                <span
                  className="text-[1.75rem] font-black tracking-[0.16em]"
                  style={{ color: '#C9982A' }}
                >
                  CREW
                </span>
              </div>
              <p className="text-gray-400 text-xs mt-1.5 tracking-wide">
                Your community. Organised.
              </p>
            </div>

            {formState === 'success' ? (
              <SuccessState email={email} onReset={reset} />
            ) : (
              <>
                {/* Tab toggle */}
                <div className="flex rounded-xl bg-gray-100 p-1 mb-7">
                  {(['signin', 'signup'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => switchTab(t)}
                      className={[
                        'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        tab === t
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700',
                      ].join(' ')}
                    >
                      {t === 'signin' ? 'Sign in' : 'Create account'}
                    </button>
                  ))}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                  {tab === 'signup' && (
                    <div>
                      <label
                        htmlFor="full-name"
                        className="block text-sm font-medium text-gray-700 mb-1.5"
                      >
                        Full name
                      </label>
                      <input
                        id="full-name"
                        type="text"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Smith"
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
                      />
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D7377] focus:border-transparent transition"
                    />
                  </div>

                  {formState === 'error' && (
                    <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
                      <p className="text-red-600 text-sm">{errorMsg}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-lg text-white font-semibold text-sm tracking-wide transition-opacity hover:opacity-90 disabled:opacity-60 mt-1"
                    style={{ backgroundColor: '#0D7377' }}
                  >
                    {isLoading
                      ? 'Sending\u2026'
                      : tab === 'signin'
                      ? 'Send magic link'
                      : 'Create account'}
                  </button>
                </form>

                {/* Footer nudge */}
                <p className="text-center text-[0.72rem] text-gray-400 mt-8 leading-relaxed">
                  Migrating from WhatsApp?{' '}
                  <span className="text-gray-500 font-medium">You&apos;re in the right place.</span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
