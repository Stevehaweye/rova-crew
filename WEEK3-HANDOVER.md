# ROVA Crew — Week 3 Handover Summary

**Date**: 24 February 2026
**Live URL**: https://rova-crew.netlify.app
**Repo**: https://github.com/Stevehaweye/rova-crew

---

## 1. Files Created or Modified

### New Files (25)

| File | Purpose |
|---|---|
| `app/api/stripe/checkout/route.ts` | Creates Stripe Checkout sessions for paid events (member + guest); calculates 5% platform fee (min 30p) |
| `app/api/stripe/connect/route.ts` | Stripe Connect Express account creation + onboarding link for group admins |
| `app/api/stripe/create-product/route.ts` | Creates Stripe Product + Price for fixed-price events |
| `app/api/stripe/webhook/route.ts` | Handles `checkout.session.completed`, `payment_intent.payment_failed`, `account.updated` webhooks |
| `app/api/events/[id]/checkin/route.ts` | Check-in API: POST for QR scan (member by user_id, guest by qr_token); PATCH for manual check-in/undo |
| `app/api/emails/rsvp-confirmation/route.ts` | API route to preview/send RSVP confirmation emails |
| `app/emails/rsvp-confirmation.tsx` | React Email template: branded confirmation with QR code, payment receipt, maps link, guest signup CTA |
| `app/events/[id]/payment-success/page.tsx` | Server component: verifies Stripe session, upserts RSVP + payment, fetches event details |
| `app/events/[id]/payment-success/payment-success-client.tsx` | Success UI: confetti animation, event summary, payment receipt, "Add to Calendar" |
| `app/g/[slug]/admin/settings/page.tsx` | Admin settings: auth + role check, fetches Stripe account status, refreshes from Stripe API on `?stripe=complete` |
| `app/g/[slug]/admin/settings/settings-client.tsx` | Settings UI: 4 Stripe states (not connected, incomplete, pending review, connected) with toast notifications |
| `app/g/[slug]/admin/events/[id]/checkin/page.tsx` | Check-in page wrapper: auth + admin check, fetches event + attendee data |
| `app/g/[slug]/admin/events/[id]/checkin/checkin-client.tsx` | QR scanner: camera stream, jsqr decode, audio beeps, real-time attendee list, manual check-in/undo |
| `app/wallet/page.tsx` | Wallet server component: fetches tier, group memberships, upcoming RSVPs |
| `app/wallet/crew-card-client.tsx` | Animated CREW CARD: member tier, QR code, streak counter, upcoming events list |
| `app/profile/page.tsx` | Profile server component: fetches user stats (groups joined, events attended) |
| `app/profile/profile-client.tsx` | Profile UI: avatar/initials, name, email, stats cards, sign out |
| `app/auth/callback/page.tsx` | Client-side auth callback: handles both PKCE code exchange and implicit flow hash tokens |
| `components/BottomNav.tsx` | Self-hiding bottom nav: 4 tabs (Home, Discover, Card, Profile), shows on app pages, hides on admin |
| `components/events/SharedCostTicker.tsx` | Animated cost-per-person ticker for shared-cost events |
| `lib/stripe.ts` | Stripe server singleton (wraps `new Stripe(STRIPE_SECRET_KEY)`) |
| `lib/stripe-client.ts` | Stripe browser loader (`loadStripe`) |
| `lib/email.ts` | `sendRsvpConfirmationEmail` helper wrapping React Email + Resend |

### Modified Files (19)

