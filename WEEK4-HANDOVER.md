# ROVA Crew — Week 4 Handover Summary

**Date**: 25 February 2026
**Live URL**: https://rova-crew.netlify.app
**Repo**: https://github.com/Stevehaweye/rova-crew
**Stack**: Next.js 16.1.6 / Supabase / Stripe / Resend / Tailwind / Netlify
**Node**: v25.6.1 | **npm**: 11.9.0

---

## 1. All Files Created or Modified This Week

Week 4 spans commits `2d7cf50` through `761c301` — **69 files changed, +11,682 lines**.

### New Files Created (48)

| File | Purpose |
|------|---------|
| **API Routes — Chat (7)** | |
| `app/api/chat/route.ts` | Post message to any channel (group/event/DM), @mention push notifications |
| `app/api/chat/[id]/route.ts` | GET/PATCH/DELETE a message (edit, soft-delete) |
| `app/api/chat/[id]/reactions/route.ts` | POST/DELETE emoji reactions on messages |
| `app/api/chat/[id]/pin/route.ts` | Pin/unpin messages (admin only) |
| `app/api/chat/poll/route.ts` | Polling endpoint — returns new messages + reactions via service client (bypasses RLS) |
| `app/api/chat/read/route.ts` | Update channel_members.last_read_at cursor |
| `app/api/events/[id]/chat/route.ts` | Fetch event chat messages with profiles + reactions |
| **API Routes — Announcements (4)** | |
| `app/api/announcements/route.ts` | Create announcement (admin), optional push to group |
| `app/api/announcements/[id]/route.ts` | GET/DELETE single announcement |
| `app/api/announcements/[id]/reactions/route.ts` | Emoji reactions on announcements |
| `app/api/announcements/[id]/pin/route.ts` | Pin/unpin announcement |
| **API Routes — DMs (2)** | |
| `app/api/messages/dm/route.ts` | Send DM message, push notification to recipient |
| `app/api/messages/dm/start/route.ts` | Start DM thread — find or create DM channel |
| **API Routes — Push & Notifications (3)** | |
| `app/api/push/subscribe/route.ts` | Save browser push subscription to DB |
| `app/api/push/unsubscribe/route.ts` | Remove push subscription |
| `app/api/notifications/preferences/route.ts` | GET/PUT per-category notification preferences |
| **API Routes — Admin (4)** | |
| `app/api/groups/[slug]/blast/route.ts` | Message blast to all group members |
| `app/api/groups/[slug]/members/[userId]/mute/route.ts` | Mute/unmute member (admin) |
| `app/api/groups/[slug]/settings/route.ts` | Update group settings |
| `app/api/groups/[slug]/membership-fee/route.ts` | Set membership fee + create Stripe price |
| **API Routes — Other (3)** | |
| `app/api/contact-organiser/route.ts` | Email event organiser via contact form |
| `app/api/cron/send-reminders/route.ts` | Cron endpoint — processes timed event reminders |
| `app/api/stripe/subscription-checkout/route.ts` | Group membership fee Stripe checkout |
| **Pages (9)** | |
| `app/g/[slug]/chat/page.tsx` | Group chat page — fetches channel, messages, members |
| `app/g/[slug]/announcements/page.tsx` | Announcements feed page |
| `app/g/[slug]/admin/announcements/page.tsx` | Admin announcements composer page |
| `app/g/[slug]/admin/blast/page.tsx` | Admin message blast page |
| `app/g/[slug]/admin/events/[id]/edit/page.tsx` | Event editing page |
| `app/messages/page.tsx` | DM inbox page |
| `app/messages/[channelId]/page.tsx` | Individual DM thread page |
| `app/settings/notifications/page.tsx` | Notification preferences server component |
| `app/settings/notifications/notifications-client.tsx` | Notification preferences UI (toggles + push status) |
| **Components (10)** | |
| `components/GroupChat.tsx` | 1,428 lines — real-time group chat with reactions, mentions, typing, polling |
| `components/EventChatNew.tsx` | 1,110 lines — event chat with phase banners, archive mode |
| `components/DMChat.tsx` | 995 lines — direct messaging UI |
| `components/AnnouncementsFeed.tsx` | 542 lines — announcements display with reactions |
| `components/AnnouncementsAdmin.tsx` | 219 lines — admin announcement composer |
| `components/BlastComposer.tsx` | 197 lines — broadcast message composer |
| `components/ContactOrganiserModal.tsx` | 182 lines — contact organiser form modal |
| `components/ContactOrganiserButton.tsx` | 43 lines — CTA button for contact modal |
| `components/MessageMemberButton.tsx` | 64 lines — quick DM button on profiles |
| `components/PushPermissionBanner.tsx` | 77 lines — push notification permission prompt |
| **Lib (4)** | |
| `lib/push-sender.ts` | 202 lines — `sendPushToUser()` + `sendPushToGroup()` with preference checks |
| `lib/reminder-sender.ts` | 283 lines — 5 reminder types (7d, 48h RSVPd, 48h non-RSVPd, 2h, post-event) |
| `lib/rsvp-milestones.ts` | 94 lines — milestone celebrations (5, 10, 15... going) |
| `lib/email.ts` | 271 lines — `sendRsvpConfirmationEmail()`, `sendReminderEmail()`, `sendContactOrganiserEmail()` |
| **Other (3)** | |
| `hooks/usePushNotifications.ts` | 129 lines — subscribe/unsubscribe/permission state hook |
| `public/sw.js` | 47 lines — service worker for push notification display |
| `app/messages/dm-inbox.tsx` | 166 lines — DM conversation list component |

