// Placeholder: Summary card image generation
// The actual generation is handled by the Next.js API route at
// /api/events/[id]/summary-card using ImageResponse from next/og.
//
// This edge function is reserved for future use if card generation
// needs to happen outside the Next.js context (e.g., triggered by
// a database webhook or scheduled task).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async () => {
  return new Response(
    JSON.stringify({
      message:
        'Summary card generation is handled by the Next.js API route. See /api/events/[id]/summary-card.',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
})
