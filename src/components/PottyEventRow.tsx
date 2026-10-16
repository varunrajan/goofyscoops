"use client";

import { Trash2 } from "lucide-react";
import { usePetStore } from "@/context/PetStore";
import type { PetEvent } from "@/types/supabase";
import {
  PET_SIZE_CLASS_LABELS,
  POTTY_SIZE_WORDS,
  POTTY_TEXTURE_WORDS,
  type PetSizeClass,
  type PottyScaleValue,
} from "@/lib/potty";
import { DropletIcon, MoundIcon } from "@/components/PottyIcons";
import { FillScale, SelectScale } from "@/components/PottyScale";
import { DetentSlider } from "@/components/DetentSlider";

export type PottyEvent = Extract<PetEvent, { event_type: "potty_pee" | "potty_poop" }>;

export function isPottyEvent(event: PetEvent): event is PottyEvent {
  return event.event_type === "potty_pee" || event.event_type === "potty_poop";
}

export function formatPottyTime(occurredAt: string): string {
  return new Date(occurredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const TEXTURE_END_LABELS = [
  POTTY_TEXTURE_WORDS[0],
  POTTY_TEXTURE_WORDS[2],
  POTTY_TEXTURE_WORDS[4],
] as const;

export interface PottyEventRowProps {
  event: PottyEvent;
  /** Whether the section considers this row open. A failed row never renders open. */
  open: boolean;
  onToggle: () => void;
  sizeClass: PetSizeClass | null;
}

/**
 * One potty event. Handoff "Event row" (frame 2d) and the approved
 * failed-row proposal. Owns no persistent state; which row is open belongs
 * to PottySection.
 */
export function PottyEventRow({ event, open, onToggle, sizeClass }: PottyEventRowProps) {
  const { updateEvent, removeEvent, retryEvent } = usePetStore();

  const isPee = event.event_type === "potty_pee";
  const failed = event.saveState === "failed";
  const isOpen = open && !failed;

  const title = isPee ? "Pee" : "Poop";
  const time = formatPottyTime(event.occurred_at);
  const sizeWord = POTTY_SIZE_WORDS[event.data.size - 1];
  const summary = isPee
    ? sizeWord
    : `${sizeWord} · ${POTTY_TEXTURE_WORDS[event.data.consistency - 1]}`;
  const Icon = isPee ? DropletIcon : MoundIcon;

  // Always send the complete data object, never a partial.
  function setSize(size: PottyScaleValue) {
    updateEvent(event.id, { data: { ...event.data, size } });
  }

  function setConsistency(consistency: PottyScaleValue) {
    if (event.event_type !== "potty_poop") return;
    updateEvent(event.id, { data: { ...event.data, consistency } });
  }

  function handleRetry() {
    retryEvent(event.id);
    // The retried row shows the normal pending look, collapsed. Drop the
    // section's open claim on it so it does not pop open mid-flight.
    if (open) onToggle();
  }

  return (
    <li
      className={`rounded-xl flex flex-col gap-2.5 ${failed ? "bg-red-50" : "bg-goofy-cream"} ${
        isOpen ? "p-3" : "py-1 px-3"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-disabled={failed || undefined}
          aria-label={`${title} at ${time}`}
          onClick={() => {
            if (!failed) onToggle();
          }}
          className={`flex-1 min-w-0 min-h-11 flex items-center gap-2.5 text-left ${
            failed ? "cursor-default" : "cursor-pointer"
          }`}
        >
          <span className="w-8 h-8 shrink-0 rounded-full bg-goofy-teal/10 text-goofy-teal flex items-center justify-center">
            <Icon size={16} />
          </span>
          <span className="text-sm font-semibold">{title}</span>
          {failed ? (
            <span className="text-xs font-semibold text-red-600 whitespace-nowrap">Didn&apos;t save</span>
          ) : (
            <span className="text-xs text-foreground/60 whitespace-nowrap">{time}</span>
          )}
          {!isOpen && !failed && (
            <span className="ml-auto text-xs font-semibold text-foreground/70 truncate">{summary}</span>
          )}
        </button>

        {failed && (
          <button
            type="button"
            onClick={handleRetry}
            className="ml-auto shrink-0 min-h-11 px-3 text-xs font-bold text-red-600 cursor-pointer"
          >
            Retry
          </button>
        )}

        {(isOpen || failed) && (
          <button
            type="button"
            onClick={() => removeEvent(event.id)}
            aria-label="Remove this entry"
            className="w-11 h-11 -m-1.5 shrink-0 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors cursor-pointer"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {isOpen && event.event_type === "potty_pee" && (
        <>
          <div className="flex items-baseline justify-between px-1">
            <span className="text-xs font-semibold text-foreground/60">Size</span>
            <span className="text-sm font-bold">{sizeWord}</span>
          </div>
          <FillScale
            value={event.data.size}
            onChange={setSize}
            labels={POTTY_SIZE_WORDS}
            icon={DropletIcon}
            ariaLabel="Pee size"
          />
        </>
      )}

      {isOpen && event.event_type === "potty_poop" && (
        <>
          <div className="flex items-baseline justify-between px-1">
            <span className="text-xs font-semibold text-foreground/60">Size</span>
            <span className="text-sm">
              <b className="font-bold">{sizeWord}</b>
              {sizeClass ? ` for a ${PET_SIZE_CLASS_LABELS[sizeClass]} pup` : ""}
            </span>
          </div>
          <SelectScale
            value={event.data.size}
            onChange={setSize}
            labels={POTTY_SIZE_WORDS}
            icon={MoundIcon}
            ariaLabel="Poop size"
          />
          <div className="flex items-baseline justify-between px-1 mt-0.5">
            <span className="text-xs font-semibold text-foreground/60">Texture</span>
            <span className="text-sm font-bold">{POTTY_TEXTURE_WORDS[event.data.consistency - 1]}</span>
          </div>
          <DetentSlider
            value={event.data.consistency}
            onChange={setConsistency}
            labels={POTTY_TEXTURE_WORDS}
            endLabels={TEXTURE_END_LABELS}
            ariaLabel="Texture"
          />
        </>
      )}
    </li>
  );
}
