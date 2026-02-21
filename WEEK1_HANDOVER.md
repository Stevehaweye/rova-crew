# ROVA Crew — Week 1 Handover Summary

## 1. All Files Created This Week

### App Pages & Routes
| File | Purpose |
|---|---|
| `app/page.tsx` | Root redirect: logged in → `/home`, logged out → `/auth` |
| `app/layout.tsx` | Root layout with Geist fonts and global CSS |
| `app/auth/page.tsx` | Sign in / Create account page with magic link OTP flow |
| `app/auth/callback/route.ts` | Handles magic link callback, exchanges code for session, routes to onboarding or home |
| `app/onboarding/page.tsx` | 3-step onboarding: profile, interests, group discovery (placeholder groups) |
| `app/home/page.tsx` | Authenticated dashboard showing user's groups or empty state |
| `app/home/user-menu.tsx` | Client component: avatar dropdown with sign-out button |
| `app/groups/new/page.tsx` | Group creation form with live preview, logo upload, colour picker, category selector |
| `app/g/[slug]/page.tsx` | Public group profile page: hero, stats, about, events placeholder, member wall |
| `app/g/[slug]/join-button.tsx` | Interactive join card with approval state management |
| `app/g/[slug]/admin/page.tsx` | Admin page wrapper: permission check + data fetching |
| `app/g/[slug]/admin/admin-shell.tsx` | Full admin dashboard: sidebar, stats, health score, quick actions, member list, sign-out |
| `app/g/[slug]/admin/invite-modal.tsx` | Invite modal: copy link, QR code display/download, WhatsApp share |
| `app/api/groups/[slug]/qr/route.ts` | API endpoint: generates SVG QR codes for group URLs |

### Lib / Utilities
| File | Purpose |
|---|---|
| `lib/supabase/client.ts` | Browser-side Supabase client (`createBrowserClient`) |
| `lib/supabase/server.ts` | Server-side Supabase client with Next.js cookies integration |

### Config / Infrastructure
| File | Purpose |
|---|---|
| `middleware.ts` | Protects `/home`, `/profile`, `/g/*/admin/*` routes; validates env vars; refreshes auth session |
| `next.config.mjs` | Next.js config (minimal, no custom settings) |
| `tailwind.config.ts` | Tailwind with CSS variable theming |
| `.env.example` | Template for required environment variables |
| `.env.local` | Local env vars (gitignored — not in repo) |

---

## 2. Database Tables (Supabase)

### `profiles`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Matches `auth.users.id` |
| `full_name` | text | |
| `avatar_url` | text | Nullable |
| `bio` | text | Nullable |
| `location` | text | Nullable |
| `interests` | text[] | Array of interest labels |
| `onboarding_complete` | boolean | Controls post-login routing |

### `groups`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | text | |
| `slug` | text (unique) | URL-friendly identifier |
| `tagline` | text | Nullable |
| `description` | text | Nullable |
| `category` | text | e.g. Running, Cycling, Book Club |
| `logo_url` | text | Nullable, stored in `group-logos` bucket |
| `hero_url` | text | Nullable |
| `primary_colour` | text | Hex without `#` (e.g. `0D7377`) |
| `is_public` | boolean | Controls visibility to non-members |
| `join_approval_required` | boolean | |
| `created_by` | uuid | FK to auth.users |
| `created_at` | timestamptz | |

### `group_members`
| Field | Type | Notes |
|---|---|---|
| `group_id` | uuid | FK to groups |
| `user_id` | uuid | FK to auth.users |
| `role` | text | `super_admin`, `co_admin`, `member` |
| `status` | text | `approved`, `pending` |
| `joined_at` | timestamptz | |

### `member_stats`
| Field | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK to auth.users |
| `group_id` | uuid | FK to groups |
| `tier` | text | `newcomer`, `regular`, `dedicated`, `veteran`, `legend` |
| `crew_score` | integer | Default 0 |

### Storage Buckets
| Bucket | Access | Purpose |
|---|---|---|
| `avatars` | Public | User profile photos |
| `group-logos` | Public | Group logo images |

---

## 3. Supabase Auth Settings Configured

- **Email provider**: Enabled with magic link OTP
- **Custom SMTP**: Resend via `smtp.resend.com` using domain `mypin.global`
- **Site URL**: `https://rova-crew.netlify.app`
- **Redirect URLs**: `https://rova-crew.netlify.app/auth/callback`

### RLS Policies in Place

**`group_members`** — uses `SECURITY DEFINER` helper functions to avoid infinite recursion:
- `is_group_member(_group_id, _user_id)` — checks approved membership
- `is_group_admin(_group_id, _user_id)` — checks admin role
- SELECT: own rows + rows in groups where you're an approved member
- INSERT: authenticated users can insert their own membership
- UPDATE: group admins only
- DELETE: own rows + group admins