| File | Change |
|---|---|
| `app/events/[id]/event-page-client.tsx` | Added guest RSVP form, Stripe checkout integration, payment button, guest name fields in metadata |
| `app/events/[id]/page.tsx` | Fetches Stripe account + event pricing for payment flow |
| `app/g/[slug]/admin/admin-shell.tsx` | Enabled Settings nav item, added `settings` route, added `stripeConnected` prop + purple CTA banner |
| `app/g/[slug]/admin/page.tsx` | Fetches `stripe_accounts` status, passes `stripeConnected` to AdminShell |
| `app/g/[slug]/admin/events/new/event-form.tsx` | Added payment type selector (free/fixed/shared), Stripe Connect warning banner, price fields, wired "Connect Stripe" link to settings |
| `app/g/[slug]/admin/events/new/page.tsx` | Passes `hasStripeAccount` to event form |
| `app/g/[slug]/admin/events/page.tsx` | Added check-in link for each event |
| `app/g/[slug]/page.tsx` | Added `pb-24` for bottom nav spacing |
| `app/api/events/[id]/guest-rsvp/route.ts` | Switched to `sendRsvpConfirmationEmail` helper, sends full props including QR code |
| `app/home/page.tsx` | Added `pb-24`, moved FAB above bottom nav |
| `app/discovery-client.tsx` | Added `pb-24` for bottom nav |
| `app/layout.tsx` | Added `<BottomNav />`, viewport-fit=cover meta |
| `app/page.tsx` | Minor landing page tweak |
| `app/discover/page.tsx` | Minor layout fix |
| `lib/supabase/client.ts` | Added `auth: { flowType: 'implicit' }` to fix PKCE issues on Netlify |
| `lib/supabase/server.ts` | Minor cookie handling improvement |
| `tsconfig.json` | Adjusted compiler options |
| `package.json` | Added stripe, jsqr, qrcode, react-email, date-fns dependencies |

### Additional Files — Post-Testing Refinements (7)

| File | Purpose |
|---|---|
| `app/api/events/[id]/rsvp/route.ts` | Server-side member RSVP handler; sends confirmation email with QR code for free events |
| `app/g/[slug]/admin/events/[id]/edit/page.tsx` | Event edit page: auth + admin check, fetches event, passes `initialData` to EventForm |
| `app/api/contact-organiser/route.ts` | Contact organiser email relay: fetches admin email, sends via Resend with `replyTo` (admin email stays private) |
| `components/ContactOrganiserModal.tsx` | Form modal: name, email (auto-filled if logged in), message; calls contact API |
| `components/ContactOrganiserButton.tsx` | Client wrapper for ContactOrganiserModal on server component pages (group page) |
| `app/api/groups/[slug]/membership-fee/route.ts` | Admin API to enable/disable membership fee; creates Stripe Product + recurring Price on connected account |
| `app/api/stripe/subscription-checkout/route.ts` | Creates Stripe Checkout session in `subscription` mode for group membership; 5% application fee |

### Additional Modifications — Post-Testing Refinements (12)

| File | Change |
|---|---|
| `app/events/[id]/event-page-client.tsx` | Replaced direct Supabase RSVP upsert with API call; added organiser display; added "Contact organiser" button + modal |
| `app/events/[id]/page.tsx` | Fetches event creator profile for organiser display; passes `organiser` + `group.id` to client |
| `app/g/[slug]/admin/events/new/event-form.tsx` | Added `eventId` + `initialData` props for edit mode; conditional insert vs update; dynamic heading/button text; existing cover image handling |
| `app/g/[slug]/admin/events/page.tsx` | Added "Edit" link next to "View" for non-past events |
| `app/g/[slug]/admin/admin-shell.tsx` | Added "Edit" link next to "View" in dashboard upcoming events section |
| `app/g/[slug]/page.tsx` | Fetches super_admin profile for "Organised by" card; added ContactOrganiserButton; passes membership fee data to JoinCard |
| `app/g/[slug]/join-button.tsx` | Added `membershipFeeEnabled` + `membershipFeePence` props; paid groups redirect to subscription checkout; button shows price |
| `app/g/[slug]/admin/settings/page.tsx` | Fetches `membership_fee_enabled` + `membership_fee_pence` from groups table; passes to SettingsClient |
| `app/g/[slug]/admin/settings/settings-client.tsx` | Added "Monthly Membership Fee" section (toggle + price input + save) below Stripe card; only visible when Stripe connected |
| `app/emails/rsvp-confirmation.tsx` | Added `stripePaymentId` + `stripeReceiptUrl` props; payment reference display; "Payment Receipt" section with Stripe receipt link |
| `app/api/stripe/webhook/route.ts` | Retrieves payment intent with expanded `latest_charge`; extracts `receipt_url`; passes to email for both guest + member flows |
| `lib/email.ts` | Added `sendContactOrganiserEmail()` helper with HTML layout and `replyTo` support |

---

## 2. Database Tables & Columns Added

### New Tables

