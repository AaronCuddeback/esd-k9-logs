/**
 * ESD K9 Training Logs — data model.
 *
 * Structure: Session (1) -> Exercise (n) -> Hide (n).
 * False responses are recorded per-exercise (they are not tied to a hide by
 * definition — a false response occurs where no target odor is present).
 *
 * All ids are UUIDs (crypto.randomUUID) so records remain globally unique
 * across backup/restore and any future multi-device sync.
 */

// ---------- shared ----------

export type RecordStatus = "draft" | "completed" | "reviewed" | "locked";

export type ActivityType =
  | "training"
  | "certification"
  | "demonstration"
  | "deployment_training"
  | "remedial"
  | "other";

export type Blindness = "known" | "single_blind" | "double_blind";

/** 1 (poor) .. 5 (excellent). 0 / undefined = not rated. */
export type Rating = 1 | 2 | 3 | 4 | 5;

export type Environment = "indoor" | "outdoor" | "mixed";

/** Distinct, unambiguous hide outcomes (never collapsed into one "finds" number). */
export type HideOutcome =
  | "found_independent" // confirmed find, independent indication
  | "found_assisted" // correct alert but handler assistance/recheck required
  | "interest_no_indication" // interest shown, no final indication
  | "missed" // K9 passed the hide without locating it
  | "not_searched"; // hide was placed but the area was not searched

export type ExerciseResult = "successful" | "needs_work" | "unsatisfactory";

export type DeviceType =
  | "cellphone"
  | "sd_card"
  | "micro_sd"
  | "usb_drive"
  | "sim_card"
  | "hard_drive"
  | "ssd"
  | "tablet"
  | "laptop"
  | "dvr"
  | "game_console"
  | "training_aid_odor" // pure odor aid (e.g., TPPO aid), not a functional device
  | "other";

// ---------- settings / profile ----------

export interface AppSettings {
  id: "app"; // singleton row
  onboarded: boolean;
  agency: string;
  unit: string;
  handlerName: string;
  handlerId: string; // optional employee/badge number
  k9Name: string;
  k9Breed: string;
  k9Dob: string; // ISO date or ""
  k9Id: string;
  targetOdor: string; // e.g., "TPPO (electronic storage devices)"
  trainerOrg: string;
  initialCertDate: string;
  currentCertDate: string;
  certExpirationDate: string;
  agencyLogoDataUrl: string; // small data-url image or ""
  k9PhotoDataUrl: string; // small data-url image or ""
  vetName: string;
  vetPhone: string;
  k9HealthNotes: string; // allergies, medications, standing conditions
  theme: "system" | "light" | "dark";
  dateFormat: "MM/dd/yyyy" | "dd/MM/yyyy" | "yyyy-MM-dd";
  reportHeader: string;
  reportFooter: string;
  includeIdentityInExports: boolean;
  includeAttachmentsInExports: boolean;
  appPin: string; // hashed PIN or "" when disabled
  autoLockMinutes: number; // 0 = never
  updatedAt: string;
}

// ---------- locations ----------

export interface Location {
  id: string;
  name: string;
  address: string;
  kind: string; // free text: "Office building", "Residence", ...
  favorite: boolean;
  useCount: number;
  lastUsedAt: string;
  createdAt: string;
}

// ---------- custom search types ----------

export interface SearchTypeDef {
  id: string; // slug for built-ins, uuid for custom
  label: string;
  builtIn: boolean;
  archived: boolean;
}

// ---------- session ----------

export interface EnvConditions {
  temperatureF: number | null;
  weather: string;
  wind: string;
  airflow: string; // indoor ventilation
  lighting: string;
  noiseDistractions: string;
  surface: string;
  areaSize: string; // small / medium / large / free text
  clutterLevel: Rating | 0;
  accessibilityDifficulty: Rating | 0;
  familiarLocation: boolean | null;
  peoplePresent: string;
  animalsPresent: string;
  distractorOdors: string;
  notes: string;
}

export interface WelfareCheck {
  conditionBefore: string;
  energyMotivation: Rating | 0;
  recentFeeding: string;
  hydration: string;
  healthConcerns: string; // injury/illness/medication
  heatSafetyConcern: boolean;
  restBreaks: string;
  notes: string;
}

export interface ReviewInfo {
  reviewerName: string;
  comments: string;
  reviewedAt: string; // ISO datetime or ""
}

/** Optional GPS fix captured on the device at the training site. */
export interface GpsPoint {
  lat: number;
  lon: number;
  accuracyM: number | null;
  capturedAt: string;
}

