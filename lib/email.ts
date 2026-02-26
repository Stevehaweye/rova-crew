import { Resend } from 'resend'
import RsvpConfirmationEmail, {
  type RsvpConfirmationEmailProps,
} from '@/app/emails/rsvp-confirmation'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'ROVA Crew <noreply@mypin.global>'

// ─── RSVP Confirmation (React Email) ────────────────────────────────────────

export async function sendRsvpConfirmationEmail(
  to: string,
  props: RsvpConfirmationEmailProps
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      replyTo: FROM_EMAIL,
      subject: `You're going to ${props.eventTitle}! Here's your check-in code.`,
      react: RsvpConfirmationEmail(props),
    })

    if (error) {
      console.error('[email] RSVP confirmation error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send email'
    console.error('[email] RSVP confirmation error:', err)
    return { success: false, error: message }
  }
}

// ─── Shared Layout ───────────────────────────────────────────────────────────

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ROVA Crew</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #f3f4f6;">
              <span style="font-size:18px;font-weight:900;letter-spacing:0.14em;color:#0D7377;">ROVA</span><span style="font-size:18px;font-weight:900;letter-spacing:0.14em;color:#C9982A;">CREW</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
                Sent by ROVA Crew &middot;
                <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#9ca3af;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
  <tr>
    <td style="background-color:#0D7377;border-radius:12px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.02em;">
        ${text}
      </a>
    </td>
  </tr>
</table>`
}

function infoBox(rows: { label: string; value: string }[]): string {
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 0;font-size:13px;color:#6b7280;width:100px;vertical-align:top;">${r.label}</td>
          <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;">${r.value}</td>
        </tr>`
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:2px solid #0D7377;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="padding:20px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rowsHtml}
      </table>
    </td>
  </tr>
</table>`
}

// ─── Message Blast ──────────────────────────────────────────────────────────

interface BlastEmailParams {
  recipientEmail: string
  recipientName: string
  groupName: string
  groupSlug: string
  title: string
  body: string
}

export async function sendBlastEmail({
  recipientEmail,
  recipientName,
  groupName,
  groupSlug,
  title,
  body,
}: BlastEmailParams): Promise<{ success: true } | { success: false; error: string }> {
  const firstName = recipientName.split(' ')[0]
  const groupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/g/${groupSlug}`

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">
      ${title}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hey ${firstName}, <strong style="color:#111827;">${groupName}</strong> has an important message for you:
    </p>

    <div style="margin:24px 0;padding:20px 24px;background-color:#f9fafb;border-radius:12px;border-left:4px solid #0D7377;">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-line;">${body}</p>
    </div>

    ${ctaButton('Go to ' + groupName + ' \\u2192', groupUrl)}
  `

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `[${groupName}] ${title}`,
      html: emailLayout(content),
    })

    if (error) {
      console.error('[email] blast error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send email'
    console.error('[email] blast error:', err)
    return { success: false, error: message }
  }
}

// ─── Event Reminder ─────────────────────────────────────────────────────────

interface ReminderEmailParams {
  recipientEmail: string
  recipientName: string
  eventTitle: string
  eventDate: string
  eventTime: string
  eventLocation: string
  eventUrl: string
  groupName: string
  reminderType: '7day' | '48h_rsvpd'
}

export async function sendReminderEmail({
  recipientEmail,
  recipientName,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  eventUrl,
  groupName,
  reminderType,
}: ReminderEmailParams): Promise<{ success: true } | { success: false; error: string }> {
  const firstName = recipientName.split(' ')[0]
  const headline = reminderType === '7day' ? 'is in 1 week' : 'is in 2 days'

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">
      ${eventTitle} ${headline}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hey ${firstName}, just a heads-up — your event with <strong style="color:#111827;">${groupName}</strong> is coming up soon.
    </p>

    ${infoBox([
      { label: 'Event', value: eventTitle },
      { label: 'Date', value: eventDate },
      { label: 'Time', value: eventTime },
      { label: 'Location', value: eventLocation || 'TBC' },
    ])}

    ${ctaButton('View Event \\u2192', eventUrl)}
  `

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `Reminder: ${eventTitle} — ${eventDate}`,
      html: emailLayout(content),
    })

    if (error) {
      console.error('[email] reminder error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send email'
    console.error('[email] reminder error:', err)
    return { success: false, error: message }
  }
}

// ─── Waitlist Promotion ─────────────────────────────────────────────────────

