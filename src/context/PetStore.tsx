"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { Pet, PetSettings, DailyLog, SupplementConfig, MedConfig, ScoopSize } from "@/types/supabase";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

const MOCK_PET: Pet = {
  id: "pet-001",
  name: "Goofy",
  household_id: "house-001",
};

const MOCK_SETTINGS: PetSettings = {
  pet_id: "pet-001",
  meal_type: "Kibble",
  scoop_size: "1/4",
  daily_scoops: 6,
  supplements_config: [
    { id: "sup-1", name: "Fish Oil", frequency: 1 },
    { id: "sup-2", name: "Probiotic", frequency: 2 },
  ],
  meds_config: [
    { id: "med-1", name: "Allergy Pill", frequency: 2 },
  ],
};

const MOCK_LOG: DailyLog = {
  id: "log-001",
  pet_id: "pet-001",
  date: today(),
  kibble_checked: 0,
  supplements_status: {},
  meds_status: {},
};

interface PetStoreContextValue {
  pet: Pet;
  settings: PetSettings;
  log: DailyLog;
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
  const [settings, setSettings] = useState<PetSettings>(MOCK_SETTINGS);
  const [log, setLog] = useState<DailyLog>(MOCK_LOG);

  const toggleKibble = useCallback((index: number) => {
    setLog((prev) => {
      if (index === prev.kibble_checked && prev.kibble_checked < settings.daily_scoops) {
        return { ...prev, kibble_checked: prev.kibble_checked + 1 };
      }
      if (index === prev.kibble_checked - 1 && prev.kibble_checked > 0) {
        return { ...prev, kibble_checked: prev.kibble_checked - 1 };
      }
      return prev;
    });
  }, [settings.daily_scoops]);

  const toggleSupplement = useCallback((id: string, index: number) => {
    setLog((prev) => {
      const current = prev.supplements_status[id] ?? 0;
      const config = settings.supplements_config.find((s) => s.id === id);
      const max = config?.frequency ?? 1;
      if (index === current && current < max) {
        return { ...prev, supplements_status: { ...prev.supplements_status, [id]: current + 1 } };
      }
      if (index === current - 1 && current > 0) {
        return { ...prev, supplements_status: { ...prev.supplements_status, [id]: current - 1 } };
      }
      return prev;
    });
  }, [settings.supplements_config]);

  const toggleMed = useCallback((id: string, index: number) => {
    setLog((prev) => {
      const current = prev.meds_status[id] ?? 0;
      const config = settings.meds_config.find((m) => m.id === id);
      const max = config?.frequency ?? 1;
      if (index === current && current < max) {
        return { ...prev, meds_status: { ...prev.meds_status, [id]: current + 1 } };
      }
      if (index === current - 1 && current > 0) {
        return { ...prev, meds_status: { ...prev.meds_status, [id]: current - 1 } };
      }
      return prev;
    });
  }, [settings.meds_config]);

  const updateSettings = useCallback((patch: Partial<PetSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const addSupplement = useCallback((supplement: SupplementConfig) => {
    setSettings((prev) => ({
      ...prev,
      supplements_config: [...prev.supplements_config, supplement],
    }));
  }, []);

  const updateSupplement = useCallback((id: string, patch: Partial<Omit<SupplementConfig, "id">>) => {
    setSettings((prev) => ({
      ...prev,
      supplements_config: prev.supplements_config.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      ),
    }));
  }, []);

  const removeSupplement = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      supplements_config: prev.supplements_config.filter((s) => s.id !== id),
    }));
  }, []);

  const addMed = useCallback((med: MedConfig) => {
    setSettings((prev) => ({
      ...prev,
      meds_config: [...prev.meds_config, med],
    }));
  }, []);

  const updateMed = useCallback((id: string, patch: Partial<Omit<MedConfig, "id">>) => {
    setSettings((prev) => ({
      ...prev,
      meds_config: prev.meds_config.map((m) =>
        m.id === id ? { ...m, ...patch } : m
      ),
    }));
  }, []);

  const removeMed = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      meds_config: prev.meds_config.filter((m) => m.id !== id),
    }));
  }, []);

  const value = useMemo<PetStoreContextValue>(() => ({
    pet: MOCK_PET,
    settings,
    log,
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
  }), [settings, log, toggleKibble, toggleSupplement, toggleMed, updateSettings, addSupplement, updateSupplement, removeSupplement, addMed, updateMed, removeMed]);

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