### Files Modified (21)

| File | What Changed |
|------|-------------|
| `app/events/[id]/page.tsx` | +223 lines — added event chat data fetching, switched ALL data queries to service client (RLS bypass) |
| `app/events/[id]/event-page-client.tsx` | +359 lines — RSVP face stack, social snowball animations, event chat tab, contact organiser |
| `app/api/events/[id]/rsvp/route.ts` | Complete rewrite — waitlist logic, auto-channel-join, milestone checks, confirmation emails, waitlist promotion, switched to service client |
| `app/api/stripe/webhook/route.ts` | +21 lines — additional webhook handling |
| `app/g/[slug]/page.tsx` | +99 lines — announcements link, chat link, membership fee join flow |
| `app/g/[slug]/join-button.tsx` | +43 lines — subscription checkout for paid groups |
| `app/g/[slug]/admin/admin-shell.tsx` | +17 lines — announcements & blast nav items, disabled "Members" and "Hall of Fame" (tagged "Soon") |
| `app/g/[slug]/admin/settings/page.tsx` | +13 lines — refresh Stripe status on return |
| `app/g/[slug]/admin/settings/settings-client.tsx` | +199 lines — membership fee config, Stripe Connect states |
| `app/g/[slug]/admin/events/new/event-form.tsx` | +154 lines — shared cost fields, recurring events checkbox (disabled) |
| `app/g/[slug]/admin/events/page.tsx` | +8 lines — edit event link |
| `app/home/page.tsx` | +2 lines — push permission banner |
| `app/home/user-menu.tsx` | +11 lines — "Notification settings" link |
| `app/profile/profile-client.tsx` | +15 lines — "Notification settings" link with bell icon |
| `app/emails/rsvp-confirmation.tsx` | +38 lines — React Email template updates |
| `components/BottomNav.tsx` | +73 lines — messages tab with unread badge |
| `app/g/[slug]/admin/announcements/page.tsx` | New admin page |
| `.env.example` | +1 line — added `CRON_SECRET` |
| `package.json` | +4 deps — `web-push`, `@types/web-push`, `resend` bump |
| `package-lock.json` | Lock file updates |
| `WEEK3-HANDOVER.md` | New handover doc (394 lines) |

---

## 2. All New Database Tables and Columns

### New Tables (created via SQL in Supabase dashboard — no migration file)

**`channels`**
```
id           uuid PK
group_id     uuid → groups(id)
event_id     uuid → events(id) (nullable)
type         text ('group_chat' | 'event_chat' | 'dm' | 'announcements')
name         text
created_at   timestamptz
```

**`channel_members`**
```
channel_id   uuid → channels(id)
user_id      uuid → profiles(id)
last_read_at timestamptz
UNIQUE (channel_id, user_id)
```

**`messages`**
```
id            uuid PK
channel_id    uuid → channels(id)
sender_id     uuid → profiles(id)
content       text
content_type  text ('text' | 'image' | 'system')
image_url     text (nullable)
is_pinned     boolean
edited_at     timestamptz (nullable)
deleted_at    timestamptz (nullable)
deleted_by    uuid (nullable)
reply_to_id   uuid → messages(id) (nullable)
created_at    timestamptz
```