interface WaitlistEmailParams {
  recipientEmail: string
  recipientName: string
  eventTitle: string
  eventDate: string
  eventTime: string
  eventLocation: string
  eventUrl: string
  groupName: string
}

export async function sendWaitlistEmail({
  recipientEmail,
  recipientName,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  eventUrl,
  groupName,
}: WaitlistEmailParams): Promise<{ success: true } | { success: false; error: string }> {
  const firstName = recipientName.split(' ')[0]

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">
      You&rsquo;re in! 🎉
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Great news ${firstName} — a spot opened up for <strong style="color:#111827;">${eventTitle}</strong> with ${groupName}, and you&rsquo;ve been moved off the waitlist.
    </p>

    ${infoBox([
      { label: 'Event', value: eventTitle },
      { label: 'Date', value: eventDate },
      { label: 'Time', value: eventTime },
      { label: 'Location', value: eventLocation || 'TBC' },
    ])}

    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
      Your RSVP has been automatically confirmed. See you there!
    </p>

    ${ctaButton('View Event \\u2192', eventUrl)}
  `

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `A spot opened up for ${eventTitle}!`,
      html: emailLayout(content),
    })

    if (error) {
      console.error('[email] waitlist error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send email'
    console.error('[email] waitlist error:', err)
    return { success: false, error: message }
  }
}

// ─── 1. Guest RSVP Confirmation ──────────────────────────────────────────────

interface RsvpConfirmationParams {
  guestName: string
  guestEmail: string
  eventTitle: string
  eventDate: string
  eventLocation: string
  eventUrl: string
  qrCodeBase64: string
  groupName: string
}

export async function sendGuestRsvpConfirmation({
  guestName,
  guestEmail,
  eventTitle,
  eventDate,
  eventLocation,
  eventUrl,
  qrCodeBase64,
  groupName,
}: RsvpConfirmationParams): Promise<{ success: true } | { success: false; error: string }> {
  const firstName = guestName.split(' ')[0]

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">
      You&rsquo;re going! 🎉
    </h1>
    <p style="margin:0 0 4px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hey ${firstName}, you&rsquo;re confirmed for <strong style="color:#111827;">${eventTitle}</strong> with ${groupName}.
    </p>

    ${infoBox([
      { label: 'Event', value: eventTitle },
      { label: 'Date', value: eventDate },
      { label: 'Location', value: eventLocation },
      { label: 'Group', value: groupName },
    ])}

    ${qrCodeBase64 ? `
    <div style="text-align:center;margin:24px 0;">
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">Your entry QR code</p>
      <img src="${qrCodeBase64}" alt="QR Code" width="180" height="180" style="border-radius:12px;border:1px solid #e5e7eb;" />
    </div>` : ''}

    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
      Save this email — you might need it on the day. See you there!
    </p>

    ${ctaButton('View Event Details \u2192', eventUrl)}
  `

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: guestEmail,
      subject: `You're going to ${eventTitle}! Here's everything you need.`,
      html: emailLayout(content),
    })

    if (error) {
      console.error('[email] RSVP confirmation error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send email'
    console.error('[email] RSVP confirmation error:', err)
    return { success: false, error: message }
  }
}

// ─── 2. Guest Conversion Email ───────────────────────────────────────────────

interface ConversionParams {
  guestName: string
  guestEmail: string
  groupName: string
  groupSlug: string
  conversionUrl: string
}

export async function sendGuestConversionEmail({
  guestName,
  guestEmail,
  groupName,
  groupSlug,
  conversionUrl,
}: ConversionParams): Promise<{ success: true } | { success: false; error: string }> {
  const firstName = guestName.split(' ')[0]
  const groupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/g/${groupSlug}`

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">
      Great to meet you, ${firstName}! 👋
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Thanks for coming along to a <strong style="color:#111827;">${groupName}</strong> event. We hope you had a brilliant time.
    </p>

    ${infoBox([
      { label: 'Group', value: groupName },
      { label: 'What next', value: 'Join properly and never miss an event' },
    ])}

    <p style="margin:24px 0 0;font-size:15px;color:#6b7280;line-height:1.6;">
      Create a free ROVA Crew account to:
    </p>
    <ul style="margin:12px 0 0;padding-left:20px;font-size:14px;color:#374151;line-height:2;">
      <li>Get notified about upcoming events</li>
      <li>RSVP instantly — no forms needed</li>
      <li>Build your crew score and unlock tiers</li>
      <li>Chat with other members</li>
    </ul>

    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
      It takes 30 seconds — just your email, no password needed.
    </p>

    ${ctaButton('Join ' + groupName + ' \u2192', conversionUrl)}

    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
      Or visit the group page: <a href="${groupUrl}" style="color:#0D7377;font-weight:600;">${groupName}</a>
    </p>
  `

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: guestEmail,
      subject: `Loved having you at ${groupName} — join properly in 30 seconds`,
      html: emailLayout(content),
    })

    if (error) {
      console.error('[email] conversion email error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send email'
    console.error('[email] conversion email error:', err)
    return { success: false, error: message }
  }
}

