"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { usePetStore } from "@/context/PetStore";
import type { PetEvent } from "@/types/supabase";
import {
  formatPottyTime,
  PET_SIZE_CLASS_LABELS,
  POTTY_SIZE_WORDS,
  POTTY_TEXTURE_WORDS,
  type PetSizeClass,
  type PottyScaleValue,
} from "@/lib/potty";
import { localDate } from "@/lib/local-date";
import { DropletIcon, MoundIcon } from "@/components/PottyIcons";
import { FillScale, SelectScale } from "@/components/PottyScale";
import { DetentSlider } from "@/components/DetentSlider";
import { TimeStepper } from "@/components/TimeStepper";

export type PottyEvent = Extract<PetEvent, { event_type: "potty_pee" | "potty_poop" }>;

export function isPottyEvent(event: PetEvent): event is PottyEvent {
  return event.event_type === "potty_pee" || event.event_type === "potty_poop";
}

const TEXTURE_END_LABELS = [
  POTTY_TEXTURE_WORDS[0],
  POTTY_TEXTURE_WORDS[2],
  POTTY_TEXTURE_WORDS[4],
] as const;

/**
 * Drafts whose row unmounted while the insert was still pending.
 * Flushed when that row is on screen again and saved. A reload before
 * then drops the draft: `events` is filtered to `viewDate`, so nothing
 * mounted can see the saveState change while another day is showing.
 */
const heldTimeEdits = new Map<string, string>();

function sameInstant(stored: string, nextIso: string): boolean {
  const storedMs = Date.parse(stored);
  const nextMs = Date.parse(nextIso);
  return !Number.isNaN(storedMs) && storedMs === nextMs;
}

function startOfLocalDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 0, 0, 0, 0);
}

function endOfLocalDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 23, 59, 59, 999);
}

export interface PottyEventRowProps {
  event: PottyEvent;
  /** Whether the section considers this row open. A failed row never renders open. */
  open: boolean;
  onToggle: () => void;
  sizeClass: PetSizeClass | null;
  /** Civil date the dashboard is showing. Gates future times and "Now". */
  viewDate: string;
  /** True only for a row that just logged, so it mounts with the stepper open. */
  startWithStepper?: boolean;
}

/**
 * One potty event. Handoff "Event row" (frame 2d), the approved failed-row
 * proposal, and "Edit time" (frame 2g). Which row is open belongs to
 * PottySection. Whether the stepper is showing is local to this row.
 */
