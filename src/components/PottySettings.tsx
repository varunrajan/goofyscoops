"use client";

import { useRef } from "react";
import { motion, MotionConfig } from "framer-motion";
import { usePetStore } from "@/context/PetStore";
import {
  PET_SIZE_CLASSES,
  PET_SIZE_CLASS_LABELS,
  POTTY_SPRING,
  type PetSizeClass,
} from "@/lib/potty";

const SIZE_LABEL_ID = "potty-size-label";

/**
 * Settings card for potty tracking. Built from the handoff, frame 2f.
 * Sits between Medications and Invite Partner.
 */
export function PottySettings() {
  const { pet, settings, updateSettings, updatePetSize } = usePetStore();
  const pillRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const enabled = settings.potty_tracking_enabled;
  const petName = pet?.name ?? "your pup";
  const sizeClass = pet?.size_class ?? null;

  const note = enabled
    ? "On for everyone in your household. Turning it off hides it; nothing gets deleted."
    : "Off. Turning it on shows it for everyone in your household.";

  const sizeHelp = sizeClass
    ? `Poop sizes are relative to this, so "Big" means big for a ${PET_SIZE_CLASS_LABELS[sizeClass]} pup.`
    : `Pick ${petName}'s size to start logging.`;

  // Roving tabIndex: the selected pill is the one tab stop, or the first
  // pill when nothing is selected yet.
  const tabStopIndex = sizeClass ? PET_SIZE_CLASSES.indexOf(sizeClass) : 0;

  function selectSize(index: number) {
    const next = PET_SIZE_CLASSES[index];
    if (next !== sizeClass) updatePetSize(next);
    pillRefs.current[index]?.focus();
  }

  function handlePillKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = PET_SIZE_CLASSES.length - 1;
    let target: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        target = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        target = index === 0 ? last : index - 1;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectSize(target);
  }

  return (
    <MotionConfig reducedMotion="user">
      <section className="bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-4">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => updateSettings({ potty_tracking_enabled: !enabled })}
          className="w-full min-h-11 flex items-center justify-between gap-4 text-left cursor-pointer"
        >
          <span className="flex flex-col gap-1">
            <span className="text-lg font-bold">Potty Tracking</span>
            <span className="text-sm text-foreground/60 leading-snug">
              Log pees and poops so everyone knows when {petName} last went out.
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`relative shrink-0 w-[52px] h-8 rounded-full transition-colors duration-200 ${
              enabled ? "bg-goofy-teal" : "bg-foreground/20"
            }`}
          >
            <motion.span
              className="absolute top-[3px] left-[3px] w-[26px] h-[26px] rounded-full bg-white shadow"
              initial={false}
              animate={{ x: enabled ? 20 : 0 }}
              transition={POTTY_SPRING}
            />
          </span>
        </button>

        <p className="text-xs text-foreground/60">{note}</p>

        {enabled && (
          <div className="border-t border-[#E8DCC8] pt-4 flex flex-col gap-2">
            <p id={SIZE_LABEL_ID} className="text-sm font-medium">
              {`${petName}'s size`}
            </p>
            <div
              role="radiogroup"
              aria-labelledby={SIZE_LABEL_ID}
              className="flex flex-wrap gap-2"
            >
              {PET_SIZE_CLASSES.map((size: PetSizeClass, index) => {
                const selected = size === sizeClass;
                return (
                  <button
                    key={size}
                    ref={(el) => {
                      pillRefs.current[index] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={index === tabStopIndex ? 0 : -1}
                    onClick={() => selectSize(index)}
                    onKeyDown={(event) => handlePillKeyDown(event, index)}
                    className={`min-h-11 px-4 rounded-full text-sm font-semibold border-2 transition-colors duration-150 cursor-pointer ${
                      selected
                        ? "bg-goofy-teal text-white border-goofy-teal"
                        : "bg-transparent text-goofy-teal border-goofy-teal/30 hover:border-goofy-teal"
                    }`}
                  >
                    {PET_SIZE_CLASS_LABELS[size]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-foreground/60">{sizeHelp}</p>
          </div>
        )}
      </section>
    </MotionConfig>
  );
}