// ─── Join Request Notification (to admin) ───────────────────────────────────

interface JoinRequestEmailParams {
  adminEmail: string
  adminName: string
  memberName: string
  memberEmail: string
  groupName: string
  groupSlug: string
}

export async function sendJoinRequestEmail({
  adminEmail,
  adminName,
  memberName,
  memberEmail,
  groupName,
  groupSlug,
}: JoinRequestEmailParams): Promise<{ success: true } | { success: false; error: string }> {
  const firstName = adminName.split(' ')[0]
  const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/g/${groupSlug}/admin/members?tab=pending`

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">
      New join request
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hey ${firstName}, <strong style="color:#111827;">${memberName}</strong> wants to join <strong style="color:#111827;">${groupName}</strong>.
    </p>

    ${infoBox([
      { label: 'Name', value: memberName },
      { label: 'Email', value: memberEmail },
      { label: 'Group', value: groupName },
    ])}

    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
      Review their request in your admin panel.
    </p>

    ${ctaButton('Review Request \\u2192', reviewUrl)}
  `

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `${memberName} wants to join ${groupName}`,
      html: emailLayout(content),
    })

    if (error) {
      console.error('[email] join request error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send email'
    console.error('[email] join request error:', err)
    return { success: false, error: message }
  }
}

// ─── Member Approved Notification ───────────────────────────────────────────

interface MemberApprovedEmailParams {
  memberEmail: string
  memberName: string
  groupName: string
  groupSlug: string
}

export async function sendMemberApprovedEmail({
  memberEmail,
  memberName,
  groupName,
  groupSlug,
}: MemberApprovedEmailParams): Promise<{ success: true } | { success: false; error: string }> {
  const firstName = memberName.split(' ')[0]
  const groupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/g/${groupSlug}`

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">
      You&rsquo;re in! Welcome to ${groupName}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hey ${firstName}, great news &mdash; your request to join <strong style="color:#111827;">${groupName}</strong> has been approved.
    </p>

    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;line-height:1.6;">
      You can now:
    </p>
    <ul style="margin:12px 0 0;padding-left:20px;font-size:14px;color:#374151;line-height:2;">
      <li>RSVP to upcoming events</li>
      <li>Chat with other members</li>
      <li>Earn spirit points and climb the leaderboard</li>
    </ul>

    ${ctaButton('Go to ' + groupName + ' \\u2192', groupUrl)}
  `

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: memberEmail,
      subject: `Welcome to ${groupName}!`,
      html: emailLayout(content),
    })

    if (error) {
      console.error('[email] member approved error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send email'
    console.error('[email] member approved error:', err)
    return { success: false, error: message }
  }
}

// ─── 3. Contact Organiser ────────────────────────────────────────────────────

interface ContactOrganiserParams {
  adminEmail: string
  adminName: string
  senderName: string
  senderEmail: string
  message: string
  groupName: string
}

export async function sendContactOrganiserEmail({
  adminEmail,
  adminName,
  senderName,
  senderEmail,
  message,
  groupName,
}: ContactOrganiserParams): Promise<{ success: true } | { success: false; error: string }> {
  const firstName = adminName.split(' ')[0]

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">
      New message from ${senderName}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hey ${firstName}, someone has sent you a message about <strong style="color:#111827;">${groupName}</strong>.
    </p>

    ${infoBox([
      { label: 'From', value: senderName },
      { label: 'Email', value: senderEmail },
      { label: 'Group', value: groupName },
    ])}

    <div style="margin:24px 0;padding:20px 24px;background-color:#f9fafb;border-radius:12px;border-left:4px solid #0D7377;">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-line;">${message}</p>
    </div>

    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
      You can reply directly to this email — it will go to <strong>${senderEmail}</strong>.
    </p>
  `

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      replyTo: senderEmail,
      subject: `[${groupName}] Message from ${senderName}`,
      html: emailLayout(content),
    })

    if (error) {
      console.error('[email] contact organiser error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to send email'
    console.error('[email] contact organiser error:', err)
    return { success: false, error: msg }
  }
}
