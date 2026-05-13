import { NextResponse } from "next/server";
import {
  calculateCountdownDays,
  readWeddingSettings,
} from "@/lib/wedding-settings";

export async function GET() {
  try {
    const settings = await readWeddingSettings();
    return NextResponse.json({
      settings: {
        weddingDate: settings.weddingDate,
        weddingTime: settings.weddingTime,
        showCountdown: settings.showCountdown,
        cameraEnabled: settings.cameraEnabled,
        cameraRequireApproval: settings.cameraRequireApproval,
        cameraGalleryUnlockDate: settings.cameraGalleryUnlockDate,
        cameraGalleryUnlockTime: settings.cameraGalleryUnlockTime,
        cameraMaxUploadMb: settings.cameraMaxUploadMb,
        cameraShotLimitPerInvite: settings.cameraShotLimitPerInvite,
        countdownDays: calculateCountdownDays(settings.weddingDate),
      },
    });
  } catch (error) {
    console.error("RSVP settings error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown RSVP settings error.";
    return NextResponse.json(
      {
        error: "Unable to load RSVP settings.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
