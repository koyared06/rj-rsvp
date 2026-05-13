# Disposable Camera Plan (QR-Based, No Invite Link)

Last updated: May 12, 2026

## Goal
- Guests can scan a QR code at the event (entrance/table).
- No invite link required.
- No third-party app install needed.
- Mobile web camera opens directly and allows limited shots (POV/Kululu/GuestCam style).

## What We Decided
- This is possible and recommended for private events.
- We should move from invite-link-only access to event QR session access.
- Shot limits must be enforced on backend (not UI-only).
- Google Drive (Shared Drive) is valid for storage.

## Important Constraint
- Vercel function request/response payload limits still apply.
- Because of that, true unlimited upload size is not recommended in current server-upload architecture.
- Better approach: high-quality but safe size policy, plus optional conditional compression only when needed.

## Current Direction
1. QR-based entry route (example: `/cam?e=EVENT_ID&t=SIGNED_TOKEN`)
2. Server validates token, then creates camera session.
3. Camera-first guest flow:
   - Open camera
   - Capture shot
   - Show remaining shots
   - Upload to event feed
4. Enforce shot limit by session/table/event rules on backend.
5. Keep moderation + visibility schedule options for private event.

## Recommended Access Modes
1. One QR for whole event (simplest)
2. One QR per table (recommended for control)
3. Entrance QR + table QR (best control + flexibility)

## What Was Already Implemented Before This Pivot
- Existing guest camera with upload flow.
- Browser camera capture + upload UI.
- Shot counter plumbing and backend shot-limit setting support.
- Admin settings for camera max upload and shot limit.

## Next Steps For Tomorrow
1. Finalize QR mode (single event QR vs per-table QR vs both).
2. Add new camera access route that does not require invite link.
3. Add signed QR token validation + session creation.
4. Bind shot limits to selected mode (session/table/event).
5. Update admin UI to generate/manage camera QR links.
6. End-to-end test on mobile scan flow.

## Open Decisions
- Which QR mode to use for launch?
- Exact shot limit default (e.g., 12, 27, or custom)?
- Approval mode default: auto publish or requires approval?
- Gallery reveal schedule: immediate or date/time unlock?
