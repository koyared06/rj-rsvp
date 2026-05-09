import { NextResponse } from "next/server";
import { readEntourageSnapshot } from "@/lib/entourage";

export async function GET() {
  try {
    const snapshot = await readEntourageSnapshot({ publicOnly: true });
    return NextResponse.json({ categories: snapshot.grouped });
  } catch (error) {
    console.error("RSVP entourage error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown RSVP entourage error.";
    return NextResponse.json(
      {
        error: "Unable to load entourage.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
