import { NextRequest, NextResponse } from 'next/server'
import { processReminderJobs } from '@/lib/reminder-sender'

export const maxDuration = 60

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  return token === process.env.CRON_SECRET
}

// GET for Vercel Cron, POST for pg_cron via net.http_post
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return handleCron()
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return handleCron()
}

async function handleCron() {
  try {
    const results = await processReminderJobs()

    return NextResponse.json({
      success: true,
      processed: results.length,
      jobs: results,
    })
  } catch (err) {
    console.error('[cron] send-reminders error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
