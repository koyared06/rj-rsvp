# Red & Jess Wedding RSVP Website
## Production Execution Document

Version: 1.0  
Date: May 5, 2026  
Owner: Red & Jess Team

---

## 1. Product Goal
Create a cinematic RSVP website for Red & Jess that feels emotional and premium while delivering a frictionless RSVP experience on mobile and desktop.

Primary outcome:
- Guests can RSVP in under 2 minutes with high completion and low confusion.

Secondary outcomes:
- The couple can monitor responses in real time.
- The website doubles as an elegant digital wedding guide.

---

## 2. Scope

### In Scope
- Cinematic storytelling landing page
- Wedding details pages
- Full RSVP workflow (identify guest, attendance, party, meals, notes)
- Guest confirmation page and email confirmation
- Admin dashboard (response status + export)
- Responsive behavior for mobile and desktop
- Accessibility baseline implementation

### Out of Scope (for v1)
- Full multi-language support
- On-site check-in app
- Real-time chat support
- Payment or e-commerce features

---

## 3. Information Architecture

1. Home (Hero + cinematic intro)
2. Our Story
3. Wedding Details
4. RSVP
5. Travel & Stay
6. Registry (optional)
7. Gallery
8. FAQ
9. Contact

---

## 4. Page-by-Page Copy Blocks (Production Templates)
Replace placeholders before launch.

## 4.1 Home / Hero
- Eyebrow: `Together with their families`
- H1: `Red & Jess`
- Subhead: `Invite you to celebrate their wedding`
- Date line: `[Month Day, Year]`
- Primary CTA: `RSVP Now`
- Secondary CTA: `View Details`

Optional cinematic line:
- `A love story written in light, laughter, and forever.`

## 4.2 Our Story
Section heading:
- `Our Story`

Intro paragraph:
- `What began as a simple hello became our favorite adventure.`

Timeline cards (sample structure):
- `[Month Year] - We met at [place].`
- `[Month Year] - First trip together to [location].`
- `[Month Year] - The proposal at [location].`

## 4.3 Wedding Details
- Section title: `Wedding Day`
- Ceremony:
  - Label: `Ceremony`
  - Time: `[Time]`
  - Venue: `[Venue Name]`
  - Address: `[Full Address]`
- Reception:
  - Label: `Reception`
  - Time: `[Time]`
  - Venue: `[Venue Name]`
  - Address: `[Full Address]`
- Dress code:
  - `Dress Code: [Formal/Semi-Formal/etc.]`
- CTA:
  - `Open in Maps`

## 4.4 RSVP
- Heading: `Kindly Respond`
- Deadline notice: `Please RSVP by [Month Day, Year].`

Step prompts:
- Step 1: `Find your invitation`
- Step 2: `Will you be joining us?`
- Step 3: `Tell us about your party`
- Step 4: `Meal and dietary preferences`
- Step 5: `Leave a note for the couple`
- Step 6: `Review and submit`

Attendance choices:
- `Joyfully Attending`
- `Regretfully Declining`

Confirmation message:
- `Thank you. Your RSVP has been received. We cannot wait to celebrate with you.`

## 4.5 Travel & Stay
- Title: `Travel & Stay`
- Intro: `For guests traveling in, here are nearby options.`
- Blocks:
  - `Recommended Hotels`
  - `Transport Tips`
  - `Local Highlights`

## 4.6 Registry (Optional)
- Title: `Registry`
- Body: `Your presence is the greatest gift. If you wish, here are our registry options.`

## 4.7 FAQ
Starter questions:
- `What time should I arrive?`
- `Can I bring a plus-one?`
- `Are children invited?`
- `Where should I park?`
- `What should I wear?`

## 4.8 Contact
- Title: `Need Help?`
- Body: `For questions, contact [Name] at [Email] or [Phone].`

---

## 5. Visual Direction and Design Tokens

Style direction:
- Cinematic, warm, elegant
- Slow transitions, soft overlays, film-inspired rhythm

Suggested token set:

```css
:root {
  --bg-ink: #111111;
  --bg-cream: #f3eee6;
  --accent-gold: #b58b4a;
  --accent-rose: #b76e79;
  --text-strong: #1b1b1b;
  --text-light: #f8f7f4;
  --line-soft: rgba(255, 255, 255, 0.18);

  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 24px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
}
```