**`stripe_accounts`**
```sql
id                uuid PK DEFAULT gen_random_uuid()
group_id          uuid UNIQUE NOT NULL → groups(id) ON DELETE CASCADE
stripe_account_id text UNIQUE NOT NULL
charges_enabled   boolean DEFAULT false
payouts_enabled   boolean DEFAULT false
details_submitted boolean DEFAULT false
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
```
RLS: SELECT for group admins only (super_admin, co_admin)

**`payments`**
```sql
id                          uuid PK DEFAULT gen_random_uuid()
group_id                    uuid → groups(id)
event_id                    uuid → events(id)
user_id                     uuid → profiles(id) (nullable for guests)
guest_email                 text (nullable)
stripe_checkout_session_id  text
stripe_payment_intent_id    text (nullable)
amount_pence                integer NOT NULL
platform_fee_pence          integer
currency                    text DEFAULT 'gbp'
status                      text DEFAULT 'pending'  -- pending/paid/failed
payment_type                text
created_at                  timestamptz DEFAULT now()
updated_at                  timestamptz DEFAULT now()
```
RLS enabled (policies TBD based on usage)

### Columns Added to Existing Tables

| Table | Column | Type | Notes |
|---|---|---|---|
| `events` | `payment_type` | text DEFAULT 'free' | free, fixed, shared_cost |
| `events` | `price_pence` | integer | For fixed-price events |
| `events` | `stripe_product_id` | text | Stripe product reference |
| `events` | `stripe_price_id` | text | Stripe price reference |
| `rsvps` | `payment_status` | text | paid/pending/null |

### Additional Tables — Post-Testing Refinements

**`group_subscriptions`** (requires SQL migration — see section 9)
```sql
id                      uuid PK DEFAULT gen_random_uuid()
group_id                uuid → groups(id) ON DELETE CASCADE
user_id                 uuid → profiles(id) ON DELETE CASCADE
stripe_subscription_id  text UNIQUE NOT NULL
stripe_customer_id      text NOT NULL
status                  text DEFAULT 'active'  -- active/cancelled/past_due/incomplete/expired
current_period_start    timestamptz
current_period_end      timestamptz
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
UNIQUE (group_id, user_id)
```
RLS: SELECT for own subscriptions + group admins

### Additional Columns — Post-Testing Refinements

| Table | Column | Type | Notes |
|---|---|---|---|
| `groups` | `membership_fee_pence` | integer | Monthly fee amount in pence |
| `groups` | `membership_fee_enabled` | boolean DEFAULT false | Toggle for membership fee |
| `groups` | `stripe_subscription_price_id` | text | Stripe recurring Price ID on connected account |

---

## 3. Environment Variables Required

| Variable | Where | Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Netlify + .env.local | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Netlify + .env.local | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify + .env.local | `eyJ...` (service role) |
| `NEXT_PUBLIC_APP_URL` | Netlify + .env.local | `https://rova-crew.netlify.app` |
| `RESEND_API_KEY` | Netlify + .env.local | `re_...` |
| `STRIPE_SECRET_KEY` | Netlify + .env.local | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Netlify + .env.local | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Netlify + .env.local | `whsec_...` |

---

## 4. WOW Moments — What's Demonstrable

### WOW 1: Stripe Connect Onboarding
**Demo**: Go to `/g/midnight-runner/admin` → see purple "Connect Stripe" banner → click → Settings page → click "Connect Stripe" → complete Stripe hosted onboarding → redirected back with green "Connected" badge.

### WOW 2: Paid Event Checkout
**Demo**: Create a paid event (£5.00) → open event as member/guest → click "Buy Ticket" → Stripe Checkout opens → pay with test card `4242 4242 4242 4242` → redirected to payment success page with confetti → RSVP created with `payment_status: paid`.

### WOW 3: QR Check-In Scanner
**Demo**: Go to `/g/[slug]/admin/events/[id]/checkin` → tap camera → scan a guest's QR code from their confirmation email → hear success beep → see attendee name appear → view real-time attendance list with manual check-in/undo buttons.

### WOW 4: Digital Wallet & CREW CARD
**Demo**: Sign in → tap "Card" in bottom nav → see animated CREW CARD with member tier (New Member / Regular / Dedicated based on events attended) → QR code for check-in → upcoming RSVP'd events listed below.

