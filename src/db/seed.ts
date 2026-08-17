/**
 * Fictional sample data: K9 Cooper, an ESD-detection Labrador.
 * All names, locations, and details are invented for demonstration.
 */
import { db, nowIso, uuid, ensureSearchTypes, getSettings, type EsdK9Db } from "./db";
import { emptyEnv, emptyWelfare, newExercise, newHide, newSession } from "./factories";
import { localDateIso } from "../lib/format";
import type { Blindness, DeviceType, HideOutcome, Rating, TrainingSession } from "./types";

const HANDLER = "Det. A. Merritt";
const K9 = "Cooper";

interface SeedHide {
  device: DeviceType;
  loc: string;
  height?: string;
  concealment?: string;
  outcome: HideOutcome;
  difficulty?: Rating;
  notes?: string;
}

interface SeedExercise {
  type: string;
  rooms?: string[];
  blindness: Blindness;
  blank?: boolean;
  blankCorrect?: boolean;
  area?: string;
  timeSec?: number;
  firstFindSec?: number;
  cups?: number;
  result?: "successful" | "needs_work" | "unsatisfactory";
  ratings?: Partial<Record<"coverage" | "intensity" | "independence" | "focus" | "stamina" | "indicationQuality", Rating>>;
  falseResp?: { loc: string; cause: string }[];
  comments?: string;
  hides: SeedHide[];
}

interface SeedSession {
  daysAgo: number;
  start: string;
  end: string;
  location: string;
  address: string;
  environment: "indoor" | "outdoor" | "mixed";
  trainer: string;
  objective: string;
  summary: string;
  assessment: Rating;
  followUp?: string;
  nextFocus?: string;
  tempF?: number;
  weather?: string;
  status?: "draft" | "completed" | "reviewed";
  exercises: SeedExercise[];
}

