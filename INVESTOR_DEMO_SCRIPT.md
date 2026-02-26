# ROVA Crew — 15-Minute Investor Demo Script

**Format:** Live product demo on a real phone against the live production URL
**Duration:** 15 minutes
**WOW Moments Covered:** 10 of 11 (WOW 3 Crew Wrap is Phase 2)

---

## Setup Checklist (10 minutes before)

- [ ] Phone charged to 100%, screen brightness at maximum
- [ ] ROVA Crew PWA installed on phone home screen
- [ ] Do Not Disturb enabled (no notifications during demo)
- [ ] Logged in as test admin account on phone
- [ ] Test group "Brighton Tuesday Runners" visible on home screen with 8+ members
- [ ] 1 upcoming event in the next 7 days (for live RSVP demo)
- [ ] 1 past event with photos, ratings, and a pre-generated WOW 7 summary card
- [ ] Second device (laptop) open on admin check-in scanner page
- [ ] Third device (incognito browser or second phone) ready for guest RSVP demo
- [ ] WOW 7 shareable card PNG pre-generated and stored in Supabase Storage
- [ ] Wifi connection stable and tested

---

## The Demo

### Act 1: Discovery and First Impressions (0:00 - 1:00)

**WOW 8: Smart Group Discovery**

**What you do:**
Open the live URL in the phone's browser (not the installed PWA yet). Navigate to `/discover`.

**What you say:**
> "No login needed. This is what anyone with a Google search sees. ROVA Crew is live, public, and discoverable from day one."
>
> "This page is indexed by Google, Bing, and AI search engines like Perplexity. A running club in Brighton shows up when someone searches 'running group Brighton' — no marketing spend required."
>
> "Every group has structured data. Every event has structured data. We're building organic distribution into the product itself."

**Key actions:**
- Scroll through the group cards
- Tap a category filter to show filtering works
- Point out the member counts and upcoming event dates on each card

---

### Act 2: WhatsApp Migration (1:00 - 2:30)

**WOW 4: WhatsApp Migration Wizard**

**What you do:**
Navigate to `/migrate`. Type "Brighton Tuesday Runners" in Step 1. Advance to Step 2 — show the AI drafting the profile in real time.

**What you say:**
> "Most community organisers are running a WhatsApp group right now. They have 50, 100, 200 members trapped in a chat thread with no events, no payments, no attendance tracking."
>
> "WOW 4: in under 5 minutes, ROVA auto-drafts the group profile from the name alone."

*[Read the AI-generated description aloud]*

> "The admin picks a colour, adds a logo if they want, and hits Create. Step 3 generates a migration message — one tap copies it to WhatsApp. Our data shows 80-90% of members join within 48 hours."

**Key actions:**
- Show the AI-generated description, tagline, and category
- Show the colour picker and logo upload
- Show the WhatsApp share button with the pre-written migration message

---

### Act 3: Warm Introductions (2:30 - 3:30)

**WOW 6: Warm Introductions on Join**

**What you do:**
Show the `/g/[slug]/welcome` page (use a test account that shares a group with another member).

**What you say:**
> "The biggest fear when joining any new community: I don't know anyone."
>
> "WOW 6: the moment a member joins, ROVA checks every other ROVA group and surfaces mutual connections instantly. 'You already know Sarah from Brighton Cycling Club.'"
>
> "Research shows members who know one person in week one are 4x more likely to still be active at 90 days. This feature attacks the single biggest cause of community churn — feeling like a stranger."

**Key actions:**
- Point out the mutual connection cards with shared group context
- Show the "Say hello" button that opens a direct message
- Show the next upcoming event card with RSVP button

---

### Act 4: Social Snowball RSVP (3:30 - 5:00)

**WOW 2: Social Snowball RSVP + WOW 5: Shared-Cost Live Price Ticker**

**What you do:**
Navigate to the upcoming test event. RSVP as "Going". Show the social snowball (who else is going, with faces). If it's a shared-cost event, show the price ticker updating.

