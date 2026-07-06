"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePetStore } from "@/context/PetStore";
import KibbleTracker from "@/components/KibbleTracker";
import ItemTracker from "@/components/ItemTracker";
import DogAvatar from "@/components/DogAvatar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { formatScoopLabel } from "@/lib/scoop";

const GREETINGS = [
  "Woof! Let's eat!",
  "Snack o'clock! 🕐",
  "Who's a hungry pup?",
  "Treats? Did someone say treats?",
  "Belly rubs first, then kibble!",
  "Nom nom time!",
];

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Dashboard() {
  const {
    settings,
    log,
    viewDate,
    setViewDate,
    loading,
    toggleKibble,
    toggleSupplement,
    toggleMed,
  } = usePetStore();

  const [greeting] = useState(
    () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
  );

  function goToPrevDay() {
    const d = new Date(viewDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setViewDate(d.toLocaleDateString("en-CA"));
  }

  function goToNextDay() {
    const d = new Date(viewDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setViewDate(d.toLocaleDateString("en-CA"));
  }

  const isToday = viewDate === new Date().toLocaleDateString("en-CA");

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-4 pt-6 pb-8 flex items-center justify-center min-h-[60vh]">
        <p className="text-foreground/50 font-medium">Loading…</p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-8 flex flex-col gap-5">
      {/* Date Navigation + Pill */}
      <div className="flex items-center gap-2 justify-center">
        <button
          type="button"
          onClick={goToPrevDay}
          className="p-1 text-teal-700 hover:text-teal-900"
          aria-label="View previous day"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="inline-block bg-[#00A896] text-white text-sm font-semibold px-5 py-2 rounded-full shadow-sm">
          {formatDate(viewDate)}
        </span>
        <button
          type="button"
          onClick={goToNextDay}
          className={isToday ? "invisible" : "p-1 text-teal-700 hover:text-teal-900"}
          aria-label="View next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Greeting */}
      <div className="flex items-center gap-3 px-1">
        <DogAvatar size={52} />
        <p className="text-lg font-bold text-[#3D3D3D]">{greeting}</p>
      </div>

      <InstallPrompt />

      {/* Kibble Section */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-[#E8DCC8]">
        <h2 className="text-xs font-extrabold tracking-widest uppercase text-[#00A896] mb-3">
          Meal Scoops (Kibble)
        </h2>
        <div className="flex items-baseline justify-center gap-1 mb-1">
          <span className="text-4xl font-extrabold text-[#3D3D3D]">{log?.kibble_checked ?? 0}</span>
          <span className="text-xl font-bold text-[#3D3D3D]/40">/ {settings.daily_scoops}</span>
        </div>
        <p className="text-center text-xs text-[#3D3D3D]/50 mb-4">
          {formatScoopLabel(settings.scoop_size)} per scoop
        </p>
        <KibbleTracker
          checked={log?.kibble_checked ?? 0}
          total={settings.daily_scoops}
          onToggle={toggleKibble}
        />
        {(log?.kibble_checked ?? 0) >= settings.daily_scoops && (
          <p className="text-center text-sm font-semibold text-[#00A896] mt-4">
            All fed! Good job! 🎉
          </p>
        )}
      </section>

      {/* Supplements Section */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-[#E8DCC8]">
        <h2 className="text-xs font-extrabold tracking-widest uppercase text-[#00A896] mb-3">
          Supplements
        </h2>
        {settings.supplements_config.length > 0 ? (
          <div className="flex flex-col gap-1">
            {settings.supplements_config.map((sup) => (
              <ItemTracker
                key={sup.id}
                label={sup.name}
                checked={log?.supplements_status[sup.id] ?? 0}
                total={sup.frequency}
                onToggle={(index) => toggleSupplement(sup.id, index)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[#FFD166]/15 rounded-2xl py-4 px-3 text-center">
            <p className="text-sm font-medium text-[#3D3D3D]/70">
              No supplements set up yet!
            </p>
          </div>
        )}
      </section>

      {/* Meds Section */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-[#E8DCC8]">
        <h2 className="text-xs font-extrabold tracking-widest uppercase text-[#00A896] mb-3">
          Meds
        </h2>
        {settings.meds_config.length > 0 ? (
          <div className="flex flex-col gap-1">
            {settings.meds_config.map((med) => (
              <ItemTracker
                key={med.id}
                label={med.name}
                checked={log?.meds_status[med.id] ?? 0}
                total={med.frequency}
                onToggle={(index) => toggleMed(med.id, index)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[#FFD166]/15 rounded-2xl py-4 px-3 text-center">
            <p className="text-sm font-medium text-[#3D3D3D]/70">
              No meds today! High paw! 🐾
            </p>
          </div>
        )}
      </section>

      {!log && !isToday && (
        <p className="text-center text-gray-400 text-sm mt-6">Nothing was logged this day.</p>
      )}

      {/* Settings Button */}
      <Link
        href="/settings"
        className="flex items-center justify-center gap-2.5 bg-[#00A896] text-white font-bold text-base py-3.5 rounded-full shadow-md hover:bg-[#009183] active:scale-[0.98] transition-all"
      >
        <Image src="/collar-icon-v2.png" alt="" width={28} height={28} aria-hidden="true" />
        Settings
      </Link>
    </main>
  );
}
