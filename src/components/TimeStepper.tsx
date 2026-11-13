"use client";

import { Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { formatPottyTime, POTTY_SPRING } from "@/lib/potty";

const MINUTE_MS = 60_000;

export interface TimeStepperProps {
  /** Instant shown in the readout. Stepping preserves its seconds. */
  value: Date;
  onChange: (next: Date) => void;
  /** Earliest allowed instant, inclusive. A step past it is disabled. */
  min: Date;
  /** Latest allowed instant, inclusive. A step past it is disabled. */
  max: Date;
  /** When false, "Now" is omitted and the chip row is two columns. */
  showNow: boolean;
}

function inRange(instant: Date, min: Date, max: Date): boolean {
  const time = instant.getTime();
  return time >= min.getTime() && time <= max.getTime();
}

function shift(value: Date, deltaMs: number): Date {
  return new Date(value.getTime() + deltaMs);
}

/** Splits `formatPottyTime` ("7:58 AM") into the clock and the period. */
function splitPottyTime(value: Date): { formatted: string; clock: string; period: string } {
  const formatted = formatPottyTime(value.toISOString());
  const parts = formatted.trim().split(/\s+/);
  if (parts.length < 2) return { formatted, clock: formatted, period: "" };
  return {
    formatted,
    clock: parts.slice(0, -1).join(" "),
    period: parts[parts.length - 1],
  };
}

function stepButtonClass(enabled: boolean): string {
  return [
    "w-[52px] h-[52px] shrink-0 rounded-full bg-white border-2 border-goofy-teal text-teal-700",
    "flex items-center justify-center touch-manipulation",
    enabled ? "cursor-pointer" : "opacity-40 cursor-default",
  ].join(" ");
}

function chipClass(tone: "now" | "step", enabled: boolean): string {
  return [
    "min-h-11 rounded-full bg-white border border-[#E8DCC8] text-sm font-bold",
    tone === "now" ? "text-teal-700" : "text-foreground",
    enabled ? "cursor-pointer" : "opacity-40 cursor-default",
  ].join(" ");
}

/**
 * Minute stepper. Handoff "Edit time (frame 2g)".
 * Knows nothing about events or the store: the row decides min, max, and
 * whether "Now" exists, and it decides when the resulting draft is saved.
 * One tap is one step. Holding a button does not repeat.
 */
export function TimeStepper({ value, onChange, min, max, showNow }: TimeStepperProps) {
  const { formatted, clock, period } = splitPottyTime(value);
  const canMinus = inRange(shift(value, -MINUTE_MS), min, max);
  const canPlus = inRange(shift(value, MINUTE_MS), min, max);
  const canMinusFive = inRange(shift(value, -5 * MINUTE_MS), min, max);
  const canPlusFive = inRange(shift(value, 5 * MINUTE_MS), min, max);

  function step(deltaMs: number) {
    const next = shift(value, deltaMs);
    if (!inRange(next, min, max)) return;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2.5 pb-1">
      <div className="flex items-center justify-between gap-2">
        <motion.button
          type="button"
          aria-label="One minute earlier"
          disabled={!canMinus}
          whileTap={canMinus ? { scale: 0.88 } : undefined}
          transition={POTTY_SPRING}
          onClick={() => step(-MINUTE_MS)}
          className={stepButtonClass(canMinus)}
        >
          <Minus size={20} strokeWidth={3} aria-hidden="true" />
        </motion.button>

        <div
          className="flex items-baseline gap-1.5 tabular-nums"
          aria-live="polite"
          aria-atomic="true"
          aria-label={formatted}
        >
          <span className="text-4xl font-extrabold tracking-tight leading-none">{clock}</span>
          <span className="text-sm font-bold text-foreground/70">{period}</span>
        </div>

        <motion.button
          type="button"
          aria-label="One minute later"
          disabled={!canPlus}
          whileTap={canPlus ? { scale: 0.88 } : undefined}
          transition={POTTY_SPRING}
          onClick={() => step(MINUTE_MS)}
          className={stepButtonClass(canPlus)}
        >
          <Plus size={20} strokeWidth={3} aria-hidden="true" />
        </motion.button>
      </div>

      <div className={`grid gap-2 ${showNow ? "grid-cols-3" : "grid-cols-2"}`}>
        <button
          type="button"
          disabled={!canMinusFive}
          onClick={() => step(-5 * MINUTE_MS)}
          className={chipClass("step", canMinusFive)}
        >
          {"\u22125 min"}
        </button>
        {showNow && (
          <button type="button" onClick={() => onChange(new Date())} className={chipClass("now", true)}>
            Now
          </button>
        )}
        <button
          type="button"
          disabled={!canPlusFive}
          onClick={() => step(5 * MINUTE_MS)}
          className={chipClass("step", canPlusFive)}
        >
          +5 min
        </button>
      </div>
    </div>
  );
}
