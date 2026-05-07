import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/admin-auth";
import { getGuestsSheetName, getRsvpsSheetName } from "@/lib/env";
import { createGuestSchema, deleteGuestSchema, updateGuestSchema } from "@/lib/schemas";
import { guestToArray, toGuestRow, toRsvpRow } from "@/lib/sheet-models";
import { appendRow, deleteRow, readRows, updateRow } from "@/lib/sheets";

function generateInviteCode(existingCodes: Set<string>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const code = `RJ${new Date().getFullYear()}-${suffix}`;
    if (!existingCodes.has(code)) {
      return code;
    }
  }

  return `RJ${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function generateInviteToken() {
  return randomUUID().replace(/-/g, "");
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createGuestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid guest payload." },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const nowIso = new Date().toISOString();
    const rows = await readRows(`${getGuestsSheetName()}!A2:I`);
    const guests = rows.map((row, index) => toGuestRow(row, index + 2));
    const existingCodes = new Set(guests.map((guest) => guest.inviteCode.trim().toUpperCase()));
    const normalizedInputCode = (payload.inviteCode ?? "").trim().toUpperCase();
    const inviteCode = normalizedInputCode || generateInviteCode(existingCodes);

    if (existingCodes.has(inviteCode)) {
      return NextResponse.json(
        { error: "Invite code already exists. Please use a different one." },
        { status: 409 },
      );
    }

    await appendRow(`${getGuestsSheetName()}!A2:I`, [
      randomUUID(),
      inviteCode,
      generateInviteToken(),
      payload.fullName,
      payload.email ?? "",
      String(payload.maxGuests),
      "pending",
      nowIso,
      payload.notes ?? "",
    ]);

    return NextResponse.json({ ok: true, inviteCode });
  } catch (error) {
    console.error("Create guest error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown create guest error.";
    return NextResponse.json(
      {
        error: "Unable to create guest.",
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
    const parsed = updateGuestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update payload." },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const rows = await readRows(`${getGuestsSheetName()}!A2:I`);
    const guests = rows.map((row, index) => toGuestRow(row, index + 2));
    const guest = guests.find((item) => item.rowNumber === payload.rowNumber);

    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const updated = {
      id: guest.id,
      inviteCode: guest.inviteCode,
      inviteToken: guest.inviteToken || generateInviteToken(),
      fullName: payload.fullName ?? guest.fullName,
      email: payload.email ?? guest.email,
      maxGuests: payload.maxGuests ?? guest.maxGuests,
      status: payload.status ?? guest.status,
      lastUpdated: nowIso,
      notes: payload.notes ?? guest.notes,
    };

    await updateRow(getGuestsSheetName(), guest.rowNumber, guestToArray(updated));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update guest error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown update guest error.";
    return NextResponse.json(
      {
        error: "Unable to update guest.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = deleteGuestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid delete payload." },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const guestRows = await readRows(`${getGuestsSheetName()}!A2:I`);
    const guests = guestRows.map((row, index) => toGuestRow(row, index + 2));
    const guest = guests.find((item) => item.rowNumber === payload.rowNumber);

    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }

    const rsvpRows = await readRows(`${getRsvpsSheetName()}!A2:J`);
    const hasRsvp = rsvpRows
      .map((row, index) => toRsvpRow(row, index + 2))
      .some(
        (rsvp) =>
          rsvp.inviteCode.trim().toLowerCase() === guest.inviteCode.trim().toLowerCase(),
      );

    if (hasRsvp) {
      return NextResponse.json(
        {
          error:
            "Cannot delete guest with existing RSVP submission. Update status instead.",
        },
        { status: 409 },
      );
    }

    await deleteRow(getGuestsSheetName(), guest.rowNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete guest error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown delete guest error.";
    return NextResponse.json(
      {
        error: "Unable to delete guest.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