export interface TrainingSession {
  id: string;
  date: string; // ISO date yyyy-MM-dd
  startTime: string; // "HH:mm" or ""
  endTime: string; // "HH:mm" or ""
  activityType: ActivityType;
  activityOther: string;
  locationId: string | null;
  locationName: string;
  locationAddress: string;
  gps: GpsPoint | null;
  caseNumber: string; // case / incident / reference number (optional)
  environment: Environment;
  handlerName: string;
  k9Name: string;
  trainerName: string; // trainer / evaluator / hide placer
  otherPersonnel: string;
  objective: string;
  summary: string;
  overallAssessment: Rating | 0;
  correctiveFollowUp: string; // corrective action / follow-up training needed
  nextFocus: string;
  env: EnvConditions;
  welfare: WelfareCheck | null;
  status: RecordStatus;
  review: ReviewInfo | null;
  handlerAcknowledged: boolean;
  handlerAcknowledgedAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  modifiedBy: string;
}

// ---------- exercise ----------

export interface FalseResponse {
  id: string;
  locationDescription: string;
  suspectedCause: string;
  handlerResponse: string;
}

export interface Exercise {
  id: string;
  sessionId: string;
  order: number;
  searchTypeId: string;
  roomTypes: string[]; // for building searches
  blindness: Blindness;
  isBlankSearch: boolean; // deliberately no target odor present
  blankCorrect: boolean | null; // K9 correctly cleared the blank area?
  areaDescription: string;
  searchTimeSeconds: number | null;
  timeToFirstFindSeconds: number | null;
  offLeash: boolean;
  // qualitative ratings (0 = not rated)
  coverage: Rating | 0;
  intensity: Rating | 0;
  independence: Rating | 0;
  focus: Rating | 0;
  stamina: Rating | 0;
  indicationQuality: Rating | 0;
  finalResponseType: string; // sit / down / stare / passive / other
  handlerCueing: string; // none / minimal / directed recheck / significant
  handlerStrategy: string;
  rewardType: string; // food / toy / praise / none
  rewardCups: number | null; // food-reward cups (ESD dogs are food-driven)
  rewardedAtSource: boolean | null;
  falseResponses: FalseResponse[];
  problems: string;
  correctiveTraining: string;
  result: ExerciseResult | "";
  comments: string;
  envOverride: string; // exercise-specific conditions if they differ
  createdAt: string;
  updatedAt: string;
}

// ---------- hide ----------

export interface Hide {
  id: string;
  exerciseId: string;
  sessionId: string; // denormalized for fast per-session queries
  number: number;
  targetMaterial: string; // odor source, e.g. "TPPO training aid", "device"
  aidInventoryId: string;
  deviceType: DeviceType;
  deviceTypeOther: string;
  locationDescription: string;
  heightDescription: string; // floor / knee / waist / chest / elevated / ...
  concealment: string; // exposed / partially concealed / fully concealed / buried
  accessible: boolean | null;
  difficulty: Rating | 0;
  placedTime: string; // "HH:mm" or ""
  ageMinutes: number | null; // set/aging time before search
  placedBy: string;
  handlerKnewLocation: boolean | null;
  outcome: HideOutcome | "";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- revisions (audit trail) ----------

export interface RevisionEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  person: string;
  reason: string;
  /** What changed: JSON snapshot of the field-level before/after values. */
  changes: { field: string; before: string; after: string }[];
  kind: "finalize" | "correction" | "status_change" | "review";
}

// ---------- attachments ----------

export interface Attachment {
  id: string;
  sessionId: string;
  exerciseId: string | null;
  kind: "hide_photo" | "environment_photo" | "diagram" | "document" | "other";
  caption: string;
  mimeType: string;
  blob: Blob;
  byteSize: number;
  createdAt: string;
}

// ---------- K9 health ----------

export interface VaccinationRecord {
  id: string;
  name: string; // Rabies, DHPP, Bordetella, Leptospirosis, ...
  dateGiven: string; // ISO date or ""
  nextDueDate: string; // ISO date or ""
  administeredBy: string; // vet / clinic
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeightEntry {
  id: string;
  date: string; // ISO date
  weightLb: number;
  notes: string;
  createdAt: string;
}

// ---------- command / obedience tracking ----------

export interface CommandRecord {
  id: string;
  name: string; // e.g., "Sit", "Down", "Seek", "Show me", recall
  category: string; // obedience / detection / control / other
  proficiency: Rating | 0; // 0 = not rated, 5 = mastered
  lastPracticed: string; // ISO date or ""
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- follow-up items ----------

export interface FollowUpItem {
  id: string;
  sessionId: string | null;
  text: string;
  done: boolean;
  createdAt: string;
  completedAt: string;
}

// ---------- backup file format ----------

export interface BackupFile {
  format: "esd-k9-logs-backup";
  formatVersion: 1;
  exportedAt: string;
  appVersion: string;
  settings: AppSettings | null;
  sessions: TrainingSession[];
  exercises: Exercise[];
  hides: Hide[];
  locations: Location[];
  searchTypes: SearchTypeDef[];
  revisions: RevisionEntry[];
  followUps: FollowUpItem[];
  /** Absent in backups created before v1.1 — treated as empty on restore. */
  commands?: CommandRecord[];
  vaccinations?: VaccinationRecord[];
  weights?: WeightEntry[];
  /** Attachments are stored base64-encoded in backups. */
  attachments: (Omit<Attachment, "blob"> & { dataBase64: string })[];
}