### WOW 5: Branded Confirmation Emails
**Demo**: RSVP to an event (free or paid) → receive branded email with event details, Google Maps link, QR code for check-in, and payment receipt (if paid). Guests also see "Join ROVA Crew" signup CTA.

### WOW 6: Global Navigation
**Demo**: Sign in → bottom nav bar with Home, Discover, Card, Profile tabs → works on all app pages → hides on admin pages and event detail pages → Profile page shows stats + sign out.

### WOW 7: Free Event RSVP Emails
**Demo**: Sign in → open a free event → RSVP "Going" → receive branded confirmation email with QR code, event details, and Google Maps link. Previously only guests and paid RSVPs got emails.

### WOW 8: Event Editing
**Demo**: Go to admin dashboard → see "Edit" next to any upcoming event → click → pre-filled event form → change title/time/location → save → changes reflected immediately. Existing cover images are preserved.

### WOW 9: Contact Organiser
**Demo**: Open any group page → see "Organised by" card with admin name + avatar → click "Contact organiser" → fill in message → admin receives email with sender's reply-to address. Admin email is never exposed to the client.

### WOW 10: Enhanced Payment Receipts
**Demo**: Pay for an event → confirmation email now includes payment reference (last 8 chars of payment intent) + green "Payment Receipt" box with "View full receipt" link to Stripe's hosted receipt page.

### WOW 11: Group Monthly Subscription
**Demo**: Admin: Settings → enable membership fee → set £5.00/month → save. Public group page: "Join — £5.00/month →" button → Stripe subscription checkout → complete payment → member added to group with recurring billing.

---

## 5. What Works in Production (Netlify)

- Magic link auth (implicit flow — fixed PKCE cookie issues)
- User onboarding + profile creation
- Group creation with logo upload
- Public group profiles + join flow
- Admin dashboard with member stats + event list
- Event creation (free + paid with Stripe)
- Stripe Connect onboarding for group admins
- Paid event checkout via Stripe
- RSVP flow (members + guests)
- QR check-in scanner for admins
- Confirmation emails with QR codes + payment receipts
- Digital wallet with CREW CARD + tier
- Profile page with stats
- Bottom navigation bar
- Discovery/search page
- Invite modal with QR code + WhatsApp share link
- Free member RSVP confirmation emails with QR codes
- Event editing for admins
- Organiser display on group + event pages
- Contact organiser email relay
- Enhanced payment receipts with Stripe receipt links
- Group monthly membership subscription via Stripe

---

## 6. What's Still Placeholder or Not Yet Built

| Feature | Status | Tagged |
|---|---|---|
| Shared cost splitting | UI exists, no payment logic | — |
| Event cancellation | Not built (editing is done) | — |
| Recurring events | Checkbox disabled | "Coming soon" |
| Announcements | Nav item disabled | — |
| Members list (admin) | Nav item disabled | — |
| Hall of Fame | Nav item disabled | — |
| Monthly revenue analytics | Stat card shows £0.00 | "Unlocks Week 4" |
| WhatsApp migration tool | Button disabled | "Week 6" |
| Get Your Flyer | Quick action disabled | "Week 6" |
| Profile editing | Read-only | — |
| Push notifications | Not built | — |
| Crew scoring engine | Tier is event-count only | — |
| Member streaks | Shows on home, no tracking | — |
| Onboarding step 3 groups | Hardcoded `PLACEHOLDER_GROUPS` | — |
| Subscription webhook lifecycle | Phase C: handle `invoice.paid`, `customer.subscription.updated/deleted` | Week 4 |
| Member subscription management | Phase D: view/cancel subscription from profile or group page | Week 4 |

---

## 7. Dev Server Command

```bash
cd /Users/stevepurdhamair/rova-crew && npm run dev
```

Runs at http://localhost:3000. For Stripe webhook testing locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## 8. Known Issues & Watch-Outs

### Auth
- Auth uses **implicit flow** (`flowType: 'implicit'` in `lib/supabase/client.ts`). If Supabase changes defaults, this may need updating.
- The callback page checks for an existing session after PKCE exchange failure — this is a fallback, not a root cause fix.

