import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  Attachment,
  Exercise,
  FollowUpItem,
  Hide,
  Location,
  RevisionEntry,
  SearchTypeDef,
  TrainingSession
} from "./types";

export const APP_VERSION = "1.0.0";

/**
 * Local-first database. Dexie versioning is the migration mechanism:
 * bump the version number and provide an upgrade function for any
 * future schema change. Never edit an existing version block.
 */
export class EsdK9Db extends Dexie {
  settings!: Table<AppSettings, string>;
  sessions!: Table<TrainingSession, string>;
  exercises!: Table<Exercise, string>;
  hides!: Table<Hide, string>;
  locations!: Table<Location, string>;
  searchTypes!: Table<SearchTypeDef, string>;
  revisions!: Table<RevisionEntry, string>;
  attachments!: Table<Attachment, string>;
  followUps!: Table<FollowUpItem, string>;

  constructor(name = "esd-k9-logs") {
    super(name);
    this.version(1).stores({
      settings: "id",
      sessions: "id, date, status, locationName, trainerName, updatedAt",
      exercises: "id, sessionId, searchTypeId, [sessionId+order]",
      hides: "id, exerciseId, sessionId, outcome",
      locations: "id, name, favorite, lastUsedAt",
      searchTypes: "id, label",
      revisions: "id, sessionId, timestamp",
      attachments: "id, sessionId, exerciseId",
      followUps: "id, sessionId, done, createdAt"
    });
  }
}

export const db = new EsdK9Db();

export const nowIso = () => new Date().toISOString();
export const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Built-in search types. Users can add custom ones in Settings. */
export const BUILT_IN_SEARCH_TYPES: SearchTypeDef[] = [
  { id: "room", label: "Room / building search", builtIn: true, archived: false },
  { id: "vehicle", label: "Vehicle search", builtIn: true, archived: false },
  { id: "parcel", label: "Parcel / luggage / mail", builtIn: true, archived: false },
  { id: "boxes", label: "Training boxes", builtIn: true, archived: false },
  { id: "outdoor", label: "Outdoor / open area", builtIn: true, archived: false },
  { id: "water", label: "Water / shoreline", builtIn: true, archived: false },
  { id: "furniture", label: "Furniture / object search", builtIn: true, archived: false },
  { id: "cluttered", label: "Cluttered environment", builtIn: true, archived: false },
  { id: "elevated", label: "Elevated hide", builtIn: true, archived: false },
  { id: "buried", label: "Buried / concealed hide", builtIn: true, archived: false },
  { id: "blank", label: "Blank / negative search", builtIn: true, archived: false }
];

export const ROOM_TYPES = [
  "Residence",
  "Office",
  "School / classroom",
  "Commercial building",
  "Warehouse",
  "Jail / correctional",
  "Hotel room",
  "Storage unit",
  "Other"
];

export async function ensureSearchTypes(database: EsdK9Db = db) {
  const count = await database.searchTypes.count();
  if (count === 0) {
    // bulkPut is idempotent — safe under StrictMode double-invocation
    await database.searchTypes.bulkPut(BUILT_IN_SEARCH_TYPES);
  }
}

export function defaultSettings(): AppSettings {
  return {
    id: "app",
    onboarded: false,
    agency: "",
    unit: "",
    handlerName: "",
    handlerId: "",
    k9Name: "",
    k9Breed: "",
    k9Dob: "",
    k9Id: "",
    targetOdor: "TPPO (electronic storage devices)",
    trainerOrg: "",
    initialCertDate: "",
    currentCertDate: "",
    certExpirationDate: "",
    agencyLogoDataUrl: "",
    theme: "system",
    dateFormat: "MM/dd/yyyy",
    reportHeader: "",
    reportFooter: "",
    includeIdentityInExports: true,
    includeAttachmentsInExports: false,
    appPin: "",
    autoLockMinutes: 0,
    updatedAt: nowIso()
  };
}

export async function getSettings(database: EsdK9Db = db): Promise<AppSettings> {
  const s = await database.settings.get("app");
  if (s) return s;
  const d = defaultSettings();
  await database.settings.put(d);
  return d;
}
