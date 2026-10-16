"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Pet, PetSettings, DailyLog, SupplementConfig, MedConfig, PetEvent, PetEventPatch, PetEventPayloads, PetEventSaveState } from "@/types/supabase";
import {
  isValidPetEventData,
  mergePetEvents,
  parsePetEvent,
  sortPetEvents,
  visiblePetEvents,
} from "@/types/supabase";
import { localDate } from "@/lib/local-date";
import { normalizeScoopSize } from "@/lib/scoop";
import { isPetSizeClass, type PetSizeClass } from "@/lib/potty";

function today(): string {
  return localDate();
}

const PET_EVENT_COLUMNS =
  "id, pet_id, event_type, occurred_at, local_date, data, logged_by, created_at, updated_at";

type PetEventInsert = {
  id: string;
  pet_id: string;
  event_type: string;
  occurred_at: string;
  local_date: string;
  data: unknown;
};

type PetEventUpdate = {
  occurred_at?: string;
  local_date?: string;
  data?: unknown;
};

function duplicateKey(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return (error as { code?: unknown }).code === "23505";
}

async function insertPetEvent(row: PetEventInsert): Promise<{ ok: boolean; duplicate: boolean }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("pet_events").insert({
      id: row.id,
      pet_id: row.pet_id,
      event_type: row.event_type,
      occurred_at: row.occurred_at,
      local_date: row.local_date,
      data: row.data,
    });
    if (!error) return { ok: true, duplicate: false };
    return { ok: false, duplicate: duplicateKey(error) };
  } catch (error) {
    return { ok: false, duplicate: duplicateKey(error) };
  }
}

async function updatePetEvent(id: string, patch: PetEventUpdate): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from("pet_events").update(patch).eq("id", id);
  } catch {
    // Fire-and-forget. Updates have no failed saveState.
  }
}

async function deletePetEvent(id: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from("pet_events").delete().eq("id", id);
  } catch {
    // Fire-and-forget. The row stays gone. Deletes have no failed saveState.
  }
}

function withSaveState(rows: PetEvent[], id: string, saveState: PetEventSaveState): PetEvent[] {
  const current = rows.find((event) => event.id === id);
  if (!current || current.saveState === saveState) return rows;
  // A read can mark the row saved before a lost insert response settles.
  // Do not downgrade that row to failed.
  if (saveState === "failed" && current.saveState === "saved") return rows;
  return rows.map((event) => (event.id === id ? { ...event, saveState } : event));
}

const DEFAULT_SETTINGS: PetSettings = {
  pet_id: "",
  meal_type: "Kibble",
  scoop_size: "1/2",
  daily_scoops: 4,
  supplements_config: [],
  meds_config: [],
  potty_tracking_enabled: false,
};

interface PetStoreContextValue {
  pet: Pet | null;
  settings: PetSettings;
  log: DailyLog | null;
  events: PetEvent[];
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
  updatePetSize: (sizeClass: PetSizeClass) => void;
  /** Returns the client-generated id of the new row, or null if the write was dropped. */
  addEvent: <K extends keyof PetEventPayloads>(type: K, data: PetEventPayloads[K]) => string | null;
  updateEvent: (id: string, patch: PetEventPatch) => void;
  removeEvent: (id: string) => void;
  retryEvent: (id: string) => void;
}

const PetStoreContext = createContext<PetStoreContextValue | null>(null);

