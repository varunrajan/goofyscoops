"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Pet, PetSettings, DailyLog, SupplementConfig, MedConfig } from "@/types/supabase";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

const DEFAULT_SETTINGS: PetSettings = {
  pet_id: "",
  meal_type: "Kibble",
  scoop_size: "1/2",
  daily_scoops: 4,
  supplements_config: [],
  meds_config: [],
};

const DEFAULT_LOG: DailyLog = {
  id: "",
  pet_id: "",
  date: today(),
  kibble_checked: 0,
  supplements_status: {},
  meds_status: {},
};

interface PetStoreContextValue {
  pet: Pet | null;
  settings: PetSettings;
  log: DailyLog;
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
  const [log, setLog] = useState<DailyLog>(DEFAULT_LOG);
  const [loading, setLoading] = useState(true);

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
      setSettings({
        pet_id: settingsData.pet_id,
        meal_type: settingsData.meal_type,
        scoop_size: settingsData.scoop_size,
        daily_scoops: settingsData.daily_scoops,
        supplements_config: settingsData.supplements_config as SupplementConfig[],
        meds_config: settingsData.meds_config as MedConfig[],
      });
    }

    const todayStr = today();
    const { data: logData } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("pet_id", petData.id)
      .eq("date", todayStr)
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
      setLog({
        id: "",
        pet_id: petData.id,
        date: todayStr,
        kibble_checked: 0,
        supplements_status: {},
        meds_status: {},
      });
    }

    setLoading(false);
  }, []);

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
      let next = prev;
      if (index === prev.kibble_checked && prev.kibble_checked < settings.daily_scoops) {
        next = { ...prev, kibble_checked: prev.kibble_checked + 1 };
      } else if (index === prev.kibble_checked - 1 && prev.kibble_checked > 0) {
        next = { ...prev, kibble_checked: prev.kibble_checked - 1 };
      }
      if (next !== prev) persistLog(next);
      return next;
    });
  }, [settings.daily_scoops, persistLog]);

  const toggleSupplement = useCallback((id: string, index: number) => {
    setLog((prev) => {
      const current = prev.supplements_status[id] ?? 0;
      const config = settings.supplements_config.find((s) => s.id === id);
      const max = config?.frequency ?? 1;
      let next = prev;
      if (index === current && current < max) {
        next = { ...prev, supplements_status: { ...prev.supplements_status, [id]: current + 1 } };
      } else if (index === current - 1 && current > 0) {
        next = { ...prev, supplements_status: { ...prev.supplements_status, [id]: current - 1 } };
      }
      if (next !== prev) persistLog(next);
      return next;
    });
  }, [settings.supplements_config, persistLog]);

  const toggleMed = useCallback((id: string, index: number) => {
    setLog((prev) => {
      const current = prev.meds_status[id] ?? 0;
      const config = settings.meds_config.find((m) => m.id === id);
      const max = config?.frequency ?? 1;
      let next = prev;
      if (index === current && current < max) {
        next = { ...prev, meds_status: { ...prev.meds_status, [id]: current + 1 } };
      } else if (index === current - 1 && current > 0) {
        next = { ...prev, meds_status: { ...prev.meds_status, [id]: current - 1 } };
      }
      if (next !== prev) persistLog(next);
      return next;
    });
  }, [settings.meds_config, persistLog]);

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
  }), [pet, settings, log, loading, toggleKibble, toggleSupplement, toggleMed, updateSettings, addSupplement, updateSupplement, removeSupplement, addMed, updateMed, removeMed]);

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
