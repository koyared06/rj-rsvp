import { NextResponse } from "next/server";
import { getGuestsSheetName } from "@/lib/env";
import { guestLookupSchema } from "@/lib/schemas";
import { toGuestRow } from "@/lib/sheet-models";
import { readRows } from "@/lib/sheets";

export async function POST(request: Request) {
  try {
    if (process.env.PUBLIC_GUEST_LOOKUP !== "true") {
      return NextResponse.json(
        { error: "Public guest lookup is disabled." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = guestLookupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid lookup input." },
        { status: 400 },
      );
    }

    const normalizedQuery = parsed.data.query.toLowerCase();
    const rows = await readRows(`${getGuestsSheetName()}!A2:I`);
    const guests = rows.map((row, index) => toGuestRow(row, index + 2));

    const matches = guests
      .filter((guest) => {
        return (
          guest.fullName.toLowerCase().includes(normalizedQuery) ||
          guest.inviteCode.toLowerCase().includes(normalizedQuery) ||
          guest.email.toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 10);

    return NextResponse.json({ guests: matches });
  } catch (error) {
    console.error("Lookup error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown lookup error.";
    return NextResponse.json(
      {
        error: "Unable to lookup guest right now.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
