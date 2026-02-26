# ROVA Crew — Week 7 Handover Summary

**Date:** 2026-02-26
**Branch:** main (all changes unstaged, not yet committed)
**Build status:** `npx tsc --noEmit` PASS | `npx next build` PASS

---

## 1. Files Created This Week

### API Routes
| File | Purpose |
|------|---------|
| `app/api/discover/search/route.ts` | Full-text search endpoint for public groups with category filter and sort options |
| `app/api/events/[id]/flyer/route.tsx` | Event flyer image generator (Stories/Square/Print formats) using `next/og` ImageResponse |
| `app/api/groups/[slug]/introductions/route.ts` | POST: create warm introduction between two members, award spirit points |
| `app/api/groups/[slug]/introductions/suggestions/route.ts` | GET: return mutual-connection and interest-based introduction suggestions |
| `app/api/groups/[slug]/invites/route.ts` | POST: create phone-number-based invites for a group |
| `app/api/groups/[slug]/invites/accept/route.ts` | POST: accept an invite token and join the group |
| `app/api/groups/[slug]/members/[userId]/nudge/route.ts` | POST: send nudge DM to inactive member with 14-day cooldown |
| `app/api/migration/draft-profile/route.ts` | POST: AI profile generator using Claude Sonnet — drafts tagline, description, category from group name |

### Pages
| File | Purpose |
|------|---------|
| `app/migrate/page.tsx` | Server wrapper for migration wizard with auth gate |
| `app/migrate/migrate-wizard.tsx` | 5-step WhatsApp-to-ROVA migration wizard with AI profile generation, colour picker, logo upload, confetti celebration |
| `app/g/[slug]/admin/members/page.tsx` | Server page: fetches all approved members with profiles, stats, last activity |
| `app/g/[slug]/admin/members/members-list-client.tsx` | Client: searchable/sortable member table with filter tabs (All/Active/At Risk/Inactive) |
| `app/g/[slug]/admin/members/[userId]/page.tsx` | Server page: individual member insights with RSVP history, badges, nudge cooldown |
| `app/g/[slug]/admin/members/[userId]/member-insights-client.tsx` | Client: member profile, attendance stats, badge gallery, event history, nudge modal |
| `app/g/[slug]/welcome/page.tsx` | Server page: warm introductions and next event for newly joined members |
| `app/g/[slug]/welcome/welcome-client.tsx` | Client: welcome flow with mutual connections, interest matches, next event card, confetti |

### Components
| File | Purpose |
|------|---------|
| `components/admin/IntroductionCard.tsx` | Admin dashboard widget showing warm introduction suggestions between members |
| `components/events/FlyerActions.tsx` | Flyer generator UI with format selector (Stories/Square/Print), download, and native share |

### Libraries
| File | Purpose |
|------|---------|
| `lib/dm-utils.ts` | `findOrCreateDmChannel()` helper for DM channel creation |
| `lib/phone-utils.ts` | Phone number parsing, normalisation, validation, WhatsApp deep links (UK default) |
| `lib/warm-introductions.ts` | Mutual-group and shared-interest connection algorithm (up to 3 mutual, 2 interest) |

---

## 2. Files Modified This Week

| File | What Changed |
|------|-------------|
| `app/api/events/[id]/checkin/route.ts` | Added fire-and-forget health score recalculation on check-in |
| `app/api/events/[id]/rsvp/route.ts` | Plus-one config enforcement (`plus_ones_allowed`, `max_plus_ones_per_member`, `plus_ones_count_toward_capacity`), `guest_invite` spirit points award |
| `app/api/groups/[slug]/settings/route.ts` | Added `location` and `watermark_photos` settings support |
| `app/api/messages/dm/start/route.ts` | DM channel initiation using `findOrCreateDmChannel` helper |
| `app/discover/page.tsx` | Passes `upcomingEvents` prop to DiscoveryClient, JSON-LD structured data |
| `app/discovery-client.tsx` | Added Upcoming Events section (next 6 public events), sort dropdown (Most active/Newest/Most members) |
| `app/events/[id]/event-page-client.tsx` | Integrated `FlyerActions` component, added email field alongside guest name in plus-one UI |
| `app/events/[id]/page.tsx` | Added Event JSON-LD schema with Offers (price, availability), plus-one data fetching |
| `app/g/[slug]/admin/admin-shell.tsx` | Enabled Members nav item, added At-Risk Members alert card, added IntroductionCard widget |
| `app/g/[slug]/admin/events/[id]/checkin/checkin-client.tsx` | QR code scanner with real-time check-in feedback, plus-ones grouping support |
| `app/g/[slug]/admin/events/[id]/checkin/page.tsx` | Aggregates member, guest, and plus-one attendees for QR scanning |
| `app/g/[slug]/admin/events/new/event-form.tsx` | Added "Guest Plus-Ones" section: allow toggle, max-per-member (1-5), count-toward-capacity toggle |
| `app/g/[slug]/admin/settings/page.tsx` | Added group location and photo watermarking toggle |
| `app/g/[slug]/admin/settings/settings-client.tsx` | Location field and watermark toggle UI with save handlers |
| `app/g/[slug]/join-button.tsx` | Redirects to `/g/[slug]/welcome` after successful join, invite token acceptance, guest conversion check |
| `app/g/[slug]/page.tsx` | Added SportsOrganization JSON-LD schema, group location display |
| `app/groups/new/page.tsx` | Migration wizard tab with phone number parsing and WhatsApp invite link flow |
| `app/page.tsx` | Added location field in group card data fetching |
| `components/DMChat.tsx` | Full DM implementation: typing indicators, reactions, replies, edit/delete, image uploads |
| `lib/spirit-points.ts` | Added `guest_invite` (5pts, cap 15/week) and `flyer_share` (5pts, cap 15/week) action types |
| `package.json` | Added `@anthropic-ai/sdk` ^0.78.0 |

