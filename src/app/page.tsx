"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePetStore } from "@/context/PetStore";
import KibbleTracker from "@/components/KibbleTracker";
import ItemTracker from "@/components/ItemTracker";
import DogAvatar from "@/components/DogAvatar";

const GREETINGS = [
  "Woof! Let's eat!",
  "Snack o'clock! 🕐",
  "Who's a hungry pup?",
  "Treats? Did someone say treats?",
  "Belly rubs first, then kibble!",
  "Nom nom time!",
];

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
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
    loading,
    toggleKibble,
    toggleSupplement,
    toggleMed,
  } = usePetStore();

  const [greeting] = useState(
    () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
  );

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-4 pt-6 pb-8 flex items-center justify-center min-h-[60vh]">
        <p className="text-foreground/50 font-medium">Loading…</p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-8 flex flex-col gap-5">
      {/* Date Pill */}
      <div className="flex justify-center">
        <span className="inline-block bg-[#00A896] text-white text-sm font-semibold px-5 py-2 rounded-full shadow-sm">
          {formatDate()}
        </span>
      </div>

      {/* Greeting */}
      <div className="flex items-center gap-3 px-1">
        <DogAvatar size={52} />
        <p className="text-lg font-bold text-[#3D3D3D]">{greeting}</p>
      </div>

      {/* Kibble Section */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-[#E8DCC8]">
        <h2 className="text-xs font-extrabold tracking-widest uppercase text-[#00A896] mb-3">
          Meal Scoops (Kibble)
        </h2>
        <div className="flex items-baseline justify-center gap-1 mb-1">
          <span className="text-4xl font-extrabold text-[#3D3D3D]">{log.kibble_checked}</span>
          <span className="text-xl font-bold text-[#3D3D3D]/40">/ {settings.daily_scoops}</span>
        </div>
        <p className="text-center text-xs text-[#3D3D3D]/50 mb-4">
          {settings.scoop_size} cup per scoop
        </p>
        <KibbleTracker
          checked={log.kibble_checked}
          total={settings.daily_scoops}
          onToggle={toggleKibble}
        />
        {log.kibble_checked >= settings.daily_scoops && (
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
                checked={log.supplements_status[sup.id] ?? 0}
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
                checked={log.meds_status[med.id] ?? 0}
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