Typography guidance:
- Display: high-contrast editorial serif
- Body: modern readable sans-serif
- Use max 2 font families

Motion guidance:
- Page intro fade: 600 to 900ms
- Section reveal stagger: 120ms increments
- Respect reduced motion preferences

---

## 6. Component Inventory (Build Checklist)

Global:
- `SiteHeader`
- `SiteFooter`
- `SectionHeading`
- `PrimaryButton`
- `SecondaryButton`

Cinematic:
- `HeroCinematic`
- `FilmGrainOverlay`
- `LightLeakLayer`
- `StoryTimeline`
- `RevealOnScroll`

Content:
- `EventCard`
- `MapLinkCard`
- `HotelCard`
- `FaqAccordion`
- `GalleryMasonry`

RSVP Flow:
- `RsvpWizard`
- `InviteLookupForm`
- `AttendanceStep`
- `PartyDetailsStep`
- `MealPreferencesStep`
- `GuestNoteStep`
- `ReviewSubmitStep`
- `RsvpSuccessPanel`

Admin:
- `AdminLoginGate`
- `RsvpStatsCards`
- `GuestResponseTable`
- `ExportCsvButton`

---

## 7. Tech Architecture

Recommended stack:
- Frontend: Next.js (App Router) + Tailwind CSS + Framer Motion
- Backend: Next.js route handlers
- DB/Auth: Supabase Postgres (Auth optional for admin only)
- Validation: Zod
- Email: Resend
- Hosting: Vercel
- Analytics: Plausible or GA4

High-level app structure:
- Public pages for storytelling and details
- Protected admin route
- Server-side form submission and validation
- DB as source of truth for RSVP state

---

## 8. Database Schema (Supabase/Postgres)

```sql
create table invite_groups (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  group_name text,
  max_guests int not null default 1,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table guests (
  id uuid primary key default gen_random_uuid(),
  invite_group_id uuid not null references invite_groups(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (first_name || ' ' || last_name) stored,
  is_primary boolean not null default false,
  can_bring_plus_one boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rsvps (
  id uuid primary key default gen_random_uuid(),
  invite_group_id uuid not null unique references invite_groups(id) on delete cascade,
  status text not null check (status in ('attending', 'declined')),
  attending_count int not null default 0,
  submitted_by_name text,
  submitted_by_email text,
  submitted_at timestamptz not null default now(),
  note_to_couple text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rsvp_attendees (
  id uuid primary key default gen_random_uuid(),
  rsvp_id uuid not null references rsvps(id) on delete cascade,
  guest_name text not null,
  meal_choice text,
  dietary_restrictions text,
  song_request text,
  is_plus_one boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_guests_invite_group on guests(invite_group_id);
create index idx_rsvp_attendees_rsvp_id on rsvp_attendees(rsvp_id);
```

Notes:
- `invite_groups` maps one invitation to one RSVP submission.
- `rsvps.invite_group_id` is unique to avoid duplicate final submissions.
- Add row-level security policies based on your admin strategy.

---

## 9. API Contract (Route Handlers)

1. `POST /api/rsvp/lookup`
- Input: `{ inviteCode | fullName }`
- Output: invite group payload with allowed guests

2. `POST /api/rsvp/submit`
- Input: final RSVP payload from wizard
- Action: validate, upsert `rsvps`, replace `rsvp_attendees`, send email
- Output: success + reference ID

3. `GET /api/admin/rsvps`
- Auth required
- Output: list + aggregate counts

4. `GET /api/admin/export.csv`
- Auth required
- Output: downloadable CSV

Validation rules:
- Deadline enforcement (reject late submissions if needed)
- `attending_count` must be `<= invite_groups.max_guests`
- Strong field validation via Zod

---

## 10. RSVP Payload Example

```json
{
  "inviteGroupId": "4f5d18a9-2ef9-4d8b-a80a-2f38b8d6508b",
  "status": "attending",
  "submittedByName": "Alex Rivera",
  "submittedByEmail": "alex@example.com",
  "attendees": [
    {
      "guestName": "Alex Rivera",
      "mealChoice": "beef",
      "dietaryRestrictions": "none",
      "songRequest": "At Last",
      "isPlusOne": false
    }
  ],
  "noteToCouple": "So happy for you both."
}
```

