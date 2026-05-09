# Google Sheets Setup Guide (Red & Jess RSVP)

Ito ang exact steps para ma-connect ang app sa Google account mo at magamit ang Google Sheet bilang storage/admin backend.

## 1. Gumawa ng Google Sheet

1. Open Google Sheets and create a new spreadsheet.
2. Rename sheet tabs to:
   - `Guests`
   - `RSVPs`
   - `Settings`
   - `EntourageCategories`
   - `EntourageMembers`
3. Sa `Guests` tab, ilagay sa row 1 ang headers:

```text
id | inviteCode | inviteToken | fullName | email | maxGuests | status | lastUpdated | notes
```

4. Sa `RSVPs` tab, ilagay sa row 1 ang headers:

```text
timestamp | inviteCode | fullName | email | attendance | guestCount | dietaryRestrictions | songRequest | message | source
```

5. Sa `Settings` tab, ilagay sa row 1 ang headers:

```text
key | value
```

6. Copy mo ang spreadsheet ID from URL:
   - `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

7. Sa `EntourageCategories` tab, ilagay sa row 1 ang headers:

```text
id | name | slug | sortOrder | isVisible | createdAt | updatedAt
```

8. Sa `EntourageMembers` tab, ilagay sa row 1 ang headers:

```text
id | categoryId | fullName | side | memberOrder | isVisible | notes | createdAt | updatedAt
```

## 2. Enable Google Sheets API

1. Pumunta sa https://console.cloud.google.com
2. Create or select a project.
3. Go to `APIs & Services` -> `Library`.
4. Search `Google Sheets API`.
5. Click `Enable`.

## 3. Create Service Account + Key

1. Go to `IAM & Admin` -> `Service Accounts`.
2. Click `Create Service Account`.
3. Name example: `rj-rsvp-sheets-bot`.
4. Finish creation.
5. Open the created service account.
6. Go to `Keys` tab -> `Add Key` -> `Create new key` -> choose `JSON`.
7. Download the JSON file safely.

From that JSON, kukunin mo:
- `client_email` -> for `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` -> for `GOOGLE_PRIVATE_KEY`

## 4. Share the Sheet to Service Account

1. Open your Google Sheet.
2. Click `Share`.
3. Add the service account email (`client_email` value).
4. Role should be `Editor`.

Without this, hindi makakapagsulat ang app sa sheet.

## 5. Configure Environment Variables

1. Copy `.env.example` to `.env.local`.
2. Fill values:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_GUESTS_TAB=Guests
GOOGLE_SHEETS_RSVPS_TAB=RSVPs
GOOGLE_SHEETS_SETTINGS_TAB=Settings
GOOGLE_SHEETS_ENTOURAGE_CATEGORIES_TAB=EntourageCategories
GOOGLE_SHEETS_ENTOURAGE_MEMBERS_TAB=EntourageMembers
ADMIN_TOKEN=your-strong-admin-token
```

Important:
- Keep quotes around `GOOGLE_PRIVATE_KEY`.
- Preserve `\n` line breaks exactly.
- Never commit `.env.local`.

## 6. Seed Initial Guest Data

Sa `Guests` tab, maglagay ng sample rows under headers:

```text
uuid-1 | RJ2026-A1 |  | Juan Dela Cruz | juan@example.com | 2 | pending |  |
uuid-2 | RJ2026-B2 |  | Maria Santos   | maria@example.com | 1 | pending |  |
```

Notes:
- `id` can be any unique value sa seed rows. New guests from admin auto-generate UUID.
- `inviteToken` can be blank for old rows. System auto-generates missing tokens after admin load.
- `status` default should be `pending`.

Optional entourage seed:

`EntourageCategories`:

```text
cat_01 | Parents of the Bride | parents-of-the-bride | 10 | TRUE | 2026-05-09T00:00:00.000Z | 2026-05-09T00:00:00.000Z
cat_02 | Parents of the Groom | parents-of-the-groom | 20 | TRUE | 2026-05-09T00:00:00.000Z | 2026-05-09T00:00:00.000Z
cat_03 | Principal Sponsors | principal-sponsors | 30 | TRUE | 2026-05-09T00:00:00.000Z | 2026-05-09T00:00:00.000Z
```

`EntourageMembers`:

```text
mem_01 | cat_01 | Juan Dela Cruz | bride | 10 | TRUE |  | 2026-05-09T00:00:00.000Z | 2026-05-09T00:00:00.000Z
mem_02 | cat_01 | Maria Dela Cruz | bride | 20 | TRUE |  | 2026-05-09T00:00:00.000Z | 2026-05-09T00:00:00.000Z
```

Entourage field notes:
- `id`: unique stable id (recommended UUID style, never row number)
- `categoryId`: must match an existing `EntourageCategories.id`
- `slug`: lowercase with hyphen (example: `principal-sponsors`)
- `side`: only `bride`, `groom`, or `none`
- `sortOrder` and `memberOrder`: integer order values (10, 20, 30 recommended)
- `isVisible`: `TRUE` or `FALSE`

## 7. Run Locally

```bash
npm install
npm run dev
```

Open:
- Invite-only RSVP form: `http://localhost:3000` (requires invite link with `invite` + `token`)
- Admin panel: `http://localhost:3000/admin`

Sa admin page:
1. Enter `ADMIN_TOKEN`
2. Click `Connect`
3. You can now view/manage guests and view RSVP submissions.
4. Use guest QR/link actions to send personal RSVP links.

## 8. Deploy (Vercel)

1. Push repo to GitHub.
2. Import project in Vercel.
3. Add the same environment variables sa Vercel Project Settings.
4. Deploy.

Then test:
1. Open guest QR or invite link from admin.
2. Submit RSVP from invite-only page.
2. Confirm row appears in `RSVPs` sheet.
3. Confirm guest status updates in `Guests` sheet.

## 9. Basic Troubleshooting

`Unauthorized` on admin endpoints:
- Check `ADMIN_TOKEN` value in `.env.local` and what you entered in `/admin`.

`Unable to lookup guest` / `Unable to submit RSVP`:
- Confirm Sheets API enabled.
- Confirm sheet shared to service account email.
- Confirm spreadsheet ID and tab names are correct.
- Confirm invite link has both `invite` and `token` values.

`Missing required environment variable`:
- Check all required env vars are set in `.env.local`.
