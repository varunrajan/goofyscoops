"use client";

import { useMemo, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import { Plus } from "lucide-react";
import { usePetStore } from "@/context/PetStore";
import { sortPetEvents } from "@/types/supabase";
import { POTTY_DEFAULTS, POTTY_SPRING } from "@/lib/potty";
import { isPottyEvent, PottyEventRow, type PottyEvent } from "@/components/PottyEventRow";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Dashboard Potty section. Handoff "Section" (frames 2d, 2e).
 * Renders nothing unless potty tracking is on and the pet has a size class.
 * Owns which row is open; that is local state and is never persisted.
 */
export function PottySection() {
  const { pet, settings, events, viewDate, addEvent } = usePetStore();

  // The open row is keyed to the viewDate it was opened on. Changing the
  // date both hides it (openId is null while the dates disagree) and
  // clears it, so coming back does not reopen. Refetches keep ids, so an
  // open row survives a refetch as long as it still exists.
  const [openRow, setOpenRow] = useState<{ id: string; viewDate: string } | null>(null);
  if (openRow && openRow.viewDate !== viewDate) {
    setOpenRow(null);
  }
  const openId = openRow && openRow.viewDate === viewDate ? openRow.id : null;

  // Live region. The zero-width space alternates so two identical
  // announcements in a row are both read.
  const [announcement, setAnnouncement] = useState<{ text: string; n: number }>({ text: "", n: 0 });
  function announce(text: string) {
    setAnnouncement((prev) => ({ text, n: prev.n + 1 }));
  }

  // `events` is already scoped to this pet and viewDate. Filter to the two
  // potty types and sort explicitly; do not rely on the array's order.
  const rows: PottyEvent[] = useMemo(
    () => sortPetEvents(events.filter(isPottyEvent)) as PottyEvent[],
    [events],
  );

  // Announce "Didn't save" when a row newly fails. Derived during render
  // (the React "adjust state on change" pattern) rather than in an effect.
  const failedKey = rows
    .filter((row) => row.saveState === "failed")
    .map((row) => row.id)
    .join(",");
  const [seenFailedKey, setSeenFailedKey] = useState(failedKey);
  if (failedKey !== seenFailedKey) {
    const seen = new Set(seenFailedKey.split(",").filter(Boolean));
    const newlyFailed = failedKey.split(",").filter(Boolean).some((id) => !seen.has(id));
    setSeenFailedKey(failedKey);
    if (newlyFailed) announce("Didn't save");
  }

  if (!settings.potty_tracking_enabled || !pet?.size_class) return null;

  const pees = rows.filter((row) => row.event_type === "potty_pee").length;
  const poops = rows.length - pees;
  const countText = rows.length
    ? `${plural(pees, "pee", "pees")} · ${plural(poops, "poop", "poops")}`
    : "";

  function handleAdd(type: "potty_pee" | "potty_poop") {
    const id =
      type === "potty_pee"
        ? addEvent("potty_pee", { size: POTTY_DEFAULTS.size })
        : addEvent("potty_poop", { size: POTTY_DEFAULTS.size, consistency: POTTY_DEFAULTS.consistency });
    if (!id) return;
    setOpenRow({ id, viewDate });
    announce(type === "potty_pee" ? "Pee logged" : "Poop logged");
  }

  function toggleRow(id: string) {
    setOpenRow((prev) => (prev && prev.id === id && prev.viewDate === viewDate ? null : { id, viewDate }));
  }

  return (
    <MotionConfig reducedMotion="user">
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-[#E8DCC8] flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-extrabold tracking-widest uppercase text-goofy-teal">Potty</h2>
          <span className="text-xs font-semibold text-foreground/60">{countText}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <motion.button
            type="button"
            onClick={() => handleAdd("potty_pee")}
            whileTap={{ scale: 0.92 }}
            transition={POTTY_SPRING}
            className="h-[52px] rounded-full bg-goofy-teal text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#009183] cursor-pointer"
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            Pee
          </motion.button>
          <motion.button
            type="button"
            onClick={() => handleAdd("potty_poop")}
            whileTap={{ scale: 0.92 }}
            transition={POTTY_SPRING}
            className="h-[52px] rounded-full bg-goofy-teal text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#009183] cursor-pointer"
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            Poop
          </motion.button>
        </div>

        {rows.length === 0 ? (
          <div className="bg-goofy-yellow/15 rounded-2xl py-4 px-3 text-center">
            <p className="text-sm font-medium text-foreground/70">No potty breaks yet today. Sniff around! 🐾</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <PottyEventRow
                key={row.id}
                event={row}
                open={row.id === openId}
                onToggle={() => toggleRow(row.id)}
                sizeClass={pet.size_class}
              />
            ))}
          </ul>
        )}

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement.text}
          {announcement.n % 2 === 1 ? "\u200B" : ""}
        </p>
      </section>
    </MotionConfig>
  );
}
