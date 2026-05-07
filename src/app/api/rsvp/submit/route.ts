import { NextResponse } from "next/server";
import { getGuestsSheetName, getRsvpsSheetName } from "@/lib/env";
import { rsvpSubmitSchema } from "@/lib/schemas";
import { guestToArray, toGuestRow, toRsvpRow } from "@/lib/sheet-models";
import { appendRow, readRows, updateRow } from "@/lib/sheets";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = rsvpSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid RSVP payload." },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const nowIso = new Date().toISOString();

    const guestsRange = `${getGuestsSheetName()}!A2:I`;
    const guestRows = await readRows(guestsRange);
    const guests = guestRows.map((row, index) => toGuestRow(row, index + 2));
    const matchingGuest = guests.find((guest) => {
      const byInvite = guest.inviteCode.toLowerCase() === payload.inviteCode.toLowerCase();
      const byName = guest.fullName.toLowerCase() === payload.fullName.toLowerCase();
      const byToken = guest.inviteToken.toLowerCase() === payload.inviteToken.toLowerCase();
      return byInvite && byName && byToken;
    });

    if (!matchingGuest) {
      return NextResponse.json(
        {
          error:
            "Guest record not found. Please check your invite code and full name.",
        },
        { status: 404 },
      );
    }

    if (payload.attendance === "attending" && payload.guestCount > matchingGuest.maxGuests) {
      return NextResponse.json(
        { error: `Your invite allows up to ${matchingGuest.maxGuests} guests.` },
        { status: 400 },
      );
    }

    const expectedCompanionCount =
      payload.attendance === "attending" ? Math.max(0, payload.guestCount - 1) : 0;
    const normalizedCompanionNames = (payload.companionNames ?? [])
      .map((name) => name.trim())
      .filter(Boolean);

    if (normalizedCompanionNames.length !== expectedCompanionCount) {
      return NextResponse.json(
        {
          error:
            expectedCompanionCount === 0
              ? "No companion names are needed for this RSVP."
              : `Please provide ${expectedCompanionCount} companion name(s).`,
        },
        { status: 400 },
      );
    }

    const rsvpSheetName = getRsvpsSheetName();
    const rsvpRows = await readRows(`${rsvpSheetName}!A2:K`);
    const existingRsvp = rsvpRows
      .map((row, index) => toRsvpRow(row, index + 2))
      .find(
        (row) =>
          row.inviteCode.trim().toLowerCase() === payload.inviteCode.trim().toLowerCase(),
      );

    const rsvpValues = [
      nowIso,
      payload.inviteCode,
      payload.fullName,
      payload.email ?? "",
      payload.attendance,
      String(payload.guestCount),
      payload.dietaryRestrictions ?? "",
      payload.songRequest ?? "",
      payload.message ?? "",
      normalizedCompanionNames.join(" | "),
      "web-form",
    ];

    if (existingRsvp) {
      await updateRow(rsvpSheetName, existingRsvp.rowNumber, rsvpValues);
    } else {
      await appendRow(`${rsvpSheetName}!A2:K`, rsvpValues);
    }

    await updateRow(
      getGuestsSheetName(),
      matchingGuest.rowNumber,
      guestToArray({
        id: matchingGuest.id,
        inviteCode: matchingGuest.inviteCode,
        inviteToken: matchingGuest.inviteToken,
        fullName: matchingGuest.fullName,
        email: payload.email || matchingGuest.email,
        maxGuests: matchingGuest.maxGuests,
        status: payload.attendance,
        lastUpdated: nowIso,
        notes: matchingGuest.notes,
      }),
    );

    return NextResponse.json({
      ok: true,
      replaced: Boolean(existingRsvp),
      submittedAt: nowIso,
    });
  } catch (error) {
    console.error("RSVP submit error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown RSVP submit error.";
    return NextResponse.json(
      {
        error: "Unable to submit RSVP right now.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
