import {
  getEntourageCategoriesSheetName,
  getEntourageMembersSheetName,
} from "@/lib/env";
import {
  type EntourageCategoryRow,
  type EntourageMemberRow,
  toEntourageCategoryRow,
  toEntourageMemberRow,
} from "@/lib/sheet-models";
import { ensureSheetWithHeaders, readRows } from "@/lib/sheets";

export const ENTOURAGE_CATEGORY_HEADERS = [
  "id",
  "name",
  "slug",
  "sortOrder",
  "isVisible",
  "createdAt",
  "updatedAt",
];

export const ENTOURAGE_MEMBER_HEADERS = [
  "id",
  "categoryId",
  "fullName",
  "side",
  "memberOrder",
  "isVisible",
  "notes",
  "createdAt",
  "updatedAt",
];

export type EntourageCategoryWithMembers = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isVisible: boolean;
  members: Array<{
    id: string;
    fullName: string;
    side: "bride" | "groom" | "none";
    memberOrder: number;
    isVisible: boolean;
    notes: string;
  }>;
};

function isMissingSheetError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unable to parse range") ||
    normalized.includes("requested entity was not found") ||
    (normalized.includes("sheet") && normalized.includes("not found"))
  );
}

export function normalizeEntourageSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "category";
}

export async function ensureEntourageSheets() {
  await ensureSheetWithHeaders(
    getEntourageCategoriesSheetName(),
    ENTOURAGE_CATEGORY_HEADERS,
  );
  await ensureSheetWithHeaders(
    getEntourageMembersSheetName(),
    ENTOURAGE_MEMBER_HEADERS,
  );
}

export async function readEntourageCategories(): Promise<EntourageCategoryRow[]> {
  try {
    const rows = await readRows(`${getEntourageCategoriesSheetName()}!A2:G`);
    return rows
      .map((row, index) => toEntourageCategoryRow(row, index + 2))
      .filter((row) => row.id.trim() && row.name.trim())
      .map((row) => ({
        ...row,
        slug: row.slug.trim() || normalizeEntourageSlug(row.name),
      }));
  } catch (error) {
    if (isMissingSheetError(error)) return [];
    throw error;
  }
}

export async function readEntourageMembers(): Promise<EntourageMemberRow[]> {
  try {
    const rows = await readRows(`${getEntourageMembersSheetName()}!A2:I`);
    return rows
      .map((row, index) => toEntourageMemberRow(row, index + 2))
      .filter((row) => row.id.trim() && row.categoryId.trim() && row.fullName.trim());
  } catch (error) {
    if (isMissingSheetError(error)) return [];
    throw error;
  }
}

function sortCategories(a: EntourageCategoryRow, b: EntourageCategoryRow) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

function sortMembers(a: EntourageMemberRow, b: EntourageMemberRow) {
  if (a.memberOrder !== b.memberOrder) return a.memberOrder - b.memberOrder;
  return a.fullName.localeCompare(b.fullName);
}

export async function readEntourageSnapshot(options?: { publicOnly?: boolean }) {
  const publicOnly = options?.publicOnly ?? false;
  const [categories, members] = await Promise.all([
    readEntourageCategories(),
    readEntourageMembers(),
  ]);

  const categoryRows = [...categories].sort(sortCategories);
  const memberRows = [...members].sort(sortMembers);
  const membersByCategoryId = new Map<string, EntourageMemberRow[]>();

  for (const member of memberRows) {
    if (publicOnly && !member.isVisible) continue;
    const bucket = membersByCategoryId.get(member.categoryId) ?? [];
    bucket.push(member);
    membersByCategoryId.set(member.categoryId, bucket);
  }

  const result: EntourageCategoryWithMembers[] = [];

  for (const category of categoryRows) {
    if (publicOnly && !category.isVisible) continue;

    const categoryMembers = membersByCategoryId.get(category.id) ?? [];
    if (publicOnly && categoryMembers.length === 0) {
      continue;
    }

    result.push({
      id: category.id,
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
      isVisible: category.isVisible,
      members: categoryMembers.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        side: member.side,
        memberOrder: member.memberOrder,
        isVisible: member.isVisible,
        notes: member.notes,
      })),
    });
  }

  return {
    categories,
    members,
    grouped: result,
  };
}
