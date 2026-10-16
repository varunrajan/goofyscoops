/**
 * Shared constants for potty tracking. See specs/potty-tracking.md and
 * specs/potty-tracking-handoff.md ("Words").
 */

export const PET_SIZE_CLASSES = ["toy", "small", "medium", "large", "giant"] as const;

export type PetSizeClass = (typeof PET_SIZE_CLASSES)[number];

export const PET_SIZE_CLASS_LABELS: Record<PetSizeClass, string> = {
  toy: "Toy",
  small: "Small",
  medium: "Medium",
  large: "Large",
  giant: "Giant",
};

export function isPetSizeClass(value: unknown): value is PetSizeClass {
  return typeof value === "string" && (PET_SIZE_CLASSES as readonly string[]).includes(value);
}

/** 1 to 5. Used for both `size` and `consistency`. */
export type PottyScaleValue = 1 | 2 | 3 | 4 | 5;

export function isPottyScaleValue(value: unknown): value is PottyScaleValue {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Indexed by value: `POTTY_SIZE_WORDS[value - 1]`. */
export const POTTY_SIZE_WORDS = ["Tiny", "Small", "Medium", "Big", "Huge"] as const;

/** Indexed by value: `POTTY_TEXTURE_WORDS[value - 1]`. 1 = loosest, 5 = firmest. */
export const POTTY_TEXTURE_WORDS = ["Soupy", "Squishy", "Just right", "Crumbly", "Pebbly"] as const;

export const POTTY_DEFAULTS = {
  size: 3,
  consistency: 3,
} as const satisfies { size: PottyScaleValue; consistency: PottyScaleValue };

/**
 * The one spring for every potty control (switch knob, scale fills, slider
 * thumb). Tune here, not per component. See the handoff ("Motion").
 */
export const POTTY_SPRING = { type: "spring", stiffness: 400, damping: 17 } as const;
