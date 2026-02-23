# ROVA Crew — Week 2 Handover Summary

## 1. All New Files Created in Week 2

### App Pages & Routes
| File | Purpose |
|---|---|
| `app/page.tsx` | **Modified** — Now serves as the public discovery page for anonymous users; redirects logged-in users to `/home` |
| `app/discovery-client.tsx` | Client component: hero, search/filter bar, groups grid, how it works, footer. Accepts `isLoggedIn` prop |
| `app/discover/page.tsx` | Dedicated `/discover` route that works for both logged-in and anonymous users |
| `app/events/[id]/page.tsx` | Server component: fetches event + group + RSVPs + messages, works for anonymous and authenticated |
| `app/events/[id]/event-page-client.tsx` | Full event page: hero, info bar, RSVP card (member + guest), Social Snowball, chat, share button. Supabase Realtime subscriptions |
| `app/g/[slug]/admin/events/page.tsx` | Admin events list with upcoming/past/cancelled tabs, RSVP counts per event |
| `app/g/[slug]/admin/events/new/page.tsx` | Server wrapper for event creation form (auth + admin check) |
| `app/g/[slug]/admin/events/new/event-form.tsx` | Full event creation form: title, type (free/paid/shared cost), date picker, time, location, description, cover upload, capacity, live preview |
| `app/api/events/[id]/guest-rsvp/route.ts` | API endpoint: handles guest RSVP (name + email), deduplication, sends confirmation email with QR code |
| `components/EventChat.tsx` | Standalone event chat component: locked/unlocked states, Supabase Realtime, WhatsApp-lite styling, 500 char limit |

### Lib / Utilities
| File | Purpose |
|---|---|
| `lib/email.ts` | Email service using Resend: branded HTML template, `sendGuestRsvpConfirmation()` with inline QR code |
| `lib/supabase/service.ts` | Service role Supabase client (bypasses RLS) for server-side operations like guest RSVP insert |

### Modified Files
| File | Changes |
|---|---|
| `app/layout.tsx` | Updated metadata to ROVA Crew branding; added `overflow-x-hidden` for mobile |
| `app/globals.css` | Added `scrollbar-hide` utility for horizontal pill scrollers |
| `app/home/page.tsx` | Added "Coming up for you" section with real events + RSVP status; fixed `href="#"` links to `/discover` |
| `app/g/[slug]/page.tsx` | Now fetches real upcoming events with RSVP counts (was placeholder) |
| `app/g/[slug]/admin/admin-shell.tsx` | Sidebar nav items now use `<Link>` with proper routes; mobile sidebar closes on navigation; added `NAV_ROUTES` |
| `app/g/[slug]/admin/page.tsx` | Fetches upcoming events with RSVP counts for dashboard display |
| `package.json` | Added `date-fns`, `react-day-picker`, `resend` |

---

## 2. New Supabase Tables Added in Week 2

> **These tables were created via SQL in the Supabase SQL Editor** (no migration file). The SQL is in the plan file at `.claude/plans/curious-herding-riddle.md`.

### `events`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `group_id` | uuid | FK to groups |
| `title` | text | |
| `description` | text | Nullable |
| `starts_at` | timestamptz | |
| `ends_at` | timestamptz | |
| `location` | text | Nullable |
| `maps_url` | text | Nullable |
| `cover_url` | text | Nullable, stored in `event-covers` bucket |
| `max_capacity` | integer | Nullable (unlimited if null) |
| `event_type` | text | `free`, `paid`, `shared_cost` |
| `price_amount` | numeric | Nullable |
| `created_by` | uuid | FK to auth.users |
| `created_at` | timestamptz | |

### `rsvps` (member RSVPs)
| Field | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `event_id` | uuid | FK to events |
| `user_id` | uuid | FK to auth.users |
| `status` | text | `going`, `maybe`, `not_going` |
| `created_at` | timestamptz | |
| Unique constraint | | `(event_id, user_id)` — one RSVP per user per event |

### `guest_rsvps` (non-account RSVPs — WOW 1)
| Field | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `event_id` | uuid | FK to events |
| `name` | text | |
| `email` | text | |
| `status` | text | `going`, `maybe`, `cancelled` |
| `created_at` | timestamptz | |
| Unique constraint | | `(event_id, email)` — one guest RSVP per email per event |

### `event_messages` (event chat)
| Field | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `event_id` | uuid | FK to events |
| `user_id` | uuid | FK to profiles |
| `body` | text | Max 500 chars |
| `created_at` | timestamptz | |

### Storage Buckets Added
| Bucket | Access | Purpose |
|---|---|---|
| `event-covers` | Public | Event cover images |

