type RequiredEnvKey =
  | "GOOGLE_SERVICE_ACCOUNT_EMAIL"
  | "GOOGLE_PRIVATE_KEY"
  | "GOOGLE_SHEETS_SPREADSHEET_ID";

function getRequiredEnv(name: RequiredEnvKey): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSheetsEnv() {
  return {
    serviceAccountEmail: getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: getRequiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    spreadsheetId: getRequiredEnv("GOOGLE_SHEETS_SPREADSHEET_ID"),
  };
}

export function getGuestsSheetName() {
  return process.env.GOOGLE_SHEETS_GUESTS_TAB ?? "Guests";
}

export function getRsvpsSheetName() {
  return process.env.GOOGLE_SHEETS_RSVPS_TAB ?? "RSVPs";
}

export function getSettingsSheetName() {
  return process.env.GOOGLE_SHEETS_SETTINGS_TAB ?? "Settings";
}

export function getEntourageCategoriesSheetName() {
  return process.env.GOOGLE_SHEETS_ENTOURAGE_CATEGORIES_TAB ?? "EntourageCategories";
}

export function getEntourageMembersSheetName() {
  return process.env.GOOGLE_SHEETS_ENTOURAGE_MEMBERS_TAB ?? "EntourageMembers";
}
