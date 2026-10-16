/**
 * Potty glyphs. Paths are from the Potty Tracking v2 board
 * (docs/design/potty-tracking-v2.html). Both fill with currentColor.
 */

export interface PottyIconProps {
  size: number;
}

export function DropletIcon({ size }: PottyIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
    </svg>
  );
}

export function MoundIcon({ size }: PottyIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="15" width="18" height="6" rx="3" />
      <rect x="6" y="9.5" width="12" height="6" rx="3" />
      <rect x="9" y="4" width="6" height="6" rx="3" />
    </svg>
  );
}
