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
- `http://localhost:3000/admin/camera` (dedicated camera studio admin)

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

Camera-related `Settings` keys (stored in same tab):

```text
cameraEnabled | cameraRequireApproval | cameraGalleryUnlockDate | cameraGalleryUnlockTime | cameraMaxUploadMb | cameraShotLimitPerInvite
```

Notes:
- `cameraMaxUploadMb=0` means no app-level upload cap (platform limits still apply in production).
- `cameraShotLimitPerInvite=0` means unlimited shots per invite.

Camera Drive + watermark env options:

```text
GOOGLE_DRIVE_CAMERA_FOLDER_ID
GOOGLE_DRIVE_FOLDER_ID (legacy alias fallback)
GOOGLE_DRIVE_SHARED_DRIVE_ID
GOOGLE_DRIVE_CAMERA_ORIGINALS_FOLDER_NAME (default: originals)
GOOGLE_DRIVE_CAMERA_PREVIEWS_FOLDER_NAME (default: previews)
CAMERA_WATERMARK_LINE_1 (default: Red & Jess)
CAMERA_WATERMARK_LINE_2 (default: #soaferRED-ynasiJESS)
```

Notes:
- Uploads are now saved to `originals/` and `previews/` subfolders under your configured camera folder.
- Watermark text is applied server-side to every saved image.

`CameraPhotos` headers:

```text
id | createdAt | inviteCode | uploaderName | driveFileId | previewDriveFileId | mimeType | fileSizeBytes | width | height | status | visibilityAt | rejectionReason | hiddenAt
```

## Invite-Only Mode

Guests should open RSVP links in this format:

```text
/?invite=RJ2026-XXXXXX&token=INVITE_TOKEN
```

You can generate and share these links/QRs from `/admin`.
