import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Img,
  Button,
  Hr,
  Link,
  Preview,
  Font,
  Row,
  Column,
} from '@react-email/components'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RsvpConfirmationEmailProps {
  recipientName: string
  eventTitle: string
  eventDate: string
  eventTime: string
  eventLocation: string | null
  mapsUrl: string | null
  eventUrl: string
  groupName: string
  qrCodeBase64: string
  paidAmount: string | null
  isGuest: boolean
  signUpUrl: string | null
  stripePaymentId?: string | null
  stripeReceiptUrl?: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TEAL = '#0D7377'
const GOLD = '#C9982A'
const GRAY_900 = '#111827'
const GRAY_600 = '#4B5563'
const GRAY_400 = '#9CA3AF'
const GRAY_100 = '#F3F4F6'
const BG = '#F9FAFB'

const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

// ─── Component ───────────────────────────────────────────────────────────────

export default function RsvpConfirmationEmail({
  recipientName = 'there',
  eventTitle = 'Summer Social',
  eventDate = 'Saturday 15 March 2025',
  eventTime = '2:00 PM - 5:00 PM',
  eventLocation = 'The Old Oak, London',
  mapsUrl = null,
  eventUrl = 'https://rovacrew.com/events/123',
  groupName = 'London Social Club',
  qrCodeBase64 = '',
  paidAmount = null,
  isGuest = false,
  signUpUrl = null,
  stripePaymentId = null,
  stripeReceiptUrl = null,
}: RsvpConfirmationEmailProps) {
  const firstName = recipientName.split(' ')[0]

  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="system-ui"
          fallbackFontFamily={['Arial', 'Helvetica', 'sans-serif']}
        />
      </Head>
      <Preview>You&apos;re going to {eventTitle}! Here&apos;s your check-in code.</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: BG, fontFamily }}>
        <Container
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            padding: '40px 16px',
          }}
        >
          {/* ── Card ──────────────────────────────────────────────── */}
          <Section
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {/* Header */}
            <Section style={{ padding: '28px 32px 0' }}>
              <Row>
                <Column>
                  <Text style={{ margin: 0, fontSize: '18px', fontWeight: 900, letterSpacing: '0.14em' }}>
                    <span style={{ color: TEAL }}>ROVA</span>
                    <span style={{ color: GOLD }}>CREW</span>
                  </Text>
                </Column>
              </Row>
              <Text
                style={{
                  margin: '4px 0 0',
                  fontSize: '13px',
                  color: GRAY_400,
                  fontWeight: 600,
                }}
              >
                {groupName}
              </Text>
            </Section>

            {/* Divider */}
            <Hr style={{ borderColor: GRAY_100, margin: '20px 32px' }} />

            {/* Main heading */}
            <Section style={{ padding: '0 32px' }}>
              <Text
                style={{
                  margin: '0 0 8px',
                  fontSize: '26px',
                  fontWeight: 800,
                  color: GRAY_900,
                  lineHeight: '1.25',
                }}
              >
                You&apos;re going to {eventTitle}!
              </Text>
              <Text
                style={{
                  margin: '0 0 24px',
                  fontSize: '15px',
                  color: GRAY_600,
                  lineHeight: '1.6',
                }}
              >
                Hey {firstName}, you&apos;re confirmed. Here&apos;s everything you need.
              </Text>
            </Section>

            {/* Event details box */}
            <Section
              style={{
                margin: '0 32px',
                padding: '20px 24px',
                backgroundColor: GRAY_100,
                borderRadius: '12px',
                borderLeft: `4px solid ${TEAL}`,
              }}
            >
              {/* Date */}
              <Row style={{ marginBottom: '12px' }}>
                <Column style={{ width: '28px', verticalAlign: 'top', paddingTop: '2px' }}>
                  <Img
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 24 24' stroke='%230D7377' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5'/%3E%3C/svg%3E"
                    width="18"
                    height="18"
                    alt=""
                  />
                </Column>
                <Column>
                  <Text style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: GRAY_900 }}>
                    {eventDate}
                  </Text>
                  <Text style={{ margin: '2px 0 0', fontSize: '13px', color: GRAY_600 }}>
                    {eventTime}
                  </Text>
                </Column>
              </Row>

              {/* Location */}
              {eventLocation && (
                <Row style={{ marginBottom: paidAmount ? '12px' : '0' }}>
                  <Column style={{ width: '28px', verticalAlign: 'top', paddingTop: '2px' }}>
                    <Img
                      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 24 24' stroke='%230D7377' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'/%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z'/%3E%3C/svg%3E"
                      width="18"
                      height="18"
                      alt=""
                    />
                  </Column>
                  <Column>
                    {mapsUrl ? (
                      <Link
                        href={mapsUrl}
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: TEAL,
                          textDecoration: 'none',
                        }}
                      >
                        {eventLocation} &rarr;
                      </Link>
                    ) : (
                      <Text style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: GRAY_900 }}>
                        {eventLocation}
                      </Text>
                    )}
                  </Column>
                </Row>
              )}

              {/* Payment confirmation */}
              {paidAmount && (
                <Row>
                  <Column style={{ width: '28px', verticalAlign: 'top', paddingTop: '2px' }}>
                    <Img
                      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 24 24' stroke='%230D7377' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'/%3E%3C/svg%3E"
                      width="18"
                      height="18"
                      alt=""
                    />
                  </Column>
                  <Column>
                    <Text style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: GRAY_900 }}>
                      {paidAmount} paid
                    </Text>
                    <Text style={{ margin: '2px 0 0', fontSize: '12px', color: GRAY_400 }}>
                      Payment confirmed
                      {stripePaymentId && <> &middot; Ref: {stripePaymentId.slice(-8).toUpperCase()}</>}
                    </Text>
                  </Column>
                </Row>
              )}
            </Section>

            {/* Payment receipt link */}
            {paidAmount && stripeReceiptUrl && (
              <Section style={{ padding: '0 32px', marginTop: '16px' }}>
                <Section
                  style={{
                    backgroundColor: '#F0FDF4',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    textAlign: 'center' as const,
                  }}
                >
                  <Text style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#065F46' }}>
                    Payment Receipt
                  </Text>
                  <Text style={{ margin: '0 0 12px', fontSize: '12px', color: '#6B7280' }}>
                    {eventTitle} &middot; {paidAmount}
                    {stripePaymentId && <> &middot; Ref: {stripePaymentId.slice(-8).toUpperCase()}</>}
                  </Text>
                  <Link
                    href={stripeReceiptUrl}
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: TEAL,
                      textDecoration: 'none',
                    }}
                  >
                    View full receipt &rarr;
                  </Link>
                </Section>
              </Section>
            )}

            {/* QR Code section */}
            <Hr style={{ borderColor: GRAY_100, margin: '28px 32px' }} />

            <Section style={{ padding: '0 32px', textAlign: 'center' as const }}>
              <Text
                style={{
                  margin: '0 0 4px',
                  fontSize: '16px',
                  fontWeight: 800,
                  color: GRAY_900,
                }}
              >
                Your check-in code
              </Text>
              <Text
                style={{
                  margin: '0 0 20px',
                  fontSize: '13px',
                  color: GRAY_400,
                }}
              >
                Show this code at the event entrance
              </Text>

              {qrCodeBase64 && (
                <Img
                  src={qrCodeBase64}
                  alt="Check-in QR Code"
                  width="200"
                  height="200"
                  style={{
                    margin: '0 auto',
                    borderRadius: '12px',
                    border: `2px solid ${GRAY_100}`,
                  }}
                />
              )}

              <Text
                style={{
                  margin: '16px 0 0',
                  fontSize: '12px',
                  color: GRAY_400,
                  lineHeight: '1.5',
                }}
              >
                Save this email or screenshot the QR code.
                <br />
                You can also find it in your{' '}
                <Link href={eventUrl.replace(/\/events\/.*/, '/wallet')} style={{ color: TEAL, fontWeight: 600 }}>
                  digital wallet
                </Link>
                .
              </Text>
            </Section>

            {/* CTA section */}
            <Hr style={{ borderColor: GRAY_100, margin: '28px 32px' }} />

            <Section style={{ padding: '0 32px 32px', textAlign: 'center' as const }}>
              {isGuest && signUpUrl ? (
                <>
                  <Text
                    style={{
                      margin: '0 0 4px',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: GRAY_900,
                    }}
                  >
                    Want to see who else is going?
                  </Text>
                  <Text
                    style={{
                      margin: '0 0 20px',
                      fontSize: '13px',
                      color: GRAY_600,
                      lineHeight: '1.5',
                    }}
                  >
                    Join {groupName} to see the full attendee list, group chat, and upcoming events.
                  </Text>
                  <Button
                    href={signUpUrl}
                    style={{
                      display: 'inline-block',
                      padding: '14px 32px',
                      backgroundColor: TEAL,
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      borderRadius: '12px',
                    }}
                  >
                    Join {groupName} &rarr;
                  </Button>
                </>
              ) : (
                <Button
                  href={eventUrl}
                  style={{
                    display: 'inline-block',
                    padding: '14px 32px',
                    backgroundColor: TEAL,
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    borderRadius: '12px',
                  }}
                >
                  View event &rarr;
                </Button>
              )}
            </Section>
          </Section>

          {/* Footer */}
          <Section style={{ padding: '24px 32px 0', textAlign: 'center' as const }}>
            <Text style={{ margin: '0 0 4px', fontSize: '13px', color: GRAY_400 }}>
              Questions? Just reply to this email.
            </Text>
            <Text style={{ margin: 0, fontSize: '12px', color: GRAY_400 }}>
              Sent by ROVA Crew &middot;{' '}
              <Link
                href={eventUrl.replace(/\/events\/.*/, '/home')}
                style={{ color: GRAY_400, textDecoration: 'underline' }}
              >
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