const SEED: SeedSession[] = [
  {
    daysAgo: 2,
    start: "08:30",
    end: "10:05",
    location: "Fairview Training Annex",
    address: "1200 Commerce Way, Fairview",
    environment: "indoor",
    trainer: "Sgt. R. Delgado",
    objective: "Maintenance: room searches with deep-concealment hides; one blank room",
    summary:
      "Strong session. Cooper worked methodically through four rooms including one blank. Deep-concealment microSD behind baseboard required a second pass but he committed to a clean final response without assistance.",
    assessment: 4,
    nextFocus: "More elevated hides above chest height",
    tempF: 72,
    weather: "Indoor, HVAC on",
    status: "completed",
    exercises: [
      {
        type: "room",
        rooms: ["Office"],
        blindness: "single_blind",
        area: "Three connected offices, second floor",
        timeSec: 540,
        firstFindSec: 95,
        cups: 2,
        result: "successful",
        ratings: { coverage: 4, intensity: 4, independence: 5, focus: 4, indicationQuality: 5 },
        hides: [
          { device: "cellphone", loc: "Desk drawer, second from top", height: "waist", concealment: "fully concealed", outcome: "found_independent" },
          { device: "micro_sd", loc: "Behind loose baseboard, north wall", height: "floor", concealment: "fully concealed", difficulty: 5, outcome: "found_independent", notes: "Required second pass; committed final response, no cue given" }
        ]
      },
      {
        type: "blank",
        rooms: ["Office"],
        blindness: "single_blind",
        blank: true,
        blankCorrect: true,
        area: "Adjacent break room, no target odor placed",
        timeSec: 240,
        result: "successful",
        ratings: { coverage: 4, focus: 4 },
        comments: "Clean blank. No interest shown, handler called the room clear.",
        hides: []
      },
      {
        type: "boxes",
        blindness: "known",
        area: "12-box line, one hot box",
        timeSec: 120,
        firstFindSec: 40,
        cups: 1,
        result: "successful",
        ratings: { intensity: 5, indicationQuality: 4 },
        hides: [
          { device: "usb_drive", loc: "Box 7 of 12", concealment: "fully concealed", outcome: "found_independent" }
        ]
      }
    ]
  },
  {
    daysAgo: 5,
    start: "17:15",
    end: "18:20",
    location: "Lakeside Municipal Garage",
    address: "88 Harbor Rd, Lakeside",
    environment: "mixed",
    trainer: "Sgt. R. Delgado",
    objective: "Vehicle searches, warm conditions; introduce undercarriage placement",
    summary:
      "Cooper cleared three of four vehicles well. Missed the SIM card in the wheel-well magnet box on the first pass — likely thermals pulling odor under the vehicle. Re-run after a rest break produced a find with light handler support. Logged as remedial follow-up.",
    assessment: 3,
    followUp: "Repeat undercarriage/wheel-well placements in cooler conditions, then re-test warm",
    nextFocus: "Vehicle undercarriage hides",
    tempF: 88,
    weather: "Sunny, light wind",
    status: "reviewed",
    exercises: [
      {
        type: "vehicle",
        blindness: "single_blind",
        area: "Four sedans, parking level 1",
        timeSec: 780,
        firstFindSec: 130,
        cups: 2,
        result: "needs_work",
        ratings: { coverage: 3, intensity: 4, independence: 3, stamina: 3, indicationQuality: 4 },
        falseResp: [],
        comments: "Heat affected later runs; added rest and water breaks between vehicles.",
        hides: [
          { device: "cellphone", loc: "Under driver seat, vehicle 1", concealment: "partially concealed", outcome: "found_independent" },
          { device: "sim_card", loc: "Magnet box, rear wheel well, vehicle 3", height: "knee", concealment: "fully concealed", difficulty: 4, outcome: "missed", notes: "Missed on first pass; found on re-run with handler presenting the wheel well" },
          { device: "sd_card", loc: "Glove box, vehicle 4", concealment: "fully concealed", outcome: "found_independent" }
        ]
      }
    ]
  },
  {
    daysAgo: 9,
    start: "09:00",
    end: "11:10",
    location: "Riverbend Elementary (closed for summer)",
    address: "45 School Ln, Riverbend",
    environment: "indoor",
    trainer: "Ofc. J. Okafor (hide placer)",
    objective: "Double-blind school scenario: classrooms and library, distractor odors present",
    summary:
      "Double-blind evaluation run. Evaluator confirmed 5 of 6 hides located independently. One false response at a cafeteria cabinet that had recently stored electronics (residual odor suspected) — logged and discussed; not corrected as a handler error.",
    assessment: 4,
    followUp: "Verify aid inventory storage practices to reduce residual-odor contamination",
    nextFocus: "Maintain double-blind cadence monthly",
    tempF: 74,
    weather: "Indoor",
    status: "reviewed",
    exercises: [
      {
        type: "room",
        rooms: ["School / classroom"],
        blindness: "double_blind",
        area: "Four classrooms, east wing",
        timeSec: 1500,
        firstFindSec: 210,
        cups: 3,
        result: "successful",
        ratings: { coverage: 5, intensity: 4, independence: 5, focus: 4, stamina: 4, indicationQuality: 5 },
        falseResp: [
          { loc: "Cafeteria storage cabinet", cause: "Suspected residual odor — cabinet previously stored tablets" }
        ],
        comments: "Evaluator scored the run; handler had no knowledge of placements.",
        hides: [
          { device: "cellphone", loc: "Classroom 3, bookshelf, third shelf", height: "chest", concealment: "partially concealed", outcome: "found_independent" },
          { device: "usb_drive", loc: "Classroom 4, pencil box in desk", height: "waist", concealment: "fully concealed", outcome: "found_independent" },
          { device: "micro_sd", loc: "Library, inside hollowed book", height: "chest", concealment: "fully concealed", difficulty: 4, outcome: "found_independent" },
          { device: "hard_drive", loc: "Library AV closet, top shelf", height: "elevated", concealment: "partially concealed", difficulty: 3, outcome: "found_independent", notes: "Elevated hide — good air scenting" },
          { device: "sd_card", loc: "Classroom 5, taped under chair", height: "knee", concealment: "fully concealed", outcome: "found_independent" },
          { device: "tablet", loc: "Teacher lounge, locker 12", height: "chest", concealment: "fully concealed", difficulty: 4, outcome: "missed", notes: "Locker vents faced away from aisle; airflow discussed with evaluator" }
        ]
      }
    ]
  },
  {
    daysAgo: 12,
    start: "07:45",
    end: "08:40",
    location: "Cedar Hollow Park",
    address: "Trailhead lot, Cedar Hollow",
    environment: "outdoor",
    trainer: HANDLER,
    objective: "Outdoor area search; buried and surface hides along tree line",
    summary:
      "Morning outdoor work before heat. Cooper located both hides including a buried USB at ~4 inches. Strong independent work off-leash.",
    assessment: 5,
    tempF: 66,
    weather: "Overcast, wind 5-10 mph from west",
    status: "completed",
    exercises: [
      {
        type: "outdoor",
        blindness: "known",
        area: "Tree line and picnic area, ~100 x 40 yards",
        timeSec: 900,
        firstFindSec: 260,
        cups: 2,
        result: "successful",
        ratings: { coverage: 4, intensity: 5, independence: 5, stamina: 5, indicationQuality: 4 },
        comments: "Worked crosswind pattern; off-leash under voice control.",
        hides: [
          { device: "usb_drive", loc: "Buried ~4 in. at base of oak, marked GPS", height: "floor", concealment: "buried", difficulty: 5, outcome: "found_independent" },
          { device: "cellphone", loc: "Under park bench slat", height: "knee", concealment: "partially concealed", outcome: "found_independent" }
        ]
      }
    ]
  },
  {
    daysAgo: 16,
    start: "13:00",
    end: "14:30",
    location: "Regional Mail Facility (training bay)",
    address: "300 Logistics Pkwy",
    environment: "indoor",
    trainer: "Sgt. R. Delgado",
    objective: "Parcel line searches; mixed distractors (food wrappers, chargers without storage)",
    summary:
      "Parcel work with deliberate distractors. Cooper ignored a phone charger (no storage media) correctly and indicated on all three loaded parcels. One interest-only response on a parcel that had contained a phone the prior day — did not commit, handler moved on. Good discrimination.",
    assessment: 4,
    nextFocus: "Increase parcel line length; add moving-belt scenario when available",
    tempF: 71,
    status: "completed",
    exercises: [
      {
        type: "parcel",
        blindness: "single_blind",
        area: "24-parcel line on rollers",
        timeSec: 600,
        firstFindSec: 75,
        cups: 3,
        result: "successful",
        ratings: { coverage: 4, intensity: 4, independence: 4, focus: 5, indicationQuality: 4 },
        comments: "Distractors: sealed food, cables, charger. Correct discrimination throughout.",
        hides: [
          { device: "cellphone", loc: "Parcel 6, wrapped in clothing", concealment: "fully concealed", outcome: "found_independent" },
          { device: "sd_card", loc: "Parcel 14, inside greeting card", concealment: "fully concealed", difficulty: 4, outcome: "found_independent" },
          { device: "hard_drive", loc: "Parcel 21, boxed with packing foam", concealment: "fully concealed", outcome: "found_independent" },
          { device: "cellphone", loc: "Parcel 9 (residual — phone removed prior day)", concealment: "fully concealed", outcome: "interest_no_indication", notes: "Interest only, no final response; treated as correct discrimination of residual odor" }
        ]
      }
    ]
  },
  {
    daysAgo: 20,
    start: "10:00",
    end: "11:00",
    location: "Harbor Point Marina (dock training)",
    address: "Pier 4, Harbor Point",
    environment: "outdoor",
    trainer: "Ofc. J. Okafor",
    objective: "Shoreline / dock search; devices near waterline",
    summary:
      "First shoreline session this quarter. Cooper worked dock planking confidently. Waterline phone in dry bag found independently; second hide under dock decking required a directed recheck.",
    assessment: 3,
    followUp: "Schedule monthly shoreline maintenance; work under-deck airflow problems",
    tempF: 79,
    weather: "Breezy, onshore wind",
    status: "completed",
    exercises: [
      {
        type: "water",
        blindness: "known",
        area: "Dock and shoreline, ~80 yards",
        timeSec: 720,
        firstFindSec: 180,
        cups: 2,
        result: "needs_work",
        ratings: { coverage: 3, intensity: 4, independence: 3, indicationQuality: 4 },
        comments: "Onshore wind pushed odor under decking; discussed presentation options.",
        hides: [
          { device: "cellphone", loc: "Dry bag at waterline piling", height: "floor", concealment: "partially concealed", outcome: "found_independent" },
          { device: "usb_drive", loc: "Taped under dock decking, mid-span", height: "floor", concealment: "fully concealed", difficulty: 4, outcome: "found_assisted", notes: "Directed recheck after first pass; correct response on presentation" }
        ]
      }
    ]
  },
  {
    daysAgo: 27,
    start: "08:15",
    end: "10:00",
    location: "County Impound Warehouse",
    address: "2 Depot St",
    environment: "indoor",
    trainer: "Sgt. R. Delgado",
    objective: "Cluttered warehouse problem; elevated and floor-level hides among shelving",
    summary:
      "High-clutter environment with shelving to 12 ft. Cooper maintained drive throughout a long problem. Elevated SSD at 6 ft found via air scent cone. One false response near a shelf of seized electronics equipment (actual odor source plausible — logged as unconfirmed rather than false).",
    assessment: 4,
    tempF: 68,
    status: "completed",
    exercises: [
      {
        type: "cluttered",
        rooms: ["Warehouse"],
        blindness: "single_blind",
        area: "Warehouse floor, aisles A-D",
        timeSec: 1800,
        firstFindSec: 320,
        cups: 3,
        result: "successful",
        ratings: { coverage: 4, intensity: 4, independence: 4, focus: 4, stamina: 4, indicationQuality: 4 },
        falseResp: [
          { loc: "Aisle C, shelf of seized AV equipment", cause: "Unconfirmed — possible actual storage media within sealed evidence; could not verify" }
        ],
        hides: [
          { device: "ssd", loc: "Aisle B, shelf at ~6 ft", height: "elevated", concealment: "partially concealed", difficulty: 4, outcome: "found_independent" },
          { device: "cellphone", loc: "Inside rolled carpet, aisle D", height: "floor", concealment: "fully concealed", difficulty: 3, outcome: "found_independent" },
          { device: "micro_sd", loc: "Pill bottle inside toolbox, aisle A", height: "waist", concealment: "fully concealed", difficulty: 5, outcome: "found_independent" }
        ]
      }
    ]
  },
  {
    daysAgo: 34,
    start: "09:30",
    end: "10:15",
    location: "Fairview Training Annex",
    address: "1200 Commerce Way, Fairview",
    environment: "indoor",
    trainer: HANDLER,
    objective: "Odor recognition refresh: box line with all trained device types",
    summary:
      "ORT-style refresher covering phone, SD, microSD, USB, SIM, and hard drive aids. Six for six with clean responses. Short, high-reward session.",
    assessment: 5,
    tempF: 70,
    status: "completed",
    exercises: [
      {
        type: "boxes",
        blindness: "single_blind",
        area: "12-box line, six hot boxes run sequentially",
        timeSec: 480,
        firstFindSec: 30,
        cups: 4,
        result: "successful",
        ratings: { intensity: 5, independence: 5, indicationQuality: 5 },
        hides: [
          { device: "cellphone", loc: "Box 2", concealment: "fully concealed", outcome: "found_independent" },
          { device: "sd_card", loc: "Box 5", concealment: "fully concealed", outcome: "found_independent" },
          { device: "micro_sd", loc: "Box 8", concealment: "fully concealed", outcome: "found_independent" },
          { device: "usb_drive", loc: "Box 11", concealment: "fully concealed", outcome: "found_independent" },
          { device: "sim_card", loc: "Box 3 (second run)", concealment: "fully concealed", outcome: "found_independent" },
          { device: "hard_drive", loc: "Box 9 (second run)", concealment: "fully concealed", outcome: "found_independent" }
        ]
      }
    ]
  }
];

