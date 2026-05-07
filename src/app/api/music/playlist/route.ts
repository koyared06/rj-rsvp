import { NextResponse } from "next/server";
import { readMusicPlaylist } from "@/lib/music-playlist";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tracks = await readMusicPlaylist();
    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("Music playlist error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown music playlist error.";
    return NextResponse.json(
      {
        error: "Unable to load music playlist.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