### Stripe
- Stripe Connect uses **Express accounts** with `country: 'GB'`. If expanding internationally, account creation needs updating.
- Platform fee is **5% with 30p minimum**, calculated in `app/api/stripe/checkout/route.ts`.
- After Stripe onboarding, the settings page refreshes status from Stripe API on `?stripe=complete`. The `account.updated` webhook also syncs status but may be delayed.
- `STRIPE_WEBHOOK_SECRET` must match the endpoint configured in Stripe Dashboard → Developers → Webhooks.

### Database
- `guest_rsvps.qr_token` has a DB DEFAULT of `gen_random_uuid()` — ensure this column exists with the default before testing guest check-in.
- `payments.status` transitions: `pending` → `paid` (on checkout.session.completed) or `failed` (on payment_intent.payment_failed).

### Navigation
- Bottom nav shows on: `/home`, `/discover`, `/wallet`, `/profile`, `/g/*` (except `/g/*/admin/*`).
- Event detail pages and admin pages intentionally hide the bottom nav.

### Subscriptions
- Subscription checkout creates a Stripe Customer on the **connected account** (not the platform). Customer lookup is by email.
- Subscription webhook lifecycle (Phase C) is **not yet built** — `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted` events are not handled. After the initial checkout, the member is added to the group but subscription status changes (cancellation, failed renewal) won't auto-update membership.
- The `group_subscriptions` table and group columns require a **manual SQL migration** — see section 9 below.
- `application_fee_percent: 5` is set on subscription creation, matching event payments.

### Contact Organiser
- Admin email is fetched server-side and never exposed to the client.
- Emails are sent via Resend with `replyTo` set to the sender's email so the admin can reply directly.

### Event Editing
- Cover image: if admin doesn't select a new image, the existing `cover_url` is preserved. Only uploads on new file selection.
- Payment type is not locked in edit mode yet — changing payment type on an event with existing paid RSVPs could cause issues. Consider locking this in Week 4.

### Commits This Week (12)
```
2d7cf50 feat: Week 4 — admin UX, emails, contact & group subscriptions
9237a8f fix: check for existing session after PKCE exchange failure
b9562d9 fix: switch auth to implicit flow to avoid PKCE cookie issues
6248b07 fix: move auth callback to client-side for reliable PKCE exchange
032bb01 fix: refresh Stripe account status on return from onboarding
6056245 fix: return actual error message from Stripe connect route for debugging
d97ba4e feat: Stripe Connect onboarding flow for group admins
566da36 fix: Stripe guest payment flow — metadata, webhook, and schema bugs
3e85faf fix: show bottom nav on group pages, hide on admin pages
ee35310 feat: add global bottom navigation bar and profile page
e0f5ef4 fix: use request/response cookie pattern in auth callback for Netlify
3a5f92f feat: Week 3 — Stripe payments, guest RSVP rebuild, wallet, check-in scanner, email templates
```

---

## Tech Stack Reference

- **Framework**: Next.js 16.1.6 (App Router, Turbopack)
- **Database**: Supabase (Postgres + Auth + Storage + RLS)
- **Payments**: Stripe (Connect Express + Checkout + Webhooks)
- **Email**: React Email + Resend
- **QR**: `qrcode` (generation) + `jsqr` (scanning)
- **Hosting**: Netlify (auto-deploy from `main` branch)
- **Brand**: Teal `#0D7377`, Gold `#C9982A`, Font: Geist

---

## 9. SQL Migration — Group Subscriptions

Run this in the Supabase SQL Editor before testing membership subscriptions:

```sql
-- Add membership fee columns to groups
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS membership_fee_pence integer,
  ADD COLUMN IF NOT EXISTS membership_fee_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_subscription_price_id text;

-- Create group_subscriptions table
CREATE TABLE IF NOT EXISTS public.group_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id                uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id                 uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id  text UNIQUE NOT NULL,
  stripe_customer_id      text NOT NULL,
  status                  text DEFAULT 'active'
    CHECK (status IN ('active','cancelled','past_due','incomplete','expired')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.group_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can see their own subscriptions
CREATE POLICY "subscriptions_select_own" ON public.group_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Group admins can see all subscriptions for their group
CREATE POLICY "subscriptions_select_admin" ON public.group_subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_subscriptions.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('super_admin','co_admin')
        AND gm.status = 'approved'
    )
  );
```