---

## 11. Admin Dashboard Requirements

KPIs:
- Total invited groups
- Total responses
- Attendance rate
- Total attending headcount
- Total declined
- Pending responses

Table columns:
- Invite code
- Group name
- RSVP status
- Attending count
- Submitted by
- Submission time
- Dietary flags

Admin actions:
- Export CSV
- Filter by status
- Search by name or code
- Manual update (optional)

---

## 12. Analytics Events

Track these events:
- `hero_cta_clicked`
- `rsvp_lookup_submitted`
- `rsvp_step_completed`
- `rsvp_submitted_success`
- `rsvp_submitted_error`
- `map_link_clicked`
- `registry_link_clicked`

Core funnel:
- Landing visit -> RSVP start -> RSVP submit success

---

## 13. Accessibility Requirements

Minimum checklist:
- Color contrast passes WCAG AA
- All form fields have labels and error messages
- Keyboard-only navigation works for RSVP flow
- `prefers-reduced-motion` respected
- Images/videos include meaningful alt or fallback text

---

## 14. Performance Targets

Mobile targets:
- LCP < 2.5s
- CLS < 0.1
- INP < 200ms

Implementation notes:
- Use optimized images (`next/image`)
- Lazy-load media-heavy sections
- Compress video clips and provide poster fallback
- Limit heavy JS in first viewport

---

## 15. Security and Privacy

Requirements:
- Do not expose full guest list publicly
- Protect admin endpoints with auth
- Sanitize and validate all text inputs
- Store only necessary personal data
- Add privacy note describing RSVP data use

Optional hardening:
- Rate limit RSVP endpoints
- CAPTCHA after repeated failed lookups

---

## 16. Delivery Plan and Milestones

### Milestone 1: Foundation (2 to 3 days)
- Initialize app and design tokens
- Build global layout and static sections
- Set up Supabase project and schema

### Milestone 2: RSVP Engine (3 to 4 days)
- Implement wizard UI and validation
- Create lookup + submit APIs
- Integrate DB writes and confirmation state

### Milestone 3: Admin and Notifications (2 to 3 days)
- Build admin table and KPI cards
- Add CSV export
- Add confirmation emails

### Milestone 4: Polish and Launch (2 to 3 days)
- QA across devices and browsers
- Accessibility pass
- Performance pass
- Production deploy

---

## 17. QA Test Matrix

Functional:
- Attend flow completes correctly
- Decline flow completes correctly
- Invalid invite code handled gracefully
- Duplicate submit behavior controlled

Cross-browser:
- iOS Safari
- Android Chrome
- Desktop Chrome
- Desktop Safari
- Desktop Edge

Data:
- DB rows created and linked correctly
- CSV export format validated
- Email trigger tested for success/failure

---

## 18. Launch Checklist

1. Final copy approved
2. Final date/time/venue verified
3. RSVP deadline set in config
4. Guest list imported
5. Admin access tested
6. Domain and SSL active
7. Analytics events verified
8. Backup/export routine tested

---

## 19. Immediate Inputs Needed From Red & Jess

1. Final wedding date and RSVP deadline
2. Ceremony and reception addresses
3. Guest list CSV (name, invite code, group size)
4. Meal options and dietary categories
5. Dress code text
6. Hotel and travel recommendations
7. Registry links (or confirm omission)
8. Contact person for guest support

---

## 20. Suggested Folder Structure

```text
docs/
  cinematic-rsvp-execution-plan.md
src/
  app/
    page.tsx
    rsvp/page.tsx
    details/page.tsx
    story/page.tsx
    travel/page.tsx
    registry/page.tsx
    faq/page.tsx
    contact/page.tsx
    admin/page.tsx
  components/
    cinematic/
    rsvp/
    admin/
  lib/
    db/
    validation/
    analytics/
    email/
```

---

## 21. Definition of Done
Project is done when:
- Guests can complete RSVP successfully across supported devices.
- Couple can see reliable real-time RSVP data and export CSV.
- Site achieves visual cinematic quality and accessibility baseline.
- Production deployment is stable with no blocker defects.
