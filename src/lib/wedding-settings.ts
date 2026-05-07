import { getSettingsSheetName } from "@/lib/env";
import {
  appendRow,
  ensureSheetWithHeaders,
  readRows,
  updateRow,
} from "@/lib/sheets";

const SETTINGS_HEADERS = ["key", "value"];
const WEDDING_DATE_KEY = "weddingDate";
const WEDDING_TIME_KEY = "weddingTime";
const SHOW_COUNTDOWN_KEY = "showCountdown";
const DEFAULT_WEDDING_TIME = "16:00";

export type WeddingSettings = {
  weddingDate: string;
  weddingTime: string;
  showCountdown: boolean;
};

function isMissingSheetError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unable to parse range") ||
    normalized.includes("requested entity was not found") ||
    normalized.includes("sheet") && normalized.includes("not found")
  );
}

export async function readWeddingSettings(): Promise<WeddingSettings> {
  try {
    const rows = await readRows(`${getSettingsSheetName()}!A2:B`);
    const normalized = new Map(
      rows
        .filter((row) => (row[0] ?? "").trim())
        .map((row) => [(row[0] ?? "").trim(), (row[1] ?? "").trim()]),
    );

    return {
      weddingDate: normalized.get(WEDDING_DATE_KEY) ?? "",
      weddingTime: normalizeWeddingTime(normalized.get(WEDDING_TIME_KEY) ?? ""),
      showCountdown: parseShowCountdown(normalized.get(SHOW_COUNTDOWN_KEY) ?? ""),
    };
  } catch (error) {
    if (isMissingSheetError(error)) {
      return {
        weddingDate: "",
        weddingTime: DEFAULT_WEDDING_TIME,
        showCountdown: true,
      };
    }
    throw error;
  }
}

export async function saveWeddingSettings(settings: WeddingSettings) {
  const sheetName = getSettingsSheetName();
  await ensureSheetWithHeaders(sheetName, SETTINGS_HEADERS);

  const rows = await readRows(`${sheetName}!A2:B`);
  const normalizedRows = rows.map((row) => (row[0] ?? "").trim().toLowerCase());

  const entries: Array<[string, string]> = [
    [WEDDING_DATE_KEY, settings.weddingDate],
    [WEDDING_TIME_KEY, normalizeWeddingTime(settings.weddingTime)],
    [SHOW_COUNTDOWN_KEY, settings.showCountdown ? "true" : "false"],
  ];

  for (const [key, value] of entries) {
    const existingIndex = normalizedRows.findIndex(
      (rowKey) => rowKey === key.toLowerCase(),
    );

    if (existingIndex >= 0) {
      await updateRow(sheetName, existingIndex + 2, [key, value]);
      continue;
    }

    await appendRow(`${sheetName}!A2:B`, [key, value]);
  }
}

function normalizeWeddingTime(value: string): string {
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return value;
  }
  return DEFAULT_WEDDING_TIME;
}

function parseShowCountdown(value: string): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return !["false", "0", "no", "off"].includes(normalized);
}

function parseIsoDate(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day;

  return isValid ? utcDate : null;
}

export function calculateCountdownDays(weddingDate: string): number | null {
  const target = parseIsoDate(weddingDate);
  if (!target) return null;

  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const weddingUtc = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );

  return Math.round((weddingUtc - todayUtc) / (1000 * 60 * 60 * 24));
}