---

## 3. New Database Tables & Columns

**Run these in Supabase SQL Editor before testing Week 7 features:**

### New Table: `nudges_sent`
```sql
CREATE TABLE nudges_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES auth.users(id),
  member_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('dm','email')),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_nudges_group ON nudges_sent(group_id);
```

### New Columns on `events`
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS plus_ones_allowed boolean DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_plus_ones_per_member integer DEFAULT 3;
ALTER TABLE events ADD COLUMN IF NOT EXISTS plus_ones_count_toward_capacity boolean DEFAULT true;
```

### New Column on `groups`
```sql
ALTER TABLE groups ADD COLUMN IF NOT EXISTS migration_source text;
```

### Full-Text Search on `groups`
```sql
ALTER TABLE groups ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_groups_search_vector ON groups USING GIN(search_vector);

CREATE OR REPLACE FUNCTION groups_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name,'') || ' ' || coalesce(NEW.tagline,'') || ' ' ||
    coalesce(NEW.description,'') || ' ' || coalesce(NEW.category,'') || ' ' ||
    coalesce(NEW.location,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_groups_search_vector
  BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION groups_search_vector_update();

-- Backfill existing rows
UPDATE groups SET search_vector = to_tsvector('english',
  coalesce(name,'') || ' ' || coalesce(tagline,'') || ' ' ||
  coalesce(description,'') || ' ' || coalesce(category,'') || ' ' ||
  coalesce(location,''));
```

### Assumed to Exist (from prior weeks)
| Table/Column | Used By |
|---|---|
| `guest_rsvps` table | Plus-one check-in, guest conversion, event pages |
| `event_plus_ones` table | RSVP plus-one storage |
| `profiles.interests` (text[]) | Warm introductions interest matching |
| `spirit_points_log` table | All spirit point actions |
| `member_stats` table | Tier, crew score, spirit points total |
| `badge_awards` table | Badge gallery in member insights |
| `badges` table | Badge definitions |

---

## 4. Supabase Edge Functions

| Function | Status |
|----------|--------|
| `generate-summary-card` | Stub — actual generation handled by Next.js API route `/api/events/[id]/summary-card` |
| `add-watermark` | **TODO for Week 8** — currently returns original image unmodified |

**Note:** Event flyer generation is NOT an Edge Function. It uses the Next.js API route `/api/events/[id]/flyer/route.tsx` with `next/og` ImageResponse.

---

## 5. New Environment Variables

| Variable | Required For | Status |
|----------|-------------|--------|
| `ANTHROPIC_API_KEY` | Migration wizard AI profile generation (`/api/migration/draft-profile`) | **NOT YET ADDED to .env.local** — must be added before testing |

### Existing Variables (no changes)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
RESEND_API_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
CRON_SECRET
```

---

## 6. Spirit Points Action Types — Full Registry

| Action Type | Points | Weekly Cap | Wired? | Added |
|-------------|--------|-----------|--------|-------|
| `event_attendance` | 20 | ∞ | Yes | Week 5 |
| `weather_bonus` | 5 | ∞ | No | Week 5 |
| `first_rsvp` | 10 | 10 | Yes | Week 5 |
| `event_chat_post` | 3 | 15 | No | Week 5 |
| `photo_upload` | 5 | 20 | Yes | Week 6 |
| `co_organise` | 25 | 25 | Partial | Week 5 |
| `welcome_dm` | 5 | 15 | No | Week 5 |
| `flyer_share` | 5 | 15 | Yes | **Week 7** |
| `guest_conversion` | 30 | ∞ | Partial | Week 6 |
| `event_rating` | 2 | ∞ | Yes | Week 6 |
| `guest_invite` | 5 | 15 | Yes | **Week 7** |

**Global weekly cap:** 100 points per user per group per week.

### Still Unwired (address in Week 8 polish):
- `weather_bonus` — needs weather API integration
- `event_chat_post` — needs wiring in chat message handler
- `welcome_dm` — needs wiring when a DM is sent to a new member
- `co_organise` — partially wired in migration wizard, not in general co-admin promotion

---

## 7. WOW Moments — Demonstrability Status

| WOW | Name | Week Built | Status |
|-----|------|-----------|--------|
| WOW 1 | 60-Second Group Setup | Week 3 | Fully demonstrable |
| WOW 2 | Smart Event Flow | Weeks 2+4 | Fully demonstrable |
| WOW 3 | Crew Wrap (End-of-Month Summary) | — | **Phase 2** (not started) |
| WOW 4 | WhatsApp Migration Wizard | **Week 7** | Fully demonstrable (5-step AI wizard at `/migrate`) |
| WOW 5 | Guest RSVP via Link | Week 3 | Fully demonstrable |
| WOW 6 | Warm Introductions | **Week 7** | Fully demonstrable (mutual connections + interest matching on join) |
| WOW 7 | Post-Event Summary Card | Week 6 | Fully demonstrable |
| WOW 8 | SEO Discovery Engine | **Week 7** | Fully demonstrable (JSON-LD on group/event pages, full-text search, upcoming events, sort) |
| WOW 9 | Shareable Event Flyer | **Week 7** | Fully demonstrable (3 formats: Stories, Square, Print/A4) |
| WOW 10 | Guest Plus-One System | **Week 7** | Fully demonstrable (admin config, email capture, spirit points) |
| WOW 11 | Guilt-Free Streak Recovery | Week 5 | Fully demonstrable |

---

## 8. Week 8 Startup Sequence

### Prerequisites (before starting dev server)
```bash
# 1. Navigate to project
cd ~/rova-crew

# 2. Install dependencies (picks up @anthropic-ai/sdk)
npm install

# 3. Add ANTHROPIC_API_KEY to .env.local
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env.local

# 4. Run SQL migrations in Supabase Dashboard → SQL Editor
#    (see Section 3 above for all SQL statements)

# 5. Start dev server
npm run dev
```

### Verify Week 7 features work
```bash
# TypeScript check
npx tsc --noEmit

# Production build
npx next build
```

### Key test URLs
```
/migrate                          → WhatsApp migration wizard
/discover                         → Discovery with search, upcoming events, sort
/g/[slug]/welcome                 → Warm introductions after join
/g/[slug]/admin/members           → Member list with activity filters
/g/[slug]/admin/members/[userId]  → Individual member insights + nudge
/events/[id]                      → Flyer generation, plus-one email capture
```

---

## 9. Known Issues, Rough Edges & Week 8 Polish Items

### Must Fix
1. **`ANTHROPIC_API_KEY` not in `.env.local`** — Migration wizard AI will fail without it. Add to `.env.local` and `.env.example`.
2. **`add-watermark` Edge Function is a stub** — Returns original image unmodified. Needs sharp-based watermark overlay implementation.
3. **`weather_bonus` spirit points unwired** — Needs external weather API integration or removal from the action types.
4. **`event_chat_post` spirit points unwired** — Needs wiring in the event chat message handler.
5. **`welcome_dm` spirit points unwired** — Needs wiring when a member sends their first DM to a new joiner.

### Should Fix
6. **`fn_monthly_board_reset()` pg_cron still commented out** — Monthly leaderboard reset won't fire until manually activated in Supabase.
7. **Discovery search depends on `search_vector` trigger** — Must run the SQL migration before search works; gracefully returns empty results if column doesn't exist.
8. **Plus-one columns may not exist on older events** — `plus_ones_allowed` etc. default to `true`/`3`/`true` so existing events are unaffected, but the SQL migration must run.
9. **Member insights nudge uses DM only** — Email nudge option is in the modal UI but the route only sends DMs (email path would need `sendBlastEmail` integration).

### Week 8 Deliverables (from build plan)
10. **PWA install prompt** — Service worker, manifest.json, install banner.
11. **Performance audit** — Lighthouse, bundle analysis, image optimisation.
12. **Accessibility pass** — WCAG 2.1 AA compliance, keyboard navigation, screen reader testing.
13. **Full investor demo run-through** — End-to-end demo script covering all 11 WOW moments.
14. **Photo watermark completion** — Implement the `add-watermark` Edge Function with sharp overlay.

### Nice to Have
15. **Geolocation in discovery** — Browser geolocation prompt for "Groups near you" (UI placeholder exists but not wired).
16. **`co_organise` spirit points in co-admin promotion flow** — Only fires in migration wizard currently.
17. **Guest conversion email** — When a plus-one guest signs up, send them a personalised conversion nudge.

---

## Architecture Quick Reference

```
createClient()        → auth only (supabase.auth.getUser())
createServiceClient() → all data operations (bypasses RLS)
Brand: Teal #0D7377, Gold #C9982A
Storage bucket: group-logos (used for everything)
Routes: /g/[slug]/... (NOT /groups/[slug]/...)
Event phases: pre_event → event_day → post_event → archived (computed, no status column)
```

---

*Generated 2026-02-26 for Week 8 onboarding.*
