import { NextResponse } from "next/server";
import { getGuestsSheetName } from "@/lib/env";
import { toGuestRow } from "@/lib/sheet-models";
import { readRows } from "@/lib/sheets";
import { calculateCountdownDays, readWeddingSettings } from "@/lib/wedding-settings";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const invite = (url.searchParams.get("invite") ?? "").trim();
    const token = (url.searchParams.get("token") ?? "").trim();

    if (!invite || !token) {
      return NextResponse.json(
        { error: "Missing invitation parameters." },
        { status: 400 },
      );
    }

    const [rows, weddingSettings] = await Promise.all([
      readRows(`${getGuestsSheetName()}!A2:I`),
      readWeddingSettings(),
    ]);
    const guests = rows.map((row, index) => toGuestRow(row, index + 2));
    const guest = guests.find(
      (item) =>
        item.inviteCode.trim().toLowerCase() === invite.toLowerCase() &&
        item.inviteToken.trim().toLowerCase() === token.toLowerCase(),
    );

    if (!guest) {
      return NextResponse.json({ error: "Invalid invitation link." }, { status: 404 });
    }

    return NextResponse.json({
      guest: {
        rowNumber: guest.rowNumber,
        id: guest.id,
        inviteCode: guest.inviteCode,
        fullName: guest.fullName,
        email: guest.email,
        maxGuests: guest.maxGuests,
        status: guest.status,
        lastUpdated: guest.lastUpdated,
        notes: guest.notes,
      },
      settings: {
        weddingDate: weddingSettings.weddingDate,
        weddingTime: weddingSettings.weddingTime,
        showCountdown: weddingSettings.showCountdown,
        countdownDays: calculateCountdownDays(weddingSettings.weddingDate),
      },
    });
  } catch (error) {
    console.error("RSVP access error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown RSVP access error.";
    return NextResponse.json(
      {
        error: "Unable to validate invitation link.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
