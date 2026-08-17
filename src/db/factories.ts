import { nowIso, uuid } from "./db";
import { localDateIso } from "../lib/format";
import type {
  EnvConditions,
  Exercise,
  Hide,
  TrainingSession,
  WelfareCheck
} from "./types";

export function emptyEnv(): EnvConditions {
  return {
    temperatureF: null,
    weather: "",
    wind: "",
    airflow: "",
    lighting: "",
    noiseDistractions: "",
    surface: "",
    areaSize: "",
    clutterLevel: 0,
    accessibilityDifficulty: 0,
    familiarLocation: null,
    peoplePresent: "",
    animalsPresent: "",
    distractorOdors: "",
    notes: ""
  };
}

export function emptyWelfare(): WelfareCheck {
  return {
    conditionBefore: "",
    energyMotivation: 0,
    recentFeeding: "",
    hydration: "",
    healthConcerns: "",
    heatSafetyConcern: false,
    restBreaks: "",
    notes: ""
  };
}

export function newSession(defaults: {
  handlerName: string;
  k9Name: string;
}): TrainingSession {
  const now = new Date();
  const ts = nowIso();
  return {
    id: uuid(),
    date: localDateIso(now),
    startTime: now.toTimeString().slice(0, 5),
    endTime: "",
    activityType: "training",
    activityOther: "",
    locationId: null,
    locationName: "",
    locationAddress: "",
    environment: "indoor",
    handlerName: defaults.handlerName,
    k9Name: defaults.k9Name,
    trainerName: "",
    otherPersonnel: "",
    objective: "",
    summary: "",
    overallAssessment: 0,
    correctiveFollowUp: "",
    nextFocus: "",
    env: emptyEnv(),
    welfare: null,
    status: "draft",
    review: null,
    handlerAcknowledged: false,
    handlerAcknowledgedAt: "",
    createdAt: ts,
    updatedAt: ts,
    createdBy: defaults.handlerName,
    modifiedBy: defaults.handlerName
  };
}

export function newExercise(sessionId: string, order: number): Exercise {
  const ts = nowIso();
  return {
    id: uuid(),
    sessionId,
    order,
    searchTypeId: "room",
    roomTypes: [],
    blindness: "known",
    isBlankSearch: false,
    blankCorrect: null,
    areaDescription: "",
    searchTimeSeconds: null,
    timeToFirstFindSeconds: null,
    offLeash: false,
    coverage: 0,
    intensity: 0,
    independence: 0,
    focus: 0,
    stamina: 0,
    indicationQuality: 0,
    finalResponseType: "",
    handlerCueing: "",
    handlerStrategy: "",
    rewardType: "food",
    rewardCups: null,
    rewardedAtSource: null,
    falseResponses: [],
    problems: "",
    correctiveTraining: "",
    result: "",
    comments: "",
    envOverride: "",
    createdAt: ts,
    updatedAt: ts
  };
}

export function newHide(
  exerciseId: string,
  sessionId: string,
  number: number
): Hide {
  const ts = nowIso();
  return {
    id: uuid(),
    exerciseId,
    sessionId,
    number,
    targetMaterial: "Electronic storage device",
    aidInventoryId: "",
    deviceType: "cellphone",
    deviceTypeOther: "",
    locationDescription: "",
    heightDescription: "",
    concealment: "",
    accessible: null,
    difficulty: 0,
    placedTime: "",
    ageMinutes: null,
    placedBy: "",
    handlerKnewLocation: null,
    outcome: "",
    notes: "",
    createdAt: ts,
    updatedAt: ts
  };
}
