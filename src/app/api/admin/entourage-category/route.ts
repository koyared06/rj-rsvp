import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateAdmin } from "@/lib/admin-auth";
import {
  ensureEntourageSheets,
  normalizeEntourageSlug,
  readEntourageCategories,
  readEntourageMembers,
} from "@/lib/entourage";
import { getEntourageCategoriesSheetName } from "@/lib/env";
import {
  entourageCategoryToArray,
  type EntourageCategoryRow,
} from "@/lib/sheet-models";
import {
  createEntourageCategorySchema,
  deleteEntourageCategorySchema,
  updateEntourageCategorySchema,
} from "@/lib/schemas";
import { appendRow, deleteRow, updateRow } from "@/lib/sheets";

function hasSlugConflict(
  categories: EntourageCategoryRow[],
  candidateSlug: string,
  excludeId?: string,
) {
  const normalizedCandidate = candidateSlug.trim().toLowerCase();
  return categories.some(
    (item) =>
      item.id !== excludeId &&
      item.slug.trim().toLowerCase() === normalizedCandidate,
  );
}

export async function GET(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [categories, members] = await Promise.all([
      readEntourageCategories(),
      readEntourageMembers(),
    ]);
    const memberCountByCategoryId = new Map<string, number>();

    for (const member of members) {
      memberCountByCategoryId.set(
        member.categoryId,
        (memberCountByCategoryId.get(member.categoryId) ?? 0) + 1,
      );
    }

    const sorted = [...categories].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      categories: sorted.map((category) => ({
        ...category,
        memberCount: memberCountByCategoryId.get(category.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("Get entourage categories error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown categories fetch error.";
    return NextResponse.json(
      {
        error: "Unable to load entourage categories.",
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
    const parsed = createEntourageCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid category payload." },
        { status: 400 },
      );
    }

    await ensureEntourageSheets();

    const payload = parsed.data;
    const categories = await readEntourageCategories();
    const slug = normalizeEntourageSlug(payload.slug ?? payload.name);

    if (hasSlugConflict(categories, slug)) {
      return NextResponse.json(
        { error: "Category slug already exists. Please use a different name." },
        { status: 409 },
      );
    }

    const nowIso = new Date().toISOString();
    const sortOrder =
      payload.sortOrder ??
      Math.max(0, ...categories.map((item) => item.sortOrder), 0) + 10;

    const created = {
      id: randomUUID(),
      name: payload.name,
      slug,
      sortOrder,
      isVisible: payload.isVisible ?? true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await appendRow(
      `${getEntourageCategoriesSheetName()}!A2:G`,
      entourageCategoryToArray(created),
    );

    return NextResponse.json({ ok: true, category: created });
  } catch (error) {
    console.error("Create entourage category error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown category create error.";
    return NextResponse.json(
      {
        error: "Unable to create entourage category.",
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
    const parsed = updateEntourageCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid category update payload." },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const categories = await readEntourageCategories();
    const category = categories.find((item) => item.id === payload.id);

    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const nextSlug = normalizeEntourageSlug(
      payload.slug ?? payload.name ?? category.slug,
    );

    if (hasSlugConflict(categories, nextSlug, category.id)) {
      return NextResponse.json(
        { error: "Category slug already exists. Please use a different slug." },
        { status: 409 },
      );
    }

    const updated = {
      id: category.id,
      name: payload.name ?? category.name,
      slug: nextSlug,
      sortOrder: payload.sortOrder ?? category.sortOrder,
      isVisible: payload.isVisible ?? category.isVisible,
      createdAt: category.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await updateRow(
      getEntourageCategoriesSheetName(),
      category.rowNumber,
      entourageCategoryToArray(updated),
    );

    return NextResponse.json({ ok: true, category: updated });
  } catch (error) {
    console.error("Update entourage category error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown category update error.";
    return NextResponse.json(
      {
        error: "Unable to update entourage category.",
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
    const parsed = deleteEntourageCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid category delete payload." },
        { status: 400 },
      );
    }

    const [categories, members] = await Promise.all([
      readEntourageCategories(),
      readEntourageMembers(),
    ]);
    const category = categories.find((item) => item.id === parsed.data.id);

    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const hasLinkedMembers = members.some(
      (member) => member.categoryId === category.id,
    );

    if (hasLinkedMembers) {
      return NextResponse.json(
        { error: "Category has members. Move or delete members first." },
        { status: 409 },
      );
    }

    await deleteRow(getEntourageCategoriesSheetName(), category.rowNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete entourage category error:", error);
    const details =
      error instanceof Error ? error.message : "Unknown category delete error.";
    return NextResponse.json(
      {
        error: "Unable to delete entourage category.",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
