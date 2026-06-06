"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DogAvatar from "@/components/DogAvatar";
import type { ScoopSize } from "@/types/supabase";

const SCOOP_SIZES: ScoopSize[] = ["1/4", "1/3", "1/2", "2/3", "3/4", "1"];

function scoopSizeToNumber(size: ScoopSize): number {
  const map: Record<ScoopSize, number> = {
    "0": 0, "1/4": 0.25, "1/3": 1 / 3, "1/2": 0.5,
    "2/3": 2 / 3, "3/4": 0.75, "1": 1,
  };
  return map[size];
}

function formatCups(cups: number): string {
  if (cups === 0) return "0 cups";
  const rounded = Math.round(cups * 100) / 100;
  return `${rounded} cup${rounded !== 1 ? "s" : ""}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [petName, setPetName] = useState("");
  const [scoopSize, setScoopSize] = useState<ScoopSize>("1/2");
  const [dailyScoops, setDailyScoops] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalCups = scoopSizeToNumber(scoopSize) * dailyScoops;

  async function handleFinish() {
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.rpc("create_household_with_pet", {
      pet_name: petName.trim(),
      scoop_size: scoopSize,
      daily_scoops: dailyScoops,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Progress dots */}
        <div className="flex gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                s <= step ? "bg-goofy-teal" : "bg-goofy-teal/20"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="w-full flex flex-col items-center gap-6">
            <DogAvatar size={100} />
            <h1 className="text-3xl font-extrabold tracking-tight">
              Add Your Pet
            </h1>

            <div className="w-full bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-4">
              <div>
                <label htmlFor="pet-name" className="block text-sm font-medium mb-1.5">
                  Pet&apos;s name
                </label>
                <input
                  id="pet-name"
                  type="text"
                  required
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && petName.trim()) setStep(2);
                  }}
                  className="w-full border-2 border-goofy-teal/20 rounded-xl px-4 py-3 text-sm bg-transparent focus:border-goofy-teal outline-none transition-colors"
                  placeholder="Buddy, Luna, Goofy…"
                  autoFocus
                />
              </div>

              <button
                type="button"
                disabled={!petName.trim()}
                onClick={() => setStep(2)}
                className="w-full bg-goofy-teal text-white font-bold text-base py-3.5 rounded-full shadow-md hover:bg-goofy-teal/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="w-full flex flex-col items-center gap-6">
            <h1 className="text-3xl font-extrabold tracking-tight">
              Meal Setup
            </h1>

            <div className="w-full bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-5">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              {/* Scoop Size */}
              <div>
                <label className="block text-sm font-medium mb-2">Select a scoop size</label>
                <div className="grid grid-cols-2 gap-2">
                  {SCOOP_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setScoopSize(size)}
                      className={`
                        px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-colors cursor-pointer
                        ${scoopSize === size
                          ? "bg-goofy-yellow text-foreground border-goofy-yellow"
                          : "bg-transparent text-foreground border-goofy-teal/30 hover:border-goofy-teal"
                        }
                      `}
                    >
                      {size} cup
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily Scoops */}
              <div>
                <label className="block text-sm font-medium mb-2">Number of daily scoops</label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setDailyScoops(Math.max(1, dailyScoops - 1))}
                    className="w-12 h-12 rounded-full bg-goofy-yellow text-foreground font-bold text-xl flex items-center justify-center hover:bg-goofy-yellow/80 transition-colors cursor-pointer"
                  >
                    −
                  </button>
                  <span className="text-3xl font-extrabold w-10 text-center">
                    {dailyScoops}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDailyScoops(Math.min(20, dailyScoops + 1))}
                    className="w-12 h-12 rounded-full bg-goofy-yellow text-foreground font-bold text-xl flex items-center justify-center hover:bg-goofy-yellow/80 transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Daily Total */}
              <div className="bg-goofy-teal/10 rounded-2xl p-4 text-center">
                <p className="text-lg font-extrabold">
                  Daily Total: {formatCups(totalCups)}
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleFinish}
                className="w-full bg-goofy-teal text-white font-bold text-base py-3.5 rounded-full shadow-md hover:bg-goofy-teal/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {loading ? "Setting up…" : "Start Tracking!"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
