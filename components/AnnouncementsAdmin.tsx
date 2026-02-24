'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import AnnouncementsFeed, { type Announcement } from './AnnouncementsFeed'

interface Props {
  channelId: string
  groupId: string
  groupSlug: string
  groupColour: string
  currentUserId: string
  initialAnnouncements: Announcement[]
}

export default function AnnouncementsAdmin({
  channelId,
  groupId,
  groupSlug,
  groupColour,
  currentUserId,
  initialAnnouncements,
}: Props) {
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [sendPush, setSendPush] = useState(true)
  const [posting, setPosting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB')
      return
    }

    setImageUploading(true)

    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `announcements/${groupSlug}/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('group-logos')
      .upload(path, file, { upsert: true })

    if (error) {
      console.error('[announcements] upload error:', error)
      setImageUploading(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('group-logos').getPublicUrl(data.path)

    setImageUrl(publicUrl)
    setImageUploading(false)
  }

  async function handlePost() {
    if (!content.trim() || posting) return

    setPosting(true)

    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        channelId,
        content: content.trim(),
        imageUrl: imageUrl || undefined,
        sendPush,
      }),
    })

    if (res.ok) {
      setContent('')
      setImageUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } else {
      console.error('[announcements] post failed:', await res.text())
    }

    setPosting(false)
  }

  return (
    <div className="space-y-6">
      {/* ── Compose Area ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span>✏️</span> New Announcement
        </h2>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 2000))}
          placeholder="Write an announcement for your group..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition resize-none"
          style={{ '--tw-ring-color': groupColour } as React.CSSProperties}
        />

        {/* Char count */}
        {content.length > 0 && (
          <p
            className={`text-[10px] mt-1 text-right ${
              content.length > 1800 ? 'text-amber-500' : 'text-gray-400'
            }`}
          >
            {content.length}/2000
          </p>
        )}

        {/* Image preview */}
        {imageUrl && (
          <div className="mt-3 relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Attachment"
              className="rounded-xl max-h-40 object-cover"
            />
            <button
              onClick={() => {
                setImageUrl(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Actions row */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {/* Image upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={imageUploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {imageUploading ? (
              <>
                <Spinner />
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v13.5a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Add image
              </>
            )}
          </button>

          {/* Push toggle */}
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendPush}
              onChange={(e) => setSendPush(e.target.checked)}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="font-medium">Send push notification</span>
          </label>

          {/* Post button */}
          <button
            onClick={handlePost}
            disabled={!content.trim() || posting}
            className="ml-auto px-5 py-2 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: groupColour }}
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* ── Feed ────────────────────────────────────────────────────── */}
      <AnnouncementsFeed
        channelId={channelId}
        currentUserId={currentUserId}
        initialAnnouncements={initialAnnouncements}
        isAdmin={true}
        groupColour={groupColour}
      />
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
