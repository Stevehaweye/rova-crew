'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} reset={() => this.setState({ hasError: false, error: null })} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error, reset }: { error: Error | null; reset: () => void }) {
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
          <h2 className="text-gray-900 font-bold text-lg mb-1">Something went wrong</h2>
          <p className="text-gray-500 text-sm mb-6">
            We&apos;ve logged this error. Try refreshing the page.
          </p>
          <div className="space-y-2">
            <button
              onClick={reset}
              className="w-full py-2.5 bg-[#0D7377] text-white rounded-xl text-sm font-semibold hover:bg-[#0B6163] transition-colors"
            >
              Try again
            </button>
            <a
              href="/home"
              className="block w-full py-2.5 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Go to home
            </a>
          </div>
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-gray-400 cursor-pointer">Error details</summary>
              <pre className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg p-3 overflow-auto max-h-40">
                {error.message}
                {'\n'}
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