### RLS Policies Updated / Added
- **`events`**: SELECT open to `anon` + `authenticated`; INSERT for authenticated users
- **`rsvps`**: SELECT open to `anon` + `authenticated`; INSERT/UPDATE for authenticated users (own rows); upsert on `(event_id, user_id)`
- **`guest_rsvps`**: SELECT open to `anon` + `authenticated`; INSERT open to `anon` + `authenticated`; DELETE for group admins
- **`event_messages`**: SELECT open to `anon` + `authenticated`; INSERT for authenticated users (own rows); DELETE for own messages + group admins
- **`profiles`**: SELECT updated to include `anon` (was `authenticated` only) — needed for Who's Going on public event pages

### Supabase Realtime
Enabled on these tables (via `ALTER PUBLICATION supabase_realtime ADD TABLE`):
- `rsvps`
- `guest_rsvps`
- `event_messages`

### SQL to Re-Run (safe, all idempotent)
If any RLS policies are missing, run this in the Supabase SQL Editor:
```sql
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rsvps_select" ON public.rsvps;
CREATE POLICY "rsvps_select" ON public.rsvps
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "guest_rsvps_select" ON public.guest_rsvps;
CREATE POLICY "guest_rsvps_select" ON public.guest_rsvps
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "event_messages_select" ON public.event_messages;
CREATE POLICY "event_messages_select" ON public.event_messages
  FOR SELECT TO anon, authenticated USING (true);
```

---

## 3. New Environment Variables Added

| Key | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key for sending transactional emails (guest RSVP confirmation) |

All existing Week 1 env vars remain unchanged:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

---

## 4. WOW Moments Now Live

### WOW 1: Guest RSVP (No Account Required)
**What it is**: Anyone can RSVP to an event with just their name and email — no account creation needed. They get a branded confirmation email with a QR code for check-in.

**How to demo**:
1. Open an event page in incognito: `{APP_URL}/events/{event-id}`
2. Enter a name and email in the guest RSVP form
3. Click "Count me in"
4. See the optimistic "You're on the list!" confirmation
5. Check the email inbox — branded confirmation with event details and inline QR code
6. Open a second browser tab on the same event — the guest appears in "Who's Coming" in real-time

**Tech**: `POST /api/events/[id]/guest-rsvp` → validates → inserts into `guest_rsvps` via service role client → generates QR code as data URI → sends via Resend → returns to client for optimistic update.

### WOW 2: Social Snowball (Real-Time RSVP Feed)
**What it is**: The "Who's Coming" section on every event page updates in real-time. When someone RSVPs (member or guest), their avatar/name appears instantly in every open browser — creating social proof that drives more RSVPs.

**How to demo**:
1. Open an event page in two browser tabs (or one on phone, one on desktop)
2. In Tab A, RSVP as "Going"
3. Watch Tab B — the avatar bubble and name appear instantly without refresh
4. In Tab B (incognito), submit a guest RSVP
5. Watch Tab A — the guest appears with a "Guest" badge in real-time
6. The going count updates live in the info bar

**Tech**: Supabase Realtime `postgres_changes` subscriptions on `rsvps` and `guest_rsvps` tables, filtered by `event_id`. New RSVPs are pushed to all connected clients. Member RSVPs trigger a profile fetch; guest RSVPs use the name directly.

---

## 5. Live Netlify URL

**https://rova-crew.netlify.app**

GitHub repo: `https://github.com/Stevehaweye/rova-crew`
Branch: `main` (auto-deploys on push)

---

## 6. What Works Right Now

### New in Week 2
- **Public discovery page** at `/` (anonymous) and `/discover` (logged-in) — search by name, filter by category, group cards with member counts and next event dates
- **Event creation form** at `/g/[slug]/admin/events/new` — title, date/time picker, location, description, cover image upload, capacity limit, event type selector (free/paid/shared cost), live preview
- **Admin events list** at `/g/[slug]/admin/events` — upcoming/past/cancelled tabs with RSVP counts
- **Public event page** at `/events/[id]` — works for anonymous and authenticated users
  - Hero section with cover image or group-colour gradient
  - Info bar: date/time, location, going count, capacity bar, FREE badge
  - Member RSVP: "I'm going" / "Maybe" / "Can't make it" buttons with optimistic update
  - Guest RSVP: name + email form (no account needed) with email confirmation
  - Social Snowball: real-time Who's Coming with avatar bubbles, name list, going/maybe counts
  - Event chat: lazy-loaded, locked until RSVPed, WhatsApp-lite styling, Supabase Realtime
  - Share button: Web Share API on mobile, clipboard fallback on desktop
  - Responsive: single column on mobile with sticky bottom RSVP bar, sidebar layout on desktop
- **Confirmation emails** — branded HTML email with event details, location, and inline QR code
- **Home dashboard updates** — "Coming up for you" section shows real upcoming events with RSVP status
- **Admin sidebar navigation** — Events and Dashboard links now functional with proper routing
- **Mobile fixes** — no horizontal scrolling, scrollbar-hidden category pills, overflow containment
- **Auth guards** — "Create your community" routes through `/auth` for unauthenticated users