**`groups`**:
- SELECT: anyone can view public groups (`is_public = true`)
- SELECT: authenticated members can view their private groups

**`storage.objects`**:
- INSERT: authenticated users can upload to `group-logos`
- SELECT: public reads on `group-logos`

---

## 4. Live Netlify URL

**https://rova-crew.netlify.app**

### Netlify Environment Variables
| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lzogiyiklucbdglbogcx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(set in Netlify)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(set in Netlify)* |
| `NEXT_PUBLIC_APP_URL` | `https://rova-crew.netlify.app` |
| `SECRETS_SCAN_OMIT_KEYS` | `NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,NEXT_PUBLIC_APP_URL` |

---

## 5. What Works Right Now (Features Live)

- Root URL redirects to `/auth` (logged out) or `/home` (logged in)
- Magic link sign-in and account creation via email
- 3-step onboarding flow (profile, interests, placeholder group discovery)
- Authenticated home page with group list or empty state
- User menu dropdown with sign-out
- Group creation with name, slug, tagline, category, description, logo upload, colour picker, public/private toggle, approval toggle
- Live preview during group creation
- Public group profile page with hero, stats bar, about, member wall with tier badges
- Join group functionality with approval workflow
- Private group guard (non-members see restricted view)
- Admin dashboard with stats, health score ring, quick actions, recent members
- Invite modal with copyable link, QR code generation/download, WhatsApp share
- Logo upload to Supabase Storage
- Middleware protecting authenticated routes

---

## 6. What Is Placeholder / Not Yet Built

| Feature | Status | Notes |
|---|---|---|
| Onboarding Step 3 groups | Placeholder | Hardcoded `PLACEHOLDER_GROUPS` — should pull real groups filtered by interests |
| Upcoming Events | Placeholder | Hardcoded event cards on group profile page — "Coming Week 2" |
| Event creation & RSVP | Not built | |
| Attendance tracking | Not built | |
| Member streaks | Placeholder | Shows "0 weeks" — no tracking logic |
| Crew scores & tiers | Placeholder | `member_stats` table exists but no scoring logic |
| Hall of Fame | Placeholder | Shows "Real stats unlock in Week 5" |
| Discover groups page | Not built | Link currently points to `#` |
| WhatsApp migration tool | Placeholder | Shows "Coming in Week 6" message |
| Profile editing | Not built | No `/profile` page yet |
| Notifications | Not built | |
| Avatar upload RLS | Needs policy | `avatars` bucket may need storage policies like `group-logos` |

---

## 7. Command to Restart Dev Server

```bash
cd /Users/stevepurdhamair/rova-crew && npm run dev
```

App runs at `http://localhost:3000`. Make sure `.env.local` has `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local development (change back from Netlify URL if needed).

---

## 8. Known Issues / Watch Out For in Week 2

### Must Fix
- **`avatars` storage bucket**: May need RLS policies added (same pattern as `group-logos`) — avatar upload during onboarding might silently fail on deployed version
- **`NEXT_PUBLIC_APP_URL` dual value**: `.env.local` currently set to `https://rova-crew.netlify.app` — switch to `http://localhost:3000` for local dev, or magic link redirects will go to production

### Be Aware
- **Supabase email rate limits**: Free tier with Resend has limits. Bounced test emails triggered a Supabase warning — only use valid email addresses
- **Next.js version**: Running 14.2.35, browser shows "outdated" banner. Can upgrade with `npm install next@latest` but test thoroughly
- **Onboarding `onboarding_complete`**: New accounts go through onboarding. Existing accounts had this set to `true` via SQL. If you create test accounts directly in Supabase, set this manually
- **RLS on `groups` table**: Only public groups are visible to logged-out users. If you add INSERT/UPDATE policies, avoid self-referencing the `groups` table (same infinite recursion pattern as `group_members`)
- **`member_stats` table**: Group creation inserts a row, but no logic updates it yet. Week 2 event/attendance work will need to update `tier` and `crew_score`

### Brand Constants (used throughout, not in a shared config)
- Primary teal: `#0D7377`
- Gold accent: `#C9982A`
- Wordmark: `ROVA` (teal) + `CREW` (gold)
- Font: Geist (sans + mono)

### Tech Stack
- **Framework**: Next.js 14.2.35 (App Router)
- **Auth/DB/Storage**: Supabase
- **Styling**: Tailwind CSS
- **Email**: Resend SMTP via `mypin.global` domain
- **Hosting**: Netlify
- **QR Codes**: `qrcode` npm package
