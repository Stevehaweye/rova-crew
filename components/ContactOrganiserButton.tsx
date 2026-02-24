'use client'

import { useState } from 'react'
import ContactOrganiserModal from './ContactOrganiserModal'

export default function ContactOrganiserButton({
  groupId,
  groupName,
  colour,
  currentUser,
}: {
  groupId: string
  groupName: string
  colour: string
  currentUser: { name: string; email: string } | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors hover:bg-gray-50"
        style={{ borderColor: colour, color: colour }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
        Contact organiser
      </button>

      {open && (
        <ContactOrganiserModal
          groupId={groupId}
          groupName={groupName}
          colour={colour}
          currentUser={currentUser}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