### Carried Forward from Week 1 (still working)
- Magic link auth, onboarding, group creation, public group profiles, join flow, admin dashboard, invite modal with QR + WhatsApp share

---

## 7. What Is Still Placeholder / Coming in Week 3+

| Feature | Status | Target Week |
|---|---|---|
| Stripe payment integration | Placeholder — paid/shared cost events save as free | Week 3 |
| Send Announcement | Disabled quick action in admin dashboard | Week 3 |
| Check-in system | QR codes generated but no scan/check-in flow | Week 3 |
| Attendance tracking | Tables exist (`member_stats.events_attended`) but no logic | Week 3 |
| Member streaks | Shows "0 weeks" on home — no tracking logic | Week 3-4 |
| Crew scores & tiers | `member_stats` table has fields but no scoring engine | Week 3-4 |
| Monthly Revenue card | Shows "£0.00 — Unlocks Week 4" in admin dashboard | Week 4 |
| Hall of Fame | Shows "Real stats unlock in Week 5" on group page | Week 5 |
| Profile editing | No `/profile` page yet | Week 3 |
| Notifications system | Not built | Week 4 |
| WhatsApp migration tool | Shows "Coming in Week 6" | Week 6 |
| Get Your Flyer | Disabled quick action — branded promo flyer download | Week 6 |
| Onboarding Step 3 groups | Still hardcoded `PLACEHOLDER_GROUPS` | Week 3 |
| Recurring events | Not supported — each event is one-off | Week 4 |
| Event editing/cancellation | Can create but not edit or cancel events | Week 3 |
| Map integration | Location is text-only; `maps_url` field exists but no embedded map | Week 4 |

---

## 8. Known Issues & Gotchas for Week 3

### Must Fix / Be Aware
- **RLS policies for anonymous access**: The `profiles`, `events`, `rsvps`, `guest_rsvps`, and `event_messages` tables all need `anon` in their SELECT policies. If the "Who's Coming" list appears empty for anonymous users, re-run the SQL in Section 2 above.
- **Supabase Realtime must be enabled**: The `rsvps`, `guest_rsvps`, and `event_messages` tables must be added to the `supabase_realtime` publication. Without this, the Social Snowball and Event Chat won't update in real-time. Run:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_rsvps;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_messages;
  ```
- **`event-covers` storage bucket**: Must be created in Supabase Storage dashboard with public access policy (same pattern as `group-logos`)
- **`RESEND_API_KEY`**: Must be set in Netlify environment variables for guest RSVP emails to send. The from address is `noreply@mypin.global`
- **Paid events are saved as free**: The event form UI allows selecting paid/shared cost and entering prices, but no Stripe integration exists yet. All events save as `event_type: 'free'` effectively
- **No event edit or delete**: Once created, events cannot be modified or cancelled through the UI
- **Admin shell is not a shared layout**: The admin sidebar only appears on the dashboard page (`/g/[slug]/admin`). The events list page (`/g/[slug]/admin/events`) and event creation page have their own separate nav bars. Consider converting to a shared `layout.tsx` in Week 3

### Dev Environment
- **`NEXT_PUBLIC_APP_URL`**: Must be `http://localhost:3000` for local dev, `https://rova-crew.netlify.app` for production. Magic link redirects and QR code URLs use this value
- **iPhone local testing**: Run `npm run dev -- -H 0.0.0.0`, then access via `http://{your-mac-ip}:3000` on the phone
- **Supabase email rate limits**: Free tier Resend has daily limits. Only use valid email addresses to avoid bounces

### Brand Constants (unchanged)
- Primary teal: `#0D7377`
- Gold accent: `#C9982A`
- Wordmark: `ROVA` (teal) + `CREW` (gold)
- Font: Geist (sans + mono)

### New Dependencies Added
- `date-fns` — date formatting throughout event pages
- `react-day-picker` — calendar date picker in event creation form
- `resend` — transactional email sending

### Tech Stack (unchanged)
- **Framework**: Next.js 14.2.35 (App Router)
- **Auth/DB/Storage/Realtime**: Supabase
- **Styling**: Tailwind CSS
- **Email**: Resend (`resend` npm + SMTP via `mypin.global`)
- **Hosting**: Netlify (auto-deploy from `main`)
- **QR Codes**: `qrcode` npm package

---

## 9. Command to Restart Dev Server

```bash
cd /Users/stevepurdhamair/rova-crew && npm run dev
```

App runs at `http://localhost:3000`.

For mobile testing on the same network:
```bash
cd /Users/stevepurdhamair/rova-crew && npm run dev -- -H 0.0.0.0
```