**What you say:**
> "A member opens the event and sees their friends' faces already committed to going. That's structural FOMO — and it works."
>
> "On shared-cost events, they also see the price dropping in real time as people join. 'Tell a friend to bring the price down.' The event promotes itself."
>
> "No competitor combines social proof with dynamic pricing in the RSVP flow. This is where conversion happens."

**Key actions:**
- Show the avatar stack of people who are going
- Show the RSVP button and the instant counter update
- If shared-cost: show the price ticker with the per-person breakdown

---

### Act 5: Guest Plus-Ones (5:00 - 6:00)

**WOW 10: Guest Plus-One System**

**What you do:**
On the event page, navigate to the "Bringing a guest?" section. Add a guest name and email.

**What you say:**
> "WOW 10: members bring friends without the awkward admin permission conversation. The guest gets everything they need — event details, directions, a personal QR code for check-in."
>
> "After the event, a warm email asks if they'd like to join properly. First-time guests are the highest-conversion new members in any community."

**Key actions:**
- Add a guest name
- Add a guest email (show the "they'll get event details" note)
- Explain the admin can configure max guests per member

---

### Act 6: QR Check-In (6:00 - 7:00)

**What you do:**
On the second device (laptop), open the admin check-in scanner for the test event. Scan a test member's QR code from the phone. Then scan a guest QR.

**What you say:**
> "The check-in moment is when the community comes alive. One tap per person — works on any phone, no app download."
>
> "For guests: 'Guest of Alex — checked in.' The admin sees the room filling in real time. Attendance data feeds into everything else — spirit points, badges, streaks, the health score."

**Key actions:**
- Show the QR scanner working
- Show the instant check-in confirmation with name and avatar
- Point out the attendance counter updating

---

### Act 7: Photo Gallery (7:00 - 8:30)

**What you do:**
Navigate to the past test event's photos page. Upload 2 photos from your camera roll. Show them appearing in the gallery.

**What you say:**
> "The 24 hours after an event is where most platforms go silent. ROVA turns it into a designed experience."
>
> "Photos upload with one tap from the post-event notification. The gallery updates in real time as others upload. Double-tap to heart. And then..."

**Key actions:**
- Upload photos (camera-first picker)
- Show photos appearing in the gallery grid
- Double-tap a photo to react

---

### Act 8: Post-Event Summary Card (8:30 - 10:00)

**WOW 7: Post-Event Summary Card**

**What you do:**
Show the pre-generated WOW 7 summary card for the past test event. Read the stats. Tap Share — show the branded PNG.

**What you say:**
> *[Show the summary card]*
>
> "This generates automatically, 24 hours after every event closes. Attendee count, milestones celebrated, payment reconciliation, rating summary."
>
> *[Show the shareable PNG]*
>
> "The shareable card posts to Instagram or WhatsApp with one tap. This is what makes ROVA visible to people who've never heard of it. Every shared card is organic marketing."

**Key actions:**
- Show the summary card with all the stats
- Tap the Share button
- Show the branded PNG image

---

### Act 9: Gamification — Streaks, Badges, Crew Card (10:00 - 11:00)

**WOW 11: Attendance Streak + Guilt-Free Recovery**

**What you do:**
Show the Monthly Attendance Board. Show a test member's Crew Card in `/wallet` with badges and tier.

**What you say:**
> "WOW 11: the attendance streak works exactly like Duolingo — with one crucial difference. When a member breaks their streak, ROVA doesn't shame them."
>
> "'You're one event away from a 5-event milestone. See you at Tuesday's run?'"
>
> *[Show the badge gallery]*
>
> "The Crew Card is their identity in the community. Tier badge, crew score, QR code for check-in. It updates automatically after every event."

**Key actions:**
- Show the leaderboard with rankings
- Show the Crew Card with tier and score
- Show earned badges

---

### Act 10: Admin Dashboard (11:00 - 12:00)

**What you do:**
Navigate to the admin dashboard. Show Group Health Score. Show the at-risk member panel. Show the event report for the past test event.

