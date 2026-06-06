export type UUID = string;

export interface Profile {
  id: UUID;
  household_id: UUID;
}

export interface Pet {
  id: UUID;
  name: string;
  household_id: UUID;
}

export type ScoopSize = "0" | "1/4" | "1/3" | "1/2" | "2/3" | "3/4" | "1";

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
}

export interface DailyLog {
  id: UUID;
  pet_id: UUID;
  date: string; // ISO date string YYYY-MM-DD
  kibble_checked: number;
  supplements_status: Record<string, number>; // supplement id -> checked count
  meds_status: Record<string, number>; // med id -> checked count
}
