export type UUID = string;

export interface Profile {
  id: UUID;
  household_id: UUID;
}

export interface Pet {
  id: UUID;
  name: string;
  household_id: UUID;
  /** Null until the household opts into potty tracking and picks a size. */
  size_class: PetSizeClass | null;
}

import type { ScoopSize } from "@/lib/scoop";
import type { PetSizeClass, PottyScaleValue } from "@/lib/potty";
import { isPottyScaleValue } from "@/lib/potty";

export type { ScoopSize };

export interface SupplementConfig {
  id: string;
  name: string;
  frequency: number; // times per day
}

export interface MedConfig {
  id: string;
  name: string;
  frequency: number;
}

export interface PetSettings {
  pet_id: UUID;
  meal_type: string;
  scoop_size: ScoopSize;
  daily_scoops: number;
  supplements_config: SupplementConfig[];
  meds_config: MedConfig[];
  potty_tracking_enabled: boolean;
}

export interface DailyLog {
  id: UUID;
  pet_id: UUID;
  date: string; // ISO date string YYYY-MM-DD
  kibble_checked: number;
  supplements_status: Record<string, number>; // supplement id -> checked count
  meds_status: Record<string, number>; // med id -> checked count
}

export type PetEventSaveState = "pending" | "saved" | "failed";

/**
 * Payload registry keyed by `event_type`. A feature adds one member here and
 * one validator in `petEventValidators`. Parsing, inserts, and the store read
 * both from there. Payloads only ever gain optional fields; see
 * specs/data-model.md.
 */
export interface PetEventPayloads {
  potty_pee: { size: PottyScaleValue };
  potty_poop: { size: PottyScaleValue; consistency: PottyScaleValue };
}

interface PetEventCommon {
  id: UUID;
  pet_id: UUID;
  occurred_at: string;
  local_date: string;
  /** Null on a client row that has not been read back. The column is not null. */
  logged_by: UUID | null;
  created_at: string;
  updated_at: string | null;
  saveState: PetEventSaveState;
}

type RegisteredPetEvent = {
  [K in keyof PetEventPayloads]: PetEventCommon & {
    event_type: K;
    data: PetEventPayloads[K];
  };
}[keyof PetEventPayloads];

/** Discriminated on `event_type`. With an empty registry this has no members. */
export type PetEvent = [RegisteredPetEvent] extends [never]
  ? PetEventCommon & { event_type: never; data: never }
  : RegisteredPetEvent;

/** Only `occurred_at` and `data` may be patched. `local_date` is derived. */
export type PetEventPatch = {
  occurred_at?: string;
  data?: PetEvent["data"];
};

type PetEventValidatorMap = {
  [K in keyof PetEventPayloads]: (data: unknown) => data is PetEventPayloads[K];
};

// Validators check the required fields only. Unknown keys are allowed so a
// later optional field does not invalidate rows written before it existed.
const petEventValidators: PetEventValidatorMap = {
  potty_pee: (data): data is PetEventPayloads["potty_pee"] =>
    isRecord(data) && isPottyScaleValue(data.size),
  potty_poop: (data): data is PetEventPayloads["potty_poop"] =>
    isRecord(data) && isPottyScaleValue(data.size) && isPottyScaleValue(data.consistency),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** True when `eventType` is registered and `data` matches that member's validator. */
export function isValidPetEventData(eventType: string, data: unknown): boolean {
  const validate = (petEventValidators as Record<string, (value: unknown) => boolean>)[eventType];
  if (typeof validate !== "function") return false;
  try {
    return validate(data) === true;
  } catch {
    return false;
  }
}

/**
 * Turns a raw `pet_events` row into a client `PetEvent`.
 * Returns null when the type is not registered or `data` fails validation.
 * `saveState` is always `"saved"`; it is not read from the row.
 */
export function parsePetEvent(row: unknown): PetEvent | null {
  try {
    if (!isRecord(row)) return null;
    if (!isNonEmptyString(row.id)) return null;
    if (!isNonEmptyString(row.pet_id)) return null;
    if (!isNonEmptyString(row.event_type)) return null;
    if (!isNonEmptyString(row.occurred_at)) return null;
    if (!isNonEmptyString(row.local_date)) return null;
    if (!isNonEmptyString(row.created_at)) return null;
    if (!(row.logged_by === null || row.logged_by === undefined || isNonEmptyString(row.logged_by))) {
      return null;
    }
    if (!(row.updated_at === null || row.updated_at === undefined || isNonEmptyString(row.updated_at))) {
      return null;
    }
    if (!isValidPetEventData(row.event_type, row.data)) return null;

    return {
      id: row.id,
      pet_id: row.pet_id,
      event_type: row.event_type,
      occurred_at: row.occurred_at,
      local_date: row.local_date,
      data: row.data,
      logged_by: isNonEmptyString(row.logged_by) ? row.logged_by : null,
      created_at: row.created_at,
      updated_at: isNonEmptyString(row.updated_at) ? row.updated_at : null,
      saveState: "saved",
    } as PetEvent;
  } catch {
    return null;
  }
}

function occurredAtMillis(occurredAt: string): number | null {
  const millis = Date.parse(occurredAt);
  return Number.isNaN(millis) ? null : millis;
}

/** Newest `occurred_at` first. Unparseable timestamps sort last. */
export function sortPetEvents(rows: readonly PetEvent[]): PetEvent[] {
  return [...rows].sort((a, b) => {
    const aMs = occurredAtMillis(a.occurred_at);
    const bMs = occurredAtMillis(b.occurred_at);
    if (aMs !== null && bMs !== null) return bMs - aMs;
    if (aMs !== null) return -1;
    if (bMs !== null) return 1;
    return 0;
  });
}

/**
 * Merges a viewDate read into local rows. Does not replace the list.
 * Server rows win by id and are `saved`. Local `failed` and `pending` rows
 * the server did not return are kept. Local `saved` rows it did not return
 * are dropped.
 */
export function mergePetEvents(local: readonly PetEvent[], server: readonly PetEvent[]): PetEvent[] {
  const serverById = new Map(server.map((row) => [row.id, { ...row, saveState: "saved" as const }]));
  const merged: PetEvent[] = [];
  const seen = new Set<string>();

  for (const row of local) {
    const fromServer = serverById.get(row.id);
    if (fromServer) {
      merged.push(fromServer);
      seen.add(row.id);
      continue;
    }
    if (row.saveState === "failed" || row.saveState === "pending") {
      merged.push(row);
    }
  }

  for (const row of server) {
    if (!seen.has(row.id)) {
      merged.push({ ...row, saveState: "saved" });
    }
  }

  return sortPetEvents(merged);
}

/**
 * Rows for this pet and civil date, newest first.
 * A kept `failed` or `pending` row stays in stored state across days and
 * appears here only when its `local_date` is `viewDate`.
 */
export function visiblePetEvents(
  rows: readonly PetEvent[],
  petId: string | null,
  viewDate: string,
): PetEvent[] {
  if (!petId) return [];
  return sortPetEvents(
    rows.filter((event) => event.pet_id === petId && event.local_date === viewDate),
  );
}