export async function seedDatabase(database: EsdK9Db = db): Promise<void> {
  await ensureSearchTypes(database);
  const settings = await getSettings(database);
  if (!settings.onboarded) {
    await database.settings.put({
      ...settings,
      onboarded: true,
      agency: "Fairview County Sheriff's Office",
      unit: "Digital Forensics / ICAC Task Force",
      handlerName: HANDLER,
      handlerId: "4471",
      k9Name: K9,
      k9Breed: "Labrador Retriever",
      k9Dob: "2022-03-14",
      k9Id: "K9-07",
      targetOdor: "TPPO (electronic storage devices)",
      trainerOrg: "Jordan Detection K9",
      initialCertDate: "2023-11-02",
      currentCertDate: "2025-11-05",
      certExpirationDate: "2026-11-05",
      reportHeader: "Fairview County Sheriff's Office — ESD K9 Unit",
      reportFooter: "Training record — maintained per unit policy",
      updatedAt: nowIso()
    });
  }

  for (const s of SEED) {
    const session: TrainingSession = newSession({ handlerName: HANDLER, k9Name: K9 });
    const d = new Date();
    d.setDate(d.getDate() - s.daysAgo);
    session.date = localDateIso(d);
    session.startTime = s.start;
    session.endTime = s.end;
    session.locationName = s.location;
    session.locationAddress = s.address;
    session.environment = s.environment;
    session.trainerName = s.trainer;
    session.objective = s.objective;
    session.summary = s.summary;
    session.overallAssessment = s.assessment;
    session.correctiveFollowUp = s.followUp ?? "";
    session.nextFocus = s.nextFocus ?? "";
    session.env = { ...emptyEnv(), temperatureF: s.tempF ?? null, weather: s.weather ?? "" };
    session.welfare = { ...emptyWelfare(), energyMotivation: 4 as Rating };
    const status = s.status ?? "completed";
    session.status = status;
    if (status !== "draft") {
      session.handlerAcknowledged = true;
      session.handlerAcknowledgedAt = session.createdAt;
    }
    if (status === "reviewed") {
      session.review = {
        reviewerName: "Lt. C. Barnes",
        comments: "Reviewed; documentation complete.",
        reviewedAt: session.createdAt
      };
    }

    await database.sessions.put(session);
    if (status !== "draft") {
      await database.revisions.add({
        id: uuid(),
        sessionId: session.id,
        timestamp: session.createdAt,
        person: HANDLER,
        reason: "Record finalized by handler",
        changes: [{ field: "status", before: "draft", after: "completed" }],
        kind: "finalize"
      });
    }
    if (s.followUp) {
      await database.followUps.add({
        id: uuid(),
        sessionId: session.id,
        text: s.followUp,
        done: s.daysAgo > 21,
        createdAt: session.createdAt,
        completedAt: s.daysAgo > 21 ? nowIso() : ""
      });
    }
    await touchSeedLocation(database, s.location, s.address);

    let order = 1;
    for (const e of s.exercises) {
      const ex = newExercise(session.id, order++);
      ex.searchTypeId = e.type;
      ex.roomTypes = e.rooms ?? [];
      ex.blindness = e.blindness;
      ex.isBlankSearch = e.blank ?? false;
      ex.blankCorrect = e.blankCorrect ?? null;
      ex.areaDescription = e.area ?? "";
      ex.searchTimeSeconds = e.timeSec ?? null;
      ex.timeToFirstFindSeconds = e.firstFindSec ?? null;
      ex.rewardCups = e.cups ?? null;
      ex.rewardedAtSource = e.hides.some((h) => h.outcome.startsWith("found")) ? true : null;
      ex.result = e.result ?? "";
      ex.comments = e.comments ?? "";
      if (e.ratings) Object.assign(ex, e.ratings);
      ex.finalResponseType = "Sit (passive)";
      ex.falseResponses = (e.falseResp ?? []).map((f) => ({
        id: uuid(),
        locationDescription: f.loc,
        suspectedCause: f.cause,
        handlerResponse: "No reward given; moved on"
      }));
      await database.exercises.put(ex);

      let num = 1;
      for (const h of e.hides) {
        const hide = newHide(ex.id, session.id, num++);
        hide.deviceType = h.device;
        hide.targetMaterial = "Electronic storage device";
        hide.locationDescription = h.loc;
        hide.heightDescription = h.height ?? "";
        hide.concealment = h.concealment ?? "";
        hide.difficulty = h.difficulty ?? 0;
        hide.placedBy = s.trainer;
        hide.handlerKnewLocation = e.blindness === "known";
        hide.outcome = h.outcome;
        hide.notes = h.notes ?? "";
        await database.hides.put(hide);
      }
    }
  }
}

async function touchSeedLocation(database: EsdK9Db, name: string, address: string) {
  const existing = await database.locations.where("name").equalsIgnoreCase(name).first();
  if (existing) {
    existing.useCount += 1;
    await database.locations.put(existing);
    return;
  }
  await database.locations.add({
    id: uuid(),
    name,
    address,
    kind: "",
    favorite: name.includes("Fairview"),
    useCount: 1,
    lastUsedAt: nowIso(),
    createdAt: nowIso()
  });
}

export async function isDatabaseEmpty(database: EsdK9Db = db): Promise<boolean> {
  return (await database.sessions.count()) === 0;
}
