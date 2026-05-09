export type GuestRow = {
  rowNumber: number;
  id: string;
  inviteCode: string;
  inviteToken: string;
  fullName: string;
  email: string;
  maxGuests: number;
  status: string;
  lastUpdated: string;
  notes: string;
};

export type RsvpRow = {
  rowNumber: number;
  timestamp: string;
  inviteCode: string;
  fullName: string;
  email: string;
  attendance: string;
  guestCount: number;
  dietaryRestrictions: string;
  songRequest: string;
  message: string;
  companionNames: string;
  source: string;
};

function normalizeNumber(value: string | undefined, fallback = 0) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cell(row: string[], index: number) {
  return row[index] ?? "";
}

function looksLikeInviteToken(value: string) {
  return /^[a-f0-9]{32}$/i.test((value ?? "").trim());
}

export function toGuestRow(row: string[], rowNumber: number): GuestRow {
  const col2 = cell(row, 2);
  const isNewFormat = looksLikeInviteToken(col2);

  if (!isNewFormat) {
    // Legacy format (without inviteToken column):
    // id, inviteCode, fullName, email, maxGuests, status, lastUpdated, notes
    return {
      rowNumber,
      id: cell(row, 0),
      inviteCode: cell(row, 1),
      inviteToken: "",
      fullName: cell(row, 2),
      email: cell(row, 3),
      maxGuests: normalizeNumber(cell(row, 4), 1),
      status: cell(row, 5) || "pending",
      lastUpdated: cell(row, 6),
      notes: cell(row, 7),
    };
  }

  return {
    rowNumber,
    id: cell(row, 0),
    inviteCode: cell(row, 1),
    inviteToken: cell(row, 2),
    fullName: cell(row, 3),
    email: cell(row, 4),
    maxGuests: normalizeNumber(cell(row, 5), 1),
    status: cell(row, 6) || "pending",
    lastUpdated: cell(row, 7),
    notes: cell(row, 8),
  };
}

export function toRsvpRow(row: string[], rowNumber: number): RsvpRow {
  // Current format (without dietary/song):
  // timestamp,inviteCode,fullName,email,attendance,guestCount,message,companionNames,source
  // Previous format:
  // timestamp,inviteCode,fullName,email,attendance,guestCount,dietaryRestrictions,songRequest,message,companionNames,source
  // Legacy format:
  // timestamp,inviteCode,fullName,email,attendance,guestCount,dietaryRestrictions,songRequest,message,source
  const hasDietaryAndSongColumns = row.length >= 10;
  const hasCompanionColumn = row.length >= 11 || (!hasDietaryAndSongColumns && row.length >= 9);

  return {
    rowNumber,
    timestamp: cell(row, 0),
    inviteCode: cell(row, 1),
    fullName: cell(row, 2),
    email: cell(row, 3),
    attendance: cell(row, 4),
    guestCount: normalizeNumber(cell(row, 5), 0),
    dietaryRestrictions: hasDietaryAndSongColumns ? cell(row, 6) : "",
    songRequest: hasDietaryAndSongColumns ? cell(row, 7) : "",
    message: hasDietaryAndSongColumns ? cell(row, 8) : cell(row, 6),
    companionNames: hasCompanionColumn
      ? hasDietaryAndSongColumns
        ? cell(row, 9)
        : cell(row, 7)
      : "",
    source: hasCompanionColumn
      ? hasDietaryAndSongColumns
        ? cell(row, 10)
        : cell(row, 8)
      : hasDietaryAndSongColumns
        ? cell(row, 9)
        : "",
  };
}

export function guestToArray(guest: Omit<GuestRow, "rowNumber">): string[] {
  return [
    guest.id,
    guest.inviteCode,
    guest.inviteToken,
    guest.fullName,
    guest.email,
    String(guest.maxGuests),
    guest.status,
    guest.lastUpdated,
    guest.notes,
  ];
}