**`message_reactions`**
```
id           uuid PK
message_id   uuid → messages(id)
user_id      uuid → profiles(id)
emoji        text
created_at   timestamptz
UNIQUE (message_id, user_id, emoji)
```

**`push_subscriptions`**
```
id           uuid PK
user_id      uuid → profiles(id)
endpoint     text
p256dh       text
auth         text
user_agent   text (added mid-week — was missing initially)
created_at   timestamptz
UNIQUE (endpoint)
```

**`reminder_jobs`**
```
id              uuid PK
event_id        uuid → events(id)
reminder_type   text ('7day' | '48h_rsvpd' | '48h_not_rsvpd' | '2h' | 'post_event')
scheduled_for   timestamptz
sent_at         timestamptz (nullable)
recipient_count integer (nullable)
```

**`user_notification_preferences`**
```
id               uuid PK
user_id          uuid → profiles(id) UNIQUE
event_reminders  boolean DEFAULT true
waitlist_updates boolean DEFAULT true
new_events       boolean DEFAULT true
direct_messages  boolean DEFAULT true
mentions         boolean DEFAULT true
group_chat       boolean DEFAULT true
event_chat       boolean DEFAULT true
announcements    boolean DEFAULT true
rsvp_milestones  boolean DEFAULT true
created_at       timestamptz
updated_at       timestamptz
```

**`message_blasts`**
```
id           uuid PK
group_id     uuid → groups(id)
sender_id    uuid → profiles(id)
content      text
created_at   timestamptz
```

### Columns Added to Existing Tables

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `events` | `allow_guest_rsvp` | boolean DEFAULT true | Toggle guest RSVP on/off |
| `events` | `total_cost` | numeric | For shared-cost events |
| `events` | `min_participants` | integer | For shared-cost events |
| `events` | `total_cost_pence` | integer | Pence version of total_cost |
| `rsvps` | `status` | text | Added `'waitlisted'` as valid value |
| `group_members` | `muted_until` | timestamptz | Admin mute expiry |
| `push_subscriptions` | `user_agent` | text | Added mid-week (was missing) |

---

## 3. All New Environment Variables Required

| Variable | Where Set | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Netlify + `.env.local` | Browser push subscription (MUST be set at build time) |
| `VAPID_PRIVATE_KEY` | Netlify + `.env.local` | Server-side push signing |
| `VAPID_SUBJECT` | Netlify + `.env.local` | mailto: identifier (currently `mailto:steve@purdham.com`) |
| `CRON_SECRET` | Netlify + `.env.local` + `.env.example` | Bearer token for `/api/cron/send-reminders` |

**Full env var list (all weeks combined):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://rova-crew.netlify.app
RESEND_API_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=     ← Week 4
VAPID_PRIVATE_KEY=                ← Week 4
VAPID_SUBJECT=mailto:steve@purdham.com  ← Week 4
CRON_SECRET=                      ← Week 4
```

**Critical**: `NEXT_PUBLIC_*` vars are inlined at build time. If you add/change them, you MUST redeploy on Netlify.

---

## 4. Edge Functions and Triggers

### Supabase Edge Functions
None. All server logic runs as Next.js API routes on Netlify.

### Database Triggers (from `001_initial_schema.sql`)

| Trigger | Table | Event | Function |
|---------|-------|-------|----------|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` — auto-creates `profiles` row |
| `profiles_updated_at` | `profiles` | BEFORE UPDATE | `handle_updated_at()` — sets `updated_at = now()` |
| `groups_updated_at` | `groups` | BEFORE UPDATE | `handle_updated_at()` — sets `updated_at = now()` |

