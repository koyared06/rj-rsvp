import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { resolveTrackPath } from "@/lib/music-playlist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const fileNameParam = url.searchParams.get("file") ?? "";
    const trackPath = resolveTrackPath(fileNameParam);

    if (!trackPath) {
      return NextResponse.json({ error: "Invalid music file." }, { status: 400 });
    }

    const audioBuffer = await fs.readFile(trackPath);
    const fileName = path.basename(trackPath);

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Music stream error:", error);
    const details = error instanceof Error ? error.message : "Unknown music stream error.";
    return NextResponse.json(
      {
        error: "Unable to stream music file.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
