"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { POTTY_SPRING, type PottyScaleValue } from "@/lib/potty";
import type { PottyIconProps } from "@/components/PottyIcons";

/** Glyph sizes for values 1 to 5. From the board. */
const MARK_PX = [12, 16, 20, 24, 28] as const;
const VALUES: readonly PottyScaleValue[] = [1, 2, 3, 4, 5];

export interface PottyScaleProps {
  /** `fill`: a bar grows to the selected mark. `select`: one mark is highlighted. */
  mode: "fill" | "select";
  value: PottyScaleValue;
  onChange: (value: PottyScaleValue) => void;
  /** One word per value, indexed `labels[value - 1]`. Used as the radio labels. */
  labels: readonly string[];
  icon: React.ComponentType<PottyIconProps>;
  /** Radiogroup label, e.g. "Pee size". */
  ariaLabel: string;
}

/**
 * Five-point graduated scale. Handoff: FillScale (frame 2a) and SelectScale
 * (frame 2b) share a container and mark spec, so they are one component.
 *
 * Accessibility: radiogroup of radios with roving tabIndex. Arrow keys step
 * the value (clamped at the ends; this is an ordinal scale, not a cycle),
 * Home and End jump.
 */
export function PottyScale({ mode, value, onChange, labels, icon: Icon, ariaLabel }: PottyScaleProps) {
  const markRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(next: PottyScaleValue) {
    if (next !== value) onChange(next);
    markRefs.current[next - 1]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
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
    select(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative flex bg-white border border-[#E8DCC8] rounded-full overflow-hidden"
    >
      {mode === "fill" && (
        <motion.div
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 bg-goofy-yellow rounded-full"
          initial={false}
          animate={{ width: `${value * 20}%` }}
          transition={POTTY_SPRING}
        />
      )}
      {VALUES.map((mark) => {
        const selected = mark === value;
        const colorClass =
          mode === "fill"
            ? mark <= value
              ? "text-foreground"
              : "text-goofy-teal"
            : selected
              ? "bg-goofy-yellow text-foreground"
              : "bg-transparent text-goofy-teal";
        return (
          <motion.button
            key={mark}
            ref={(el) => {
              markRefs.current[mark - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={labels[mark - 1]}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(mark)}
            onKeyDown={handleKeyDown}
            whileTap={{ scale: 0.8 }}
            transition={POTTY_SPRING}
            className={`relative flex-1 min-w-0 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200 ${colorClass}`}
          >
            <Icon size={MARK_PX[mark - 1]} />
          </motion.button>
        );
      })}
    </div>
  );
}

export type FillScaleProps = Omit<PottyScaleProps, "mode">;
export type SelectScaleProps = Omit<PottyScaleProps, "mode">;

/** Pee size. Handoff frame 2a. */
export function FillScale(props: FillScaleProps) {
  return <PottyScale mode="fill" {...props} />;
}

/** Poop size. Handoff frame 2b. */
export function SelectScale(props: SelectScaleProps) {
  return <PottyScale mode="select" {...props} />;
}
