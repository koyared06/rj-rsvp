import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/admin-auth";
import { getGuestsSheetName, getRsvpsSheetName } from "@/lib/env";
import { updateWeddingDateSchema } from "@/lib/schemas";
import { guestToArray, toGuestRow, toRsvpRow } from "@/lib/sheet-models";
import { readRows, updateRow } from "@/lib/sheets";
import { readEntourageSnapshot } from "@/lib/entourage";
import {
  calculateCountdownDays,
  readWeddingSettings,
  saveWeddingSettings,
} from "@/lib/wedding-settings";

export async function GET(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [guestRows, rsvpRows, weddingSettings, entourageSnapshot] = await Promise.all([
      readRows(`${getGuestsSheetName()}!A2:I`),
      readRows(`${getRsvpsSheetName()}!A2:K`),
      readWeddingSettings(),
      readEntourageSnapshot(),
    ]);

    const guests = guestRows.map((row, index) => toGuestRow(row, index + 2));
    for (const guest of guests) {
      if (!guest.inviteToken) {
        guest.inviteToken = randomUUID().replace(/-/g, "");
        await updateRow(
          getGuestsSheetName(),
          guest.rowNumber,
          guestToArray({
            id: guest.id,
            inviteCode: guest.inviteCode,
            inviteToken: guest.inviteToken,
            fullName: guest.fullName,
            email: guest.email,
            maxGuests: guest.maxGuests,
            status: guest.status,
            lastUpdated: guest.lastUpdated,
            notes: guest.notes,
          }),
        );
      }
    }
    const rsvps = rsvpRows.map((row, index) => toRsvpRow(row, index + 2));

    const stats = {
      totalGuests: guests.length,
      pending: guests.filter((guest) => guest.status === "pending").length,
      attending: guests.filter((guest) => guest.status === "attending").length,
      declined: guests.filter((guest) => guest.status === "declined").length,
      responses: rsvps.length,
    };

    return NextResponse.json({
      guests,
      rsvps,
      stats,
      entourage: {
        categories: entourageSnapshot.categories,
        members: entourageSnapshot.members,
      },
      settings: {
        weddingDate: weddingSettings.weddingDate,
        weddingTime: weddingSettings.weddingTime,
        showCountdown: weddingSettings.showCountdown,
        cameraEnabled: weddingSettings.cameraEnabled,
        cameraRequireApproval: weddingSettings.cameraRequireApproval,
        cameraGalleryUnlockDate: weddingSettings.cameraGalleryUnlockDate,
        cameraGalleryUnlockTime: weddingSettings.cameraGalleryUnlockTime,
        cameraMaxUploadMb: weddingSettings.cameraMaxUploadMb,
        cameraShotLimitPerInvite: weddingSettings.cameraShotLimitPerInvite,
        cameraLandingEnabled: weddingSettings.cameraLandingEnabled,
        cameraEventTitle: weddingSettings.cameraEventTitle,
        cameraEventSubtitle: weddingSettings.cameraEventSubtitle,
        cameraCoverImageUrl: weddingSettings.cameraCoverImageUrl,
        cameraStartButtonLabel: weddingSettings.cameraStartButtonLabel,
        countdownDays: calculateCountdownDays(weddingSettings.weddingDate),
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown admin dashboard error.";
    return NextResponse.json(
      {
        error: "Unable to load dashboard data.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateWeddingDateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid settings payload." },
        { status: 400 },
      );
    }

    const currentSettings = await readWeddingSettings();
    const weddingDate = parsed.data.weddingDate;
    const weddingTime = parsed.data.weddingTime ?? currentSettings.weddingTime;
    const showCountdown = parsed.data.showCountdown ?? currentSettings.showCountdown;
    const cameraEnabled = parsed.data.cameraEnabled ?? currentSettings.cameraEnabled;
    const cameraRequireApproval =
      parsed.data.cameraRequireApproval ?? currentSettings.cameraRequireApproval;
    const cameraGalleryUnlockDate =
      parsed.data.cameraGalleryUnlockDate ?? currentSettings.cameraGalleryUnlockDate;
    const cameraGalleryUnlockTime =
      parsed.data.cameraGalleryUnlockTime ?? currentSettings.cameraGalleryUnlockTime;
    const cameraMaxUploadMb =
      parsed.data.cameraMaxUploadMb ?? currentSettings.cameraMaxUploadMb;
    const cameraShotLimitPerInvite =
      parsed.data.cameraShotLimitPerInvite ?? currentSettings.cameraShotLimitPerInvite;

    await saveWeddingSettings({
      weddingDate,
      weddingTime,
      showCountdown,
      cameraEnabled,
      cameraRequireApproval,
      cameraGalleryUnlockDate,
      cameraGalleryUnlockTime,
      cameraMaxUploadMb,
      cameraShotLimitPerInvite,
      cameraLandingEnabled: currentSettings.cameraLandingEnabled,
      cameraEventTitle: currentSettings.cameraEventTitle,
      cameraEventSubtitle: currentSettings.cameraEventSubtitle,
      cameraCoverImageUrl: currentSettings.cameraCoverImageUrl,
      cameraStartButtonLabel: currentSettings.cameraStartButtonLabel,
    });
    const updatedSettings = await readWeddingSettings();

    return NextResponse.json({
      ok: true,
      settings: {
        weddingDate: updatedSettings.weddingDate,
        weddingTime: updatedSettings.weddingTime,
        showCountdown: updatedSettings.showCountdown,
        cameraEnabled: updatedSettings.cameraEnabled,
        cameraRequireApproval: updatedSettings.cameraRequireApproval,
        cameraGalleryUnlockDate: updatedSettings.cameraGalleryUnlockDate,
        cameraGalleryUnlockTime: updatedSettings.cameraGalleryUnlockTime,
        cameraMaxUploadMb: updatedSettings.cameraMaxUploadMb,
        cameraShotLimitPerInvite: updatedSettings.cameraShotLimitPerInvite,
        cameraLandingEnabled: updatedSettings.cameraLandingEnabled,
        cameraEventTitle: updatedSettings.cameraEventTitle,
        cameraEventSubtitle: updatedSettings.cameraEventSubtitle,
        cameraCoverImageUrl: updatedSettings.cameraCoverImageUrl,
        cameraStartButtonLabel: updatedSettings.cameraStartButtonLabel,
        countdownDays: calculateCountdownDays(updatedSettings.weddingDate),
      },
    });
  } catch (error) {
    console.error("Admin settings update error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown admin settings update error.";
    return NextResponse.json(
      {
        error: "Unable to update dashboard settings.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
