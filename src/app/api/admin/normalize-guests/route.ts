import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/admin-auth";
import { getGuestsSheetName } from "@/lib/env";
import { guestToArray, toGuestRow } from "@/lib/sheet-models";
import { readRows, updateRow } from "@/lib/sheets";

function generateInviteToken() {
  return randomUUID().replace(/-/g, "");
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sheetName = getGuestsSheetName();
    const rows = await readRows(`${sheetName}!A2:I`);
    const guests = rows.map((row, index) => toGuestRow(row, index + 2));

    let tokenGeneratedCount = 0;

    // Ensure canonical header order for the new schema.
    await updateRow(sheetName, 1, [
      "id",
      "inviteCode",
      "inviteToken",
      "fullName",
      "email",
      "maxGuests",
      "status",
      "lastUpdated",
      "notes",
    ]);

    for (const guest of guests) {
      const inviteToken = guest.inviteToken || generateInviteToken();
      if (!guest.inviteToken) tokenGeneratedCount += 1;

      await updateRow(
        sheetName,
        guest.rowNumber,
        guestToArray({
          id: guest.id,
          inviteCode: guest.inviteCode,
          inviteToken,
          fullName: guest.fullName,
          email: guest.email,
          maxGuests: guest.maxGuests,
          status: guest.status,
          lastUpdated: guest.lastUpdated,
          notes: guest.notes,
        }),
      );
    }

    return NextResponse.json({
      ok: true,
      normalizedRows: guests.length,
      tokenGeneratedCount,
    });
  } catch (error) {
    console.error("Normalize guests error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown normalization error.";
    return NextResponse.json(
      {
        error: "Unable to normalize guest sheet.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}

