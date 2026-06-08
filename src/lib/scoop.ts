export type ScoopSize =
  | "0"
  | "1/4"
  | "1/3"
  | "1/2"
  | "2/3"
  | "3/4"
  | "1"
  | "1 1/2"
  | "2";

export const SCOOP_SIZES: ScoopSize[] = [
  "0",
  "1/4",
  "1/3",
  "1/2",
  "2/3",
  "3/4",
  "1",
  "1 1/2",
  "2",
];

const LEGACY_SCOOP_SIZE_MAP: Record<string, ScoopSize> = {
  "1.5": "1 1/2",
  "1 1/4": "1",
  "1 1/3": "1",
  "1 2/3": "1 1/2",
  "1 3/4": "2",
};

export function normalizeScoopSize(size: string): ScoopSize {
  if ((SCOOP_SIZES as string[]).includes(size)) {
    return size as ScoopSize;
  }
  return LEGACY_SCOOP_SIZE_MAP[size] ?? "1/2";
}

export function scoopSizeToNumber(size: ScoopSize): number {
  const map: Record<ScoopSize, number> = {
    "0": 0,
    "1/4": 0.25,
    "1/3": 1 / 3,
    "1/2": 0.5,
    "2/3": 2 / 3,
    "3/4": 0.75,
    "1": 1,
    "1 1/2": 1.5,
    "2": 2,
  };
  return map[size];
}

export function formatScoopLabel(size: ScoopSize): string {
  if (size === "0") return "None";
  const cups = scoopSizeToNumber(size);
  return `${size} cup${cups > 1 ? "s" : ""}`;
}

export function formatCups(cups: number): string {
  if (cups === 0) return "0 cups";
  const rounded = Math.round(cups * 100) / 100;
  return `${rounded} cup${rounded !== 1 ? "s" : ""}`;
}