### Cron Job

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/cron/send-reminders` | GET or POST | `Authorization: Bearer {CRON_SECRET}` | Processes `reminder_jobs` table — sends 7d, 48h, 2h, post-event push + email reminders |

**Not yet wired to an external scheduler.** Needs a cron service (Netlify scheduled functions, cron-job.org, or Supabase pg_cron) to call it periodically.

### Webhooks

| Endpoint | Source | Events Handled |
|----------|--------|----------------|
| `/api/stripe/webhook` | Stripe | `checkout.session.completed`, `payment_intent.payment_failed`, `account.updated` |

---

## 5. WOW Moments — Demo Status

### WOW 1: Guest RSVP (One-Tap Join) — COMPLETE
- Anonymous visitors see event page with full details
- "I'm Going" triggers guest RSVP form (name + email)
- For paid events: Stripe checkout → payment success page with confetti
- For free events: instant RSVP with confirmation email + QR code
- Face stack shows all attendees with animated entry

### WOW 2: Social Snowball RSVP — COMPLETE
- RSVP face stack shows avatars with count badges
- Milestone notifications at 5, 10, 15, 20, 25, 50+ going
- System message posted to event chat ("X people are going!")
- Push notification sent to non-RSVPd group members
- Waitlist system: auto-waitlist when capacity full, auto-promote when spot opens
- Promoted user gets push notification + email

### WOW 5: Smart Event Reminders — COMPLETE (infrastructure built, cron not scheduled)
- 5 reminder types: 7-day, 48h (RSVPd), 48h (non-RSVPd), 2-hour, post-event
- Push notifications + email for each type
- Respects per-user notification preferences
- Fire-and-forget with `Promise.allSettled`
- **Needs**: External cron service to call `/api/cron/send-reminders` on schedule

---

## 6. What Works in Production on Netlify

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (magic link / Google) | Working | Implicit flow (not PKCE) due to Netlify cookie issues |
| Group creation & public profile | Working | |
| Admin dashboard | Working | Events, settings, announcements, blast |
| Event creation (free/fixed price) | Working | |
| Event RSVP (going/maybe/not going) | Working | Uses service client to bypass RLS |
| RSVP face stack | Working | Fixed this session — was showing only 1 circle |
| Guest RSVP (free + paid) | Working | |
| Stripe payments (checkout + webhook) | Working | 5% platform fee, receipt emails |
| Stripe Connect (admin onboarding) | Working | UK only |
| QR check-in scanner | Working | |
| Group chat (real-time messaging) | Working | Polling-based (3s interval), optimistic sends |
| Event chat | Working | Phase banners, archive after 7 days |
| DMs | Working | Inbox + threads |
| Announcements | Working | Admin compose, reactions |
| Message blast | Working | Sends to all group members |
| Contact organiser | Working | Email relay via Resend |
| Crew Card / Wallet | Working | QR code, tier display, upcoming events |
| Bottom navigation | Working | 4 tabs + messages with unread badge |
| Discovery page | Working | Public group listing |
| Notification preferences page | Working | 9 per-category toggles |
| Push notification subscription | Working | After VAPID keys added to Netlify |
| RSVP confirmation emails | Working | QR code, maps link, branded template |
| Waitlist auto-promotion | Working | Push + email on promotion |

---

## 7. What Is Still Placeholder or Not Yet Built

### Placeholders in UI

| Item | Location | Status |
|------|----------|--------|
| Onboarding Step 3 groups | `app/onboarding/page.tsx:36-61` | Hardcoded 3 mock groups instead of real discovery |
| Hall of Fame | `app/g/[slug]/page.tsx:475-514` | Shows "Real stats unlock in Week 5" |
| Monthly Revenue card | `app/g/[slug]/admin/admin-shell.tsx:852` | Shows "£0.00 — Unlocks Week 4" |
| Members list (admin) | Admin nav | Disabled, tagged "Soon" |
| WhatsApp migration | Admin quick actions | Disabled, tagged "Week 6" |
| Get Your Flyer | Admin quick actions | Disabled, tagged "Week 6" |
| Recurring events | Event creation form | Checkbox visible but disabled, "Coming soon" |

### Not Yet Built

| Feature | Detail |
|---------|--------|
| Shared cost splitting | UI fields exist but no payment calculation or split logic |
| Subscription webhook lifecycle | `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted` not handled |
| Member subscription management | No UI for members to view/cancel their group subscription |
| Payment type locking on edit | Changing payment type on event with existing paid RSVPs is allowed (dangerous) |
| Admin members list | No page to view/manage group members |
| Crew Score calculation | `member_stats` table exists but no scoring engine |
| Map embedding | Location is text-only, no Google Maps embed |
| Cron scheduler | `/api/cron/send-reminders` endpoint exists but no external trigger configured |
| Profile editing | Profile page is read-only |
| Supabase Realtime | Not working due to RLS — all real-time sync is via polling |

---

## 8. Dev Server Restart Sequence

```bash
cd /Users/stevepurdhamair/rova-crew
git pull                    # Get latest from GitHub
npm install                 # In case deps changed
npm run dev                 # Starts Next.js on http://localhost:3000
```

**If you need to verify a production build:**
```bash
npx next build              # TypeScript + build check (~60s)
```

**Environment**: Ensure `.env.local` exists with all 12 env vars listed in Section 3.

---

## 9. Known Issues and Things to Watch in Week 5

### Critical — Emoji Reactions Not Persisting

**Symptom**: Reactions show optimistically in the UI but don't persist to the database. After refresh, they disappear. The `message_reactions` table remains empty.

**What we know**:
- API route (`/api/chat/[id]/reactions/route.ts`) returns HTTP 200 with `{ success: true }`
- Uses `createServiceClient()` which should bypass RLS
- Debug logging added (check Netlify function logs for `[chat/reactions]` entries)
- Table has RLS policies: `reactions_insert`, `reactions_select`, `reactions_delete_own`

**Likely cause**: The service client should bypass RLS, but the insert may be silently failing. Check Netlify function logs. If still failing, try:
1. Check if `SUPABASE_SERVICE_ROLE_KEY` is correctly set on Netlify
2. Try disabling RLS on `message_reactions` temporarily to test
3. Check for FK constraint — `message_id` must reference a real `messages.id` (not an optimistic ID)

### Important — RLS Pervasive Issue

**Pattern**: Throughout the codebase, the authenticated Supabase client (`createClient()` from `@/lib/supabase/server`) is blocked by Row Level Security policies on many tables. Queries silently return empty results instead of errors.

**Solution applied**: API routes and server components now use `createServiceClient()` (service role key) for data reads/writes. This was applied to:
- Event page data queries (page.tsx)
- RSVP upsert (rsvp/route.ts)
- Chat polling (poll/route.ts)
- All chat API routes

**Watch out**: Any new data queries should use the service client for reliability. The auth client (`createClient()`) is only reliable for `supabase.auth.getUser()`.

### Important — Supabase Realtime Not Working

Supabase Realtime `postgres_changes` events are not delivered to clients because RLS blocks the SELECT needed for change detection. All real-time features use polling instead:
- Group chat: 3-second polling via `/api/chat/poll`
- Event chat: Same pattern
- DMs: Same pattern

**Impact**: Slightly higher latency (up to 3s) and more API calls. Consider enabling Realtime with proper RLS policies or using Supabase Realtime with the service role key via a server-sent events endpoint.

### Minor — Push Notifications

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must be set at **build time** on Netlify (it's inlined into client JS)
- `navigator.serviceWorker.getRegistration('/sw.js')` is used instead of `.ready` (which hangs if no SW registered)
- Push subscription requires `user_agent` column in `push_subscriptions` table (added mid-week)

### Minor — Auth Flow

Using implicit flow (`flowType: 'implicit'`) instead of PKCE due to Netlify cookie handling issues. Works reliably but is less secure than PKCE. If migrating off Netlify, switch back to PKCE.

### SQL Migration Not Run

The `user_notification_preferences` table creation SQL has not been run yet. Run this in the Supabase SQL editor:

```sql
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  event_reminders boolean     DEFAULT true,
  waitlist_updates boolean    DEFAULT true,
  new_events      boolean     DEFAULT true,
  direct_messages boolean     DEFAULT true,
  mentions        boolean     DEFAULT true,
  group_chat      boolean     DEFAULT true,
  event_chat      boolean     DEFAULT true,
  announcements   boolean     DEFAULT true,
  rsvp_milestones boolean     DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);
```

### File Size Watch

- `components/GroupChat.tsx` is 1,428 lines — consider splitting if it grows further
- `components/EventChatNew.tsx` is 1,110 lines — shares ~70% logic with GroupChat
- Legacy `components/EventChat.tsx` (425 lines) still exists — can be removed once EventChatNew is confirmed stable

---

## Quick Reference — Brand

- **Teal**: `#0D7377` (primary)
- **Gold**: `#C9982A` (accent)
- **App name**: ROVACREW (one word, all caps in logo)
- **Platform fee**: 5% (minimum 30p) on paid events
- **Currency**: GBP (pence-based internally)
- **Hosting**: Netlify (NOT Vercel)
- **Domain**: rova-crew.netlify.app (custom domain TBD)
