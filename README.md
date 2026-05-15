# Red & Jess RSVP (Google Sheets Backend)

Wedding RSVP website with:
- Private invite-link RSVP form (`/`)
- Admin panel (`/admin`)
- Google Sheets as storage for guests + RSVP submissions

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Fill `.env.local` values (Google service account + sheet ID + admin token).

4. Run:

```bash
npm run dev
```

5. Open:
- `http://localhost:3000` (RSVP form, requires invite link params)
- `http://localhost:3000/admin` (admin panel)

## Setup Tutorial

Full step-by-step Google account connection guide:

- `docs/google-sheets-setup.md`

## Data Tabs Required in Google Sheet

`Guests` headers:

```text
id | inviteCode | inviteToken | fullName | email | maxGuests | status | lastUpdated | notes
```

`RSVPs` headers:

```text
timestamp | inviteCode | fullName | email | attendance | guestCount | dietaryRestrictions | songRequest | message | source
```

`Settings` headers:

```text
key | value
```

## Invite-Only Mode

Guests should open RSVP links in this format:

```text
/?invite=RJ2026-XXXXXX&token=INVITE_TOKEN
```

You can generate and share these links/QRs from `/admin`.
