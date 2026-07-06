"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Pet, PetSettings, DailyLog, SupplementConfig, MedConfig } from "@/types/supabase";
import { normalizeScoopSize } from "@/lib/scoop";

function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

const DEFAULT_SETTINGS: PetSettings = {
  pet_id: "",
  meal_type: "Kibble",
  scoop_size: "1/2",
  daily_scoops: 4,
  supplements_config: [],
  meds_config: [],
};

interface PetStoreContextValue {
  pet: Pet | null;
  settings: PetSettings;
  log: DailyLog | null;
  viewDate: string;
  setViewDate: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  toggleKibble: (index: number) => void;
  toggleSupplement: (id: string, index: number) => void;
  toggleMed: (id: string, index: number) => void;
  updateSettings: (patch: Partial<PetSettings>) => void;
  addSupplement: (supplement: SupplementConfig) => void;
  updateSupplement: (id: string, patch: Partial<Omit<SupplementConfig, "id">>) => void;
  removeSupplement: (id: string) => void;
  addMed: (med: MedConfig) => void;
  updateMed: (id: string, patch: Partial<Omit<MedConfig, "id">>) => void;
  removeMed: (id: string) => void;
}

const PetStoreContext = createContext<PetStoreContextValue | null>(null);

export function PetStoreProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pet, setPet] = useState<Pet | null>(null);
  const [settings, setSettings] = useState<PetSettings>(DEFAULT_SETTINGS);
  const [viewDate, setViewDate] = useState<string>(today());
  const [log, setLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);

  const buildEmptyLog = useCallback((petId: string): DailyLog => ({
    id: "",
    pet_id: petId,
    date: viewDate,
    kibble_checked: 0,
    supplements_status: {},
    meds_status: {},
  }), [viewDate]);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: petData } = await supabase
      .from("pets")
      .select("*")
      .limit(1)
      .single();

    if (!petData) {
      setLoading(false);
      return;
    }

    setPet({ id: petData.id, name: petData.name, household_id: petData.household_id });

    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .eq("pet_id", petData.id)
      .single();

    if (settingsData) {
      const scoopSize = normalizeScoopSize(settingsData.scoop_size);
      setSettings({
        pet_id: settingsData.pet_id,
        meal_type: settingsData.meal_type,
        scoop_size: scoopSize,
        daily_scoops: settingsData.daily_scoops,
        supplements_config: settingsData.supplements_config as SupplementConfig[],
        meds_config: settingsData.meds_config as MedConfig[],
      });

      if (scoopSize !== settingsData.scoop_size) {
        await supabase
          .from("settings")
          .update({ scoop_size: scoopSize })
          .eq("pet_id", settingsData.pet_id);
      }
    }

    const { data: logData } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("pet_id", petData.id)
      .eq("date", viewDate)
      .maybeSingle();

    if (logData) {
      setLog({
        id: logData.id,
        pet_id: logData.pet_id,
        date: logData.date,
        kibble_checked: logData.kibble_checked,
        supplements_status: logData.supplements_status as Record<string, number>,
        meds_status: logData.meds_status as Record<string, number>,
      });
    } else {
      setLog(null);
    }

    setLoading(false);
  }, [viewDate]);

  useEffect(() => {
    fetchData();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchData, pathname]);

  // --- Persist helpers (fire-and-forget) ---

  const persistSettings = useCallback(async (next: PetSettings) => {
    const supabase = createClient();
    await supabase
      .from("settings")
      .update({
        meal_type: next.meal_type,
        scoop_size: next.scoop_size,
        daily_scoops: next.daily_scoops,
        supplements_config: next.supplements_config,
        meds_config: next.meds_config,
      })
      .eq("pet_id", next.pet_id);
  }, []);

  const persistLog = useCallback(async (next: DailyLog) => {
    const supabase = createClient();
    await supabase.from("daily_logs").upsert(
      {
        pet_id: next.pet_id,
        date: next.date,
        kibble_checked: next.kibble_checked,
        supplements_status: next.supplements_status,
        meds_status: next.meds_status,
      },
      { onConflict: "pet_id,date" }
    );
  }, []);

  // --- Mutations (optimistic local update + background persist) ---

  const toggleKibble = useCallback((index: number) => {
    setLog((prev) => {
      const petId = pet?.id ?? settings.pet_id;
      const base: DailyLog = prev ?? buildEmptyLog(petId);

      let next = base;
      if (index === base.kibble_checked && base.kibble_checked < settings.daily_scoops) {
        next = { ...base, kibble_checked: base.kibble_checked + 1 };
      } else if (index === base.kibble_checked - 1 && base.kibble_checked > 0) {
        next = { ...base, kibble_checked: base.kibble_checked - 1 };
      }

      if (!next.pet_id) {
        return prev;
      }

      if (next !== base) {
        if (next.date !== viewDate) {
          next = { ...next, date: viewDate };
        }
        persistLog(next);
      }
      return next;
    });
  }, [pet?.id, settings.daily_scoops, settings.pet_id, viewDate, buildEmptyLog, persistLog]);

  const toggleSupplement = useCallback((id: string, index: number) => {
    setLog((prev) => {
      const petId = pet?.id ?? settings.pet_id;
      const base: DailyLog = prev ?? buildEmptyLog(petId);
      const current = base.supplements_status[id] ?? 0;
      const config = settings.supplements_config.find((s) => s.id === id);
      const max = config?.frequency ?? 1;
      let next = base;
      if (index === current && current < max) {
        next = { ...base, supplements_status: { ...base.supplements_status, [id]: current + 1 } };
      } else if (index === current - 1 && current > 0) {
        next = { ...base, supplements_status: { ...base.supplements_status, [id]: current - 1 } };
      }

      if (!next.pet_id) {
        return prev;
      }

      if (next !== base) {
        if (next.date !== viewDate) {
          next = { ...next, date: viewDate };
        }
        persistLog(next);
      }
      return next;
    });
  }, [pet?.id, settings.pet_id, settings.supplements_config, viewDate, buildEmptyLog, persistLog]);

  const toggleMed = useCallback((id: string, index: number) => {
    setLog((prev) => {
      const petId = pet?.id ?? settings.pet_id;
      const base: DailyLog = prev ?? buildEmptyLog(petId);
      const current = base.meds_status[id] ?? 0;
      const config = settings.meds_config.find((m) => m.id === id);
      const max = config?.frequency ?? 1;
      let next = base;
      if (index === current && current < max) {
        next = { ...base, meds_status: { ...base.meds_status, [id]: current + 1 } };
      } else if (index === current - 1 && current > 0) {
        next = { ...base, meds_status: { ...base.meds_status, [id]: current - 1 } };
      }

      if (!next.pet_id) {
        return prev;
      }

      if (next !== base) {
        if (next.date !== viewDate) {
          next = { ...next, date: viewDate };
        }
        persistLog(next);
      }
      return next;
    });
  }, [pet?.id, settings.meds_config, settings.pet_id, viewDate, buildEmptyLog, persistLog]);

  const updateSettings = useCallback((patch: Partial<PetSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const addSupplement = useCallback((supplement: SupplementConfig) => {
    setSettings((prev) => {
      const next = { ...prev, supplements_config: [...prev.supplements_config, supplement] };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const updateSupplement = useCallback((id: string, patch: Partial<Omit<SupplementConfig, "id">>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        supplements_config: prev.supplements_config.map((s) =>
          s.id === id ? { ...s, ...patch } : s
        ),
      };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const removeSupplement = useCallback((id: string) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        supplements_config: prev.supplements_config.filter((s) => s.id !== id),
      };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const addMed = useCallback((med: MedConfig) => {
    setSettings((prev) => {
      const next = { ...prev, meds_config: [...prev.meds_config, med] };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const updateMed = useCallback((id: string, patch: Partial<Omit<MedConfig, "id">>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        meds_config: prev.meds_config.map((m) =>
          m.id === id ? { ...m, ...patch } : m
        ),
      };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const removeMed = useCallback((id: string) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        meds_config: prev.meds_config.filter((m) => m.id !== id),
      };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const value = useMemo<PetStoreContextValue>(() => ({
    pet,
    settings,
    log,
    viewDate,
    setViewDate,
    loading,
    toggleKibble,
    toggleSupplement,
    toggleMed,
    updateSettings,
    addSupplement,
    updateSupplement,
    removeSupplement,
    addMed,
    updateMed,
    removeMed,
  }), [pet, settings, log, viewDate, setViewDate, loading, toggleKibble, toggleSupplement, toggleMed, updateSettings, addSupplement, updateSupplement, removeSupplement, addMed, updateMed, removeMed]);

  return (
    <PetStoreContext.Provider value={value}>
      {children}
    </PetStoreContext.Provider>
  );
}

export function usePetStore(): PetStoreContextValue {
  const ctx = useContext(PetStoreContext);
  if (!ctx) throw new Error("usePetStore must be used within PetStoreProvider");
  return ctx;
}
