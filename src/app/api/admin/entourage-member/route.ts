import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/admin-auth";
import {
  ensureEntourageSheets,
  readEntourageCategories,
  readEntourageMembers,
} from "@/lib/entourage";
import { getEntourageMembersSheetName } from "@/lib/env";
import { entourageMemberToArray } from "@/lib/sheet-models";
import {
  createEntourageMemberSchema,
  deleteEntourageMemberSchema,
  updateEntourageMemberSchema,
} from "@/lib/schemas";
import { appendRow, deleteRow, updateRow } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [members, categories] = await Promise.all([
      readEntourageMembers(),
      readEntourageCategories(),
    ]);

    const sorted = [...members].sort((a, b) => {
      if (a.memberOrder !== b.memberOrder) return a.memberOrder - b.memberOrder;
      return a.fullName.localeCompare(b.fullName);
    });

    return NextResponse.json({
      members: sorted,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        isVisible: category.isVisible,
      })),
    });
  } catch (error) {
    console.error("Get entourage members error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown members fetch error.";
    return NextResponse.json(
      {
        error: "Unable to load entourage members.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createEntourageMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid member payload." },
        { status: 400 },
      );
    }

    await ensureEntourageSheets();

    const payload = parsed.data;
    const [categories, members] = await Promise.all([
      readEntourageCategories(),
      readEntourageMembers(),
    ]);

    const categoryExists = categories.some(
      (category) => category.id === payload.categoryId,
    );

    if (!categoryExists) {
      return NextResponse.json(
        { error: "Selected category does not exist." },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    const memberOrder =
      payload.memberOrder ??
      Math.max(
        0,
        ...members
          .filter((item) => item.categoryId === payload.categoryId)
          .map((item) => item.memberOrder),
      ) + 10;

    const created = {
      id: randomUUID(),
      categoryId: payload.categoryId,
      fullName: payload.fullName,
      side: payload.side ?? "none",
      memberOrder,
      isVisible: payload.isVisible ?? true,
      notes: payload.notes ?? "",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await appendRow(
      `${getEntourageMembersSheetName()}!A2:I`,
      entourageMemberToArray(created),
    );

    return NextResponse.json({ ok: true, member: created });
  } catch (error) {
    console.error("Create entourage member error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown member create error.";
    return NextResponse.json(
      {
        error: "Unable to create entourage member.",
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
    const parsed = updateEntourageMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid member update payload." },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const [categories, members] = await Promise.all([
      readEntourageCategories(),
      readEntourageMembers(),
    ]);

    const member = members.find((item) => item.id === payload.id);
    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const nextCategoryId = payload.categoryId ?? member.categoryId;
    const categoryExists = categories.some((category) => category.id === nextCategoryId);

    if (!categoryExists) {
      return NextResponse.json(
        { error: "Selected category does not exist." },
        { status: 400 },
      );
    }

    const updated = {
      id: member.id,
      categoryId: nextCategoryId,
      fullName: payload.fullName ?? member.fullName,
      side: payload.side ?? member.side,
      memberOrder: payload.memberOrder ?? member.memberOrder,
      isVisible: payload.isVisible ?? member.isVisible,
      notes: payload.notes ?? member.notes,
      createdAt: member.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await updateRow(
      getEntourageMembersSheetName(),
      member.rowNumber,
      entourageMemberToArray(updated),
    );

    return NextResponse.json({ ok: true, member: updated });
  } catch (error) {
    console.error("Update entourage member error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown member update error.";
    return NextResponse.json(
      {
        error: "Unable to update entourage member.",
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
    const parsed = deleteEntourageMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid member delete payload." },
        { status: 400 },
      );
    }

    const members = await readEntourageMembers();
    const member = members.find((item) => item.id === parsed.data.id);

    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    await deleteRow(getEntourageMembersSheetName(), member.rowNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete entourage member error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown member delete error.";
    return NextResponse.json(
      {
        error: "Unable to delete entourage member.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
