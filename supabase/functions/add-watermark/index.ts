// TODO: Week 8 — add sharp-based watermark overlay
// Currently returns the original image unmodified.
// When implemented, this will overlay the group name and logo on the image.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { storage_path } = await req.json()

    if (!storage_path) {
      return new Response(JSON.stringify({ error: 'storage_path is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase.storage
      .from('event-photos')
      .download(storage_path)

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Failed to download image' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // TODO: Week 8 — overlay group name and logo using sharp or canvas
    // For now, return the original image unmodified
    return new Response(data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[add-watermark] error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