export function PetStoreProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pet, setPet] = useState<Pet | null>(null);
  const [settings, setSettings] = useState<PetSettings>(DEFAULT_SETTINGS);
  const [viewDate, setViewDate] = useState<string>(today());
  const [log, setLog] = useState<DailyLog | null>(null);
  const [storedEvents, setEvents] = useState<PetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchGeneration = useRef(0);
  // False until a settings read returns the potty_tracking_enabled column.
  // Before the migration is applied the column is absent, and writing it
  // would make every settings save fail, so persistSettings leaves it out.
  const settingsHasPottyColumn = useRef(false);

  const buildEmptyLog = useCallback((petId: string): DailyLog => ({
    id: "",
    pet_id: petId,
    date: viewDate,
    kibble_checked: 0,
    supplements_status: {},
    meds_status: {},
  }), [viewDate]);

  // The pet_events read for one (pet, date). Shared by fetchData and the
  // potty toggle. `generation` must come from a fresh ++fetchGeneration.current
  // so a stale response never overwrites a newer one.
  const fetchEvents = useCallback(async (petId: string, date: string, generation: number) => {
    const supabase = createClient();
    try {
      const { data: eventData, error: eventsError } = await supabase
        .from("pet_events")
        .select(PET_EVENT_COLUMNS)
        .eq("pet_id", petId)
        .eq("local_date", date)
        .order("occurred_at", { ascending: false });

      // A newer read supersedes this one. Merging a stale day
      // would drop saved rows that belong to the day now on screen.
      if (generation === fetchGeneration.current) {
        if (eventsError) {
          console.warn("pet_events read failed", eventsError);
        } else {
          const parsed: PetEvent[] = [];
          for (const raw of eventData ?? []) {
            const event = parsePetEvent(raw);
            if (!event) {
              console.warn("Dropping unregistered or invalid pet event", raw);
              continue;
            }
            parsed.push(event);
          }
          setEvents((prev) => mergePetEvents(prev, parsed));
        }
      }
    } catch (error) {
      if (generation === fetchGeneration.current) {
        console.warn("pet_events read failed", error);
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    const generation = ++fetchGeneration.current;
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

    setPet({
      id: petData.id,
      name: petData.name,
      household_id: petData.household_id,
      // Absent column (migration not applied) or a bad value both become null.
      size_class: isPetSizeClass(petData.size_class) ? petData.size_class : null,
    });

    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .eq("pet_id", petData.id)
      .single();

    // Read from the row just loaded, not from state, so the gate below
    // cannot see a stale flag.
    let pottyEnabled = false;

    if (settingsData) {
      const scoopSize = normalizeScoopSize(settingsData.scoop_size);
      settingsHasPottyColumn.current = typeof settingsData.potty_tracking_enabled === "boolean";
      pottyEnabled = settingsData.potty_tracking_enabled === true;
      setSettings({
        pet_id: settingsData.pet_id,
        meal_type: settingsData.meal_type,
        scoop_size: scoopSize,
        daily_scoops: settingsData.daily_scoops,
        supplements_config: settingsData.supplements_config as SupplementConfig[],
        meds_config: settingsData.meds_config as MedConfig[],
        potty_tracking_enabled: pottyEnabled,
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

    // F6: households that never enable potty tracking pay no query cost.
    // When off, `events` is left as is.
    if (pottyEnabled) {
      await fetchEvents(petData.id, viewDate, generation);
    }

    setLoading(false);
  }, [viewDate, fetchEvents]);

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
        ...(settingsHasPottyColumn.current
          ? { potty_tracking_enabled: next.potty_tracking_enabled }
          : {}),
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
    // Decided outside the updater so StrictMode's double invoke cannot
    // issue two reads.
    const turningPottyOn =
      patch.potty_tracking_enabled === true && !settings.potty_tracking_enabled;

    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });

    // fetchData skipped the events read while the flag was off. Read now
    // rather than waiting for the next visibilitychange. A fresh generation
    // makes any in-flight read stale, and any later read makes this one stale.
    if (turningPottyOn && pet) {
      void fetchEvents(pet.id, viewDate, ++fetchGeneration.current);
    }
  }, [persistSettings, settings.potty_tracking_enabled, pet, viewDate, fetchEvents]);

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

  // --- Pet ---

  const updatePetSize = useCallback((sizeClass: PetSizeClass) => {
    if (!pet) {
      console.warn("Dropping pet size update: no current pet");
      return;
    }
    const petId = pet.id;
    const previous = pet.size_class;

    setPet((prev) => (prev && prev.id === petId ? { ...prev, size_class: sizeClass } : prev));

    void (async () => {
      let failure: unknown = null;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("pets")
          .update({ size_class: sizeClass })
          .eq("id", petId)
          .select("id");
        if (error) {
          failure = error;
        } else if (!data || data.length === 0) {
          // RLS let the statement through but matched nothing.
          failure = new Error("pets update matched zero rows");
        }
      } catch (error) {
        failure = error;
      }

      if (failure === null) return;
      console.warn("pets.size_class update failed; restoring previous value", failure);
      // Only roll back if this optimistic value is still the one on screen.
      setPet((prev) =>
        prev && prev.id === petId && prev.size_class === sizeClass
          ? { ...prev, size_class: previous }
          : prev,
      );
    })();
  }, [pet]);

  // --- Pet events ---
  // addEvent appends with setEvents, inserts outside that updater, then
  // setEvents again when the insert settles. updateEvent and removeEvent
  // are fire-and-forget and do not change saveState.

  const events = useMemo(
    () => visiblePetEvents(storedEvents, pet?.id ?? null, viewDate),
    [storedEvents, pet?.id, viewDate],
  );

  const addEvent = useCallback(function addEvent<K extends keyof PetEventPayloads>(
    type: K,
    data: PetEventPayloads[K],
  ): string | null {
    if (!isValidPetEventData(String(type), data)) {
      console.warn("Dropping pet event write: unregistered type or invalid data", type);
      return null;
    }
    if (!pet) {
      console.warn("Dropping pet event write: no current pet");
      return null;
    }

    const instant = new Date();
    const occurredAt = instant.toISOString();
    const rowLocalDate = localDate(instant);
    const id = crypto.randomUUID();
    const row = {
      id,
      pet_id: pet.id,
      event_type: type,
      occurred_at: occurredAt,
      local_date: rowLocalDate,
      data,
      logged_by: null,
      created_at: occurredAt,
      updated_at: null,
      saveState: "pending" as const,
    } as PetEvent;

    setEvents((prev) => sortPetEvents([...prev, row]));

    const payload: PetEventInsert = {
      id,
      pet_id: pet.id,
      event_type: String(type),
      occurred_at: occurredAt,
      local_date: rowLocalDate,
      data,
    };

    void insertPetEvent(payload).then((result) => {
      setEvents((prev) => withSaveState(prev, id, result.ok ? "saved" : "failed"));
    });

    return id;
  }, [pet]);

  const updateEvent = useCallback((id: string, patch: PetEventPatch) => {
    const current = storedEvents.find((event) => event.id === id);
    if (!current) return;

    const occurredAt = patch.occurred_at;
    const nextData = patch.data;
    let nextLocalDate = current.local_date;

    if (occurredAt !== undefined) {
      const instant = new Date(occurredAt);
      if (Number.isNaN(instant.getTime())) {
        console.warn("Dropping pet event update: invalid occurred_at", id);
        return;
      }
      nextLocalDate = localDate(instant);
    }

    if (nextData !== undefined && !isValidPetEventData(String(current.event_type), nextData)) {
      console.warn("Dropping pet event update: invalid data", id);
      return;
    }

    if (occurredAt === undefined && nextData === undefined) return;

    setEvents((prev) =>
      sortPetEvents(
        prev.map((event) => {
          if (event.id !== id) return event;
          // nextData was validated against event.event_type above; the
          // spread loses that correlation for TypeScript, hence the asserts.
          if (occurredAt !== undefined && nextData !== undefined) {
            return { ...event, occurred_at: occurredAt, local_date: nextLocalDate, data: nextData } as PetEvent;
          }
          if (occurredAt !== undefined) {
            return { ...event, occurred_at: occurredAt, local_date: nextLocalDate };
          }
          return { ...event, data: nextData } as PetEvent;
        }),
      ),
    );

    let write: PetEventUpdate;
    if (occurredAt !== undefined && nextData !== undefined) {
      write = { occurred_at: occurredAt, local_date: nextLocalDate, data: nextData };
    } else if (occurredAt !== undefined) {
      write = { occurred_at: occurredAt, local_date: nextLocalDate };
    } else {
      write = { data: nextData };
    }

    void updatePetEvent(id, write);
  }, [storedEvents]);

  const removeEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== id));
    void deletePetEvent(id);
  }, []);

  const retryEvent = useCallback((id: string) => {
    const existing = storedEvents.find((event) => event.id === id && event.saveState === "failed");
    if (!existing) return;

    setEvents((prev) =>
      prev.map((event) => (event.id === id ? { ...event, saveState: "pending" } : event)),
    );

    const payload: PetEventInsert = {
      id: existing.id,
      pet_id: existing.pet_id,
      event_type: String(existing.event_type),
      occurred_at: existing.occurred_at,
      local_date: existing.local_date,
      data: existing.data,
    };

    void insertPetEvent(payload).then((result) => {
      const saveState: PetEventSaveState = result.ok || result.duplicate ? "saved" : "failed";
      setEvents((prev) => withSaveState(prev, id, saveState));
    });
  }, [storedEvents]);

  const value = useMemo<PetStoreContextValue>(() => ({
    pet,
    settings,
    log,
    events,
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
    updatePetSize,
    addEvent,
    updateEvent,
    removeEvent,
    retryEvent,
  }), [pet, settings, log, events, viewDate, setViewDate, loading, toggleKibble, toggleSupplement, toggleMed, updateSettings, addSupplement, updateSupplement, removeSupplement, addMed, updateMed, removeMed, updatePetSize, addEvent, updateEvent, removeEvent, retryEvent]);

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
