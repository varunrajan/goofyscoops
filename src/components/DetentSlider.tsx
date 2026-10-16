"use client";

import { motion } from "framer-motion";
import { POTTY_SPRING, type PottyScaleValue } from "@/lib/potty";

const VALUES: readonly PottyScaleValue[] = [1, 2, 3, 4, 5];

/** Stop position as a percentage of the box width: 10, 30, 50, 70, 90. */
function stopPercent(value: PottyScaleValue): number {
  return 10 + 20 * (value - 1);
}

export interface DetentSliderProps {
  value: PottyScaleValue;
  onChange: (value: PottyScaleValue) => void;
  /** One word per value, indexed `labels[value - 1]`. Used for `aria-valuetext`. */
  labels: readonly string[];
  /** Left, center, right labels under the track. */
  endLabels: readonly [string, string, string];
  /** Slider label, e.g. "Texture". */
  ariaLabel: string;
}

/**
 * Five-stop detent slider with a neutral center. Handoff frame 2c.
 * The teal fill grows out from the center stop to the selected stop.
 * Tap only; no drag in v1.
 *
 * Accessibility: one focus stop with role="slider". Arrows step, Home and
 * End jump. The five tap zones are aria-hidden and not focusable.
 */
export function DetentSlider({ value, onChange, labels, endLabels, ariaLabel }: DetentSliderProps) {
  const pos = stopPercent(value);
  const fillLeft = Math.min(50, pos);
  const fillWidth = Math.abs(pos - 50);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let next: PottyScaleValue | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = Math.min(5, value + 1) as PottyScaleValue;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = Math.max(1, value - 1) as PottyScaleValue;
        break;
      case "Home":
        next = 1;
        break;
      case "End":
        next = 5;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next !== value) onChange(next);
  }

  return (
    <div className="flex flex-col">
      <div
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-valuetext={labels[value - 1]}
        onKeyDown={handleKeyDown}
        className="relative h-12 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-goofy-teal focus-visible:ring-offset-2 focus-visible:ring-offset-goofy-cream"
      >
        {/* Track */}
        <div className="absolute left-[10%] right-[10%] top-5 h-2 rounded-full bg-goofy-teal/20" />

        {/* Fill, from the center stop to the selected stop */}
        <motion.div
          aria-hidden="true"
          className="absolute top-5 h-2 rounded-full bg-goofy-teal"
          initial={false}
          animate={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
          transition={POTTY_SPRING}
        />

        {/* Stop dots */}
        {VALUES.map((stop) => {
          const center = stop === 3;
          return (
            <div
              key={stop}
              aria-hidden="true"
              className={`absolute rounded-full bg-white border-2 border-goofy-teal -translate-x-1/2 ${
                center ? "top-4 w-4 h-4" : "top-[19px] w-2.5 h-2.5"
              }`}
              style={{ left: `${stopPercent(stop)}%` }}
            />
          );
        })}

        {/* Thumb */}
        <motion.div
          aria-hidden="true"
          className="absolute top-0.5 w-11 h-11 rounded-full bg-goofy-yellow border-[3px] border-foreground shadow-md pointer-events-none"
          style={{ x: "-50%" }}
          initial={false}
          animate={{ left: `${pos}%` }}
          transition={POTTY_SPRING}
        />

        {/* Tap zones. Each covers a fifth of the box and snaps to its stop. */}
        <div className="absolute inset-0 flex" aria-hidden="true">
          {VALUES.map((stop) => (
            <button
              key={stop}
              type="button"
              tabIndex={-1}
              onClick={() => {
                if (stop !== value) onChange(stop);
              }}
              className="flex-1 min-w-0 cursor-pointer"
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 text-xs font-semibold text-foreground/60" aria-hidden="true">
        <span>{endLabels[0]}</span>
        <span className="text-center">{endLabels[1]}</span>
        <span className="text-right">{endLabels[2]}</span>
      </div>
    </div>
  );
}