**What you say:**
> "The admin view is what sells to enterprises. Group Health Score: five signals, one number, colour-coded."
>
> "At-risk members flagged before they lapse — one-tap personal nudge. The event report is automatic — attendance rate, payment reconciliation, rating distribution, Health Score impact."
>
> "Admin does nothing. It's all there."

**Key actions:**
- Show the Health Score number and its 5-signal breakdown
- Show the at-risk member cards
- Open an event report — show attendance, CSV export, ratings

---

### Act 11: Event Flyer (12:00 - 13:00)

**WOW 9: Auto-Generated Event Flyer**

**What you do:**
Open the upcoming event. Tap "Create Flyer". Generate the Instagram Stories format. Show the PNG. Tap Share.

**What you say:**
> "WOW 9: every event generates a professional branded flyer in one tap. Instagram Stories, square post, or A4 for printing."
>
> "A volunteer admin in a cycling club can pin a professional-looking flyer at the gym within 60 seconds of creating the event. Heylo doesn't offer this. Partiful's aesthetics are casual. This looks like it was made by a designer."

**Key actions:**
- Show the 3 format options (Stories, Square, Print)
- Generate a flyer
- Show the download/share buttons

---

### Act 12: PWA Install (13:00 - 14:00)

**What you do:**
Show the install prompt (or manually add to home screen). Open the app from the home screen — no browser chrome.

**What you say:**
> "This is a web app — no App Store, no approval process, no 30% App Store cut. It installs directly to the home screen like a native app. iOS and Android."
>
> "The spec calls for Phase 2 native apps. This PWA means every single feature we've shown today is available to every member right now, with no download barrier."

**Key actions:**
- Show the install prompt or manual "Add to Home Screen"
- Open from home screen — no address bar
- Navigate through a few screens to show native-like feel

---

### Act 13: Closing (14:00 - 15:00)

**What you do:**
Return to `/discover`. Summarise.

**What you say:**
> "Everything you've seen today: one product, eight weeks of build, all 10 WOW moments live."
>
> "No competitor combines zero-friction joining, social snowball growth, WhatsApp migration, shared-cost events, warm introductions, auto-generated post-event summaries, smart discovery, event flyers, guest plus-ones, and streak-based engagement in a single product."
>
> "This is the white space. This is ROVA Crew."

---

## Handling Questions

### "What's your monetisation model?"
Transaction percentage on Stripe payments. Zero cost to groups with no paid events. For paid events, ROVA takes a small percentage of each transaction. The typical running club collecting £5/event from 20 members generates £100/event; ROVA's fee is under £3. Enterprise annual licence for organisations. Phase 2 adds a Pro tier at £19/month for power features.

### "How is this different from Meetup / Heylo / Facebook Groups?"
Three-way differentiation: (1) zero-friction guest joining and social snowball RSVP that no competitor has together; (2) post-event designed experience — the summary card, photo gallery, and milestone celebrations — that turns an event into a community memory; (3) WhatsApp migration as a first-class product feature. The white space: no platform combines zero-friction joining, beautiful events, sustained group management with payments, and enterprise-grade administration.

### "How many users do you have?"
We're in private beta. The product is complete and production-ready. We're recruiting founding groups for launch. Every group that completes the WhatsApp migration flow is a group permanently won.

### "What about native apps?"
Phase 2. The PWA you just saw installs to the home screen and works like a native app. Our competitor Heylo has a buggy native app; we have a stable PWA that works better. Phase 2 wraps this same product in React Native.

### "What's the tech stack?"
Next.js, Supabase (PostgreSQL + Auth + Realtime + Storage), Stripe Connect, Tailwind CSS. Deployed on Netlify with edge functions. The architecture scales horizontally. SOC 2 Type II certification planned for Month 12.

---

## Post-Demo Checklist

- [ ] Share the live URL with the investor
- [ ] Offer to add them to the test group so they can experience it as a member
- [ ] Send the WOW 7 summary card PNG as a follow-up (shows the product's visual quality)
- [ ] Follow up with the pitch deck within 24 hours

---

*Practise this demo at least three times end to end before the real thing.*
*Total duration: 15 minutes. Do not exceed 15 minutes — leave them wanting more.*
