interface EmptyStateProps {
  icon: string
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export function EmptyState({ icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <span className="text-4xl mb-3" role="img" aria-hidden="true">{icon}</span>
      <h3 className="text-gray-900 font-semibold text-base mb-1">{title}</h3>
      <p className="text-gray-500 text-sm max-w-xs mb-4">{description}</p>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="inline-flex items-center px-5 py-2.5 bg-[#0D7377] text-white rounded-xl text-sm font-semibold hover:bg-[#0B6163] transition-colors"
        >
          {actionLabel}
        </a>
      )}
    </div>
  )
}