export function PottyEventRow({
  event,
  open,
  onToggle,
  sizeClass,
  viewDate,
  startWithStepper = false,
}: PottyEventRowProps) {
  const { updateEvent, removeEvent, retryEvent } = usePetStore();

  const [editing, setEditing] = useState(startWithStepper);
  const [draft, setDraft] = useState(
    () => new Date(heldTimeEdits.get(event.id) ?? event.occurred_at),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Bumped when the row closes around an open stepper, so the flush below
  // runs even though saveState and occurred_at have not changed yet.
  const [closeNonce, setCloseNonce] = useState(0);

  const isPee = event.event_type === "potty_pee";
  const failed = event.saveState === "failed";
  const isOpen = open && !failed;
  const showNow = viewDate === localDate();

  const draftRef = useRef(draft);
  const editingRef = useRef(editing);
  const saveStateRef = useRef(event.saveState);
  const occurredAtRef = useRef(event.occurred_at);
  const idRef = useRef(event.id);
  const updateEventRef = useRef(updateEvent);
  const skipCommitRef = useRef(false);
  const writeLockRef = useRef<string | null>(null);

  const writeOccurredAt = useCallback((id: string, iso: string) => {
    if (writeLockRef.current === iso) return;
    writeLockRef.current = iso;
    queueMicrotask(() => {
      if (writeLockRef.current === iso) writeLockRef.current = null;
    });
    updateEventRef.current(id, { occurred_at: iso });
  }, []);

  // P3: one write when the stepper closes, the row unmounts, or the
  // document hides. P5: if the insert has not landed, remember the draft
  // and write it once the row is saved. A failed row drops the draft.
  const commitDraft = useCallback(() => {
    const id = idRef.current;
    const next = draftRef.current.toISOString();
    const saveState = saveStateRef.current;
    const stored = occurredAtRef.current;

    if (saveState === "failed" || sameInstant(stored, next)) {
      heldTimeEdits.delete(id);
      return;
    }
    if (saveState === "pending") {
      heldTimeEdits.set(id, next);
      return;
    }
    heldTimeEdits.delete(id);
    writeOccurredAt(id, next);
  }, [writeOccurredAt]);

  useEffect(() => {
    draftRef.current = draft;
    editingRef.current = editing;
    saveStateRef.current = event.saveState;
    occurredAtRef.current = event.occurred_at;
    idRef.current = event.id;
    updateEventRef.current = updateEvent;
  }, [draft, editing, event.saveState, event.occurred_at, event.id, updateEvent]);

  useEffect(() => {
    if (!editing || !showNow) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [editing, showNow]);

  useEffect(() => {
    if (event.saveState === "pending") return;
    const held = heldTimeEdits.get(event.id);
    if (!held) return;
    heldTimeEdits.delete(event.id);
    if (event.saveState === "failed") return;
    if (!sameInstant(event.occurred_at, held)) writeOccurredAt(event.id, held);
  }, [closeNonce, event.id, event.saveState, event.occurred_at, writeOccurredAt]);

  useEffect(() => {
    if (!editing) return;
    function handleVisibility() {
      if (document.visibilityState === "hidden") commitDraft();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [editing, commitDraft]);

  useEffect(() => {
    return () => {
      if (skipCommitRef.current || !editingRef.current) return;
      commitDraft();
    };
  }, [commitDraft]);

  // The row collapsed, switched away, or failed while the stepper was open.
  // Stash the draft here so the next render can show it, and so the flush
  // effect above can write it once the insert has landed.
  if (editing && !isOpen) {
    const next = draft.toISOString();
    if (failed || sameInstant(event.occurred_at, next)) {
      heldTimeEdits.delete(event.id);
    } else {
      heldTimeEdits.set(event.id, next);
    }
    setEditing(false);
    setCloseNonce((nonce) => nonce + 1);
  }

  const title = isPee ? "Pee" : "Poop";
  const shownIso = editing ? draft.toISOString() : (heldTimeEdits.get(event.id) ?? event.occurred_at);
  const time = formatPottyTime(shownIso);
  const sizeWord = POTTY_SIZE_WORDS[event.data.size - 1];
  const summary = isPee
    ? sizeWord
    : `${sizeWord} · ${POTTY_TEXTURE_WORDS[event.data.consistency - 1]}`;
  const Icon = isPee ? DropletIcon : MoundIcon;

  const dayStart = startOfLocalDay(event.local_date);
  const dayEnd = endOfLocalDay(event.local_date);
  const max = showNow ? new Date(Math.min(nowMs, dayEnd.getTime())) : dayEnd;

  function handleDraft(next: Date) {
    draftRef.current = next;
    setDraft(next);
    if (heldTimeEdits.has(event.id)) heldTimeEdits.set(event.id, next.toISOString());
  }

  function handleEditClick() {
    if (editing) {
      commitDraft();
      setEditing(false);
      return;
    }
    setNowMs(Date.now());
    const opened = new Date(heldTimeEdits.get(event.id) ?? event.occurred_at);
    draftRef.current = opened;
    setDraft(opened);
    setEditing(true);
  }

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

  function handleDelete() {
    skipCommitRef.current = true;
    heldTimeEdits.delete(event.id);
    removeEvent(event.id);
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
          className={`${isOpen ? "flex-none" : "flex-1"} min-w-0 min-h-11 flex items-center gap-2.5 text-left ${
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

        {isOpen && (
          <button
            type="button"
            aria-expanded={editing}
            aria-label={editing ? "Done editing time" : `Edit time for ${title} at ${time}`}
            onClick={handleEditClick}
            className="shrink-0 min-h-11 px-2 text-sm font-bold text-teal-700 underline underline-offset-[3px] cursor-pointer"
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}

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
            onClick={handleDelete}
            aria-label="Remove this entry"
            className={`w-11 h-11 shrink-0 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors cursor-pointer ${
              isOpen ? "-my-1.5 -mr-1.5 ml-auto" : "-m-1.5"
            }`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {isOpen && editing && (
        <TimeStepper
          value={draft}
          onChange={handleDraft}
          min={dayStart}
          max={max}
          showNow={showNow}
        />
      )}

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
