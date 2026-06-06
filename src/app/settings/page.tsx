"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, SquarePen, Check, X, Link as LinkIcon, Copy, CheckCheck } from "lucide-react";
import { usePetStore } from "@/context/PetStore";
import { createClient } from "@/lib/supabase/client";
import type { ScoopSize, SupplementConfig, MedConfig } from "@/types/supabase";

const SCOOP_SIZES: ScoopSize[] = ["0", "1/4", "1/3", "1/2", "2/3", "3/4", "1"];

function scoopSizeToNumber(size: ScoopSize): number {
  const map: Record<ScoopSize, number> = {
    "0": 0,
    "1/4": 0.25,
    "1/3": 1 / 3,
    "1/2": 0.5,
    "2/3": 2 / 3,
    "3/4": 0.75,
    "1": 1,
  };
  return map[size];
}

function formatCups(cups: number): string {
  if (cups === 0) return "0 cups";
  const rounded = Math.round(cups * 100) / 100;
  return `${rounded} cup${rounded !== 1 ? "s" : ""}`;
}

export default function SettingsPage() {
  const {
    settings,
    loading,
    updateSettings,
    addSupplement,
    updateSupplement,
    removeSupplement,
    addMed,
    updateMed,
    removeMed,
  } = usePetStore();

  const [newSupName, setNewSupName] = useState("");
  const [newSupFreq, setNewSupFreq] = useState(1);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [editSupName, setEditSupName] = useState("");
  const [editSupFreq, setEditSupFreq] = useState(1);

  const [newMedName, setNewMedName] = useState("");
  const [newMedFreq, setNewMedFreq] = useState(1);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [editMedName, setEditMedName] = useState("");
  const [editMedFreq, setEditMedFreq] = useState(1);

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const totalCups = scoopSizeToNumber(settings.scoop_size) * settings.daily_scoops;

  async function handleGenerateInvite() {
    setInviteLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("generate_invite_token");

    if (error) {
      setInviteLoading(false);
      return;
    }

    const origin = window.location.origin;
    setInviteLink(`${origin}/join?token=${data}`);
    setInviteLoading(false);
  }

  async function handleCopyInvite() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }

  function handleAddSupplement() {
    if (!newSupName.trim()) return;
    const supplement: SupplementConfig = {
      id: `sup-${Date.now()}`,
      name: newSupName.trim(),
      frequency: newSupFreq,
    };
    addSupplement(supplement);
    setNewSupName("");
    setNewSupFreq(1);
  }

  function handleAddMed() {
    if (!newMedName.trim()) return;
    const med: MedConfig = {
      id: `med-${Date.now()}`,
      name: newMedName.trim(),
      frequency: newMedFreq,
    };
    addMed(med);
    setNewMedName("");
    setNewMedFreq(1);
  }

  function startEditSupplement(sup: SupplementConfig) {
    setEditingSupId(sup.id);
    setEditSupName(sup.name);
    setEditSupFreq(sup.frequency);
  }

  function saveEditSupplement() {
    if (!editingSupId || !editSupName.trim()) return;
    updateSupplement(editingSupId, { name: editSupName.trim(), frequency: editSupFreq });
    setEditingSupId(null);
  }

  function startEditMed(med: MedConfig) {
    setEditingMedId(med.id);
    setEditMedName(med.name);
    setEditMedFreq(med.frequency);
  }

  function saveEditMed() {
    if (!editingMedId || !editMedName.trim()) return;
    updateMed(editingMedId, { name: editMedName.trim(), frequency: editMedFreq });
    setEditingMedId(null);
  }

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <p className="text-foreground/50 font-medium">Loading…</p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="w-11 h-11 rounded-full bg-goofy-teal/10 flex items-center justify-center hover:bg-goofy-teal/20 transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-goofy-teal" />
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
      </div>

      {/* Meal Setup */}
      <section className="bg-white rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-5">Meal Setup</h2>

        <div className="flex flex-col gap-5">
          {/* Scoop Size */}
          <div>
            <label className="block text-sm font-medium mb-2">Scoop Size</label>
            <div className="flex flex-wrap gap-2">
              {SCOOP_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => updateSettings({ scoop_size: size })}
                  className={`
                    px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors cursor-pointer
                    ${settings.scoop_size === size
                      ? "bg-goofy-teal text-white border-goofy-teal"
                      : "bg-transparent text-goofy-teal border-goofy-teal/30 hover:border-goofy-teal"
                    }
                  `}
                >
                  {size === "0" ? "None" : `${size} cup`}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Scoops */}
          <div>
            <label htmlFor="daily-scoops" className="block text-sm font-medium mb-2">
              Daily Scoops
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateSettings({ daily_scoops: Math.max(1, settings.daily_scoops - 1) })}
                className="w-11 h-11 rounded-full bg-goofy-teal/10 text-goofy-teal font-bold text-xl flex items-center justify-center hover:bg-goofy-teal/20 transition-colors cursor-pointer"
              >
                −
              </button>
              <input
                id="daily-scoops"
                type="number"
                min={1}
                max={20}
                value={settings.daily_scoops}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 20) {
                    updateSettings({ daily_scoops: val });
                  }
                }}
                className="w-16 text-center text-xl font-bold border-2 border-goofy-teal/20 rounded-xl py-2 bg-transparent focus:border-goofy-teal outline-none"
              />
              <button
                type="button"
                onClick={() => updateSettings({ daily_scoops: Math.min(20, settings.daily_scoops + 1) })}
                className="w-11 h-11 rounded-full bg-goofy-teal/10 text-goofy-teal font-bold text-xl flex items-center justify-center hover:bg-goofy-teal/20 transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Calculated Total */}
          <div className="bg-goofy-yellow/20 rounded-2xl p-4 text-center">
            <p className="text-sm opacity-60 mb-1">Daily Total</p>
            <p className="text-2xl font-extrabold">
              {settings.daily_scoops} scoops × {settings.scoop_size} cup = {formatCups(totalCups)}
            </p>
          </div>
        </div>
      </section>

      {/* Supplements */}
      <section className="bg-white rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">Supplements</h2>

        {settings.supplements_config.length > 0 && (
          <ul className="flex flex-col gap-2 mb-4">
            {settings.supplements_config.map((sup) => (
              <li key={sup.id} className="bg-goofy-cream rounded-xl px-4 py-3">
                {editingSupId === sup.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editSupName}
                      onChange={(e) => setEditSupName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEditSupplement()}
                      className="flex-1 border-2 border-goofy-teal/20 rounded-xl px-3 py-2 text-sm bg-white focus:border-goofy-teal outline-none"
                      autoFocus
                    />
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={editSupFreq}
                      onChange={(e) => setEditSupFreq(parseInt(e.target.value, 10) || 1)}
                      onKeyDown={(e) => e.key === "Enter" && saveEditSupplement()}
                      className="w-14 text-center border-2 border-goofy-teal/20 rounded-xl px-2 py-2 text-sm bg-white focus:border-goofy-teal outline-none"
                      aria-label="Frequency per day"
                    />
                    <button
                      type="button"
                      onClick={saveEditSupplement}
                      className="text-goofy-teal hover:text-goofy-teal/70 transition-colors cursor-pointer"
                      aria-label="Save changes"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSupId(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                      aria-label="Cancel editing"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{sup.name}</span>
                      <span className="text-sm opacity-50 ml-2">{sup.frequency}×/day</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditSupplement(sup)}
                        className="text-goofy-teal/60 hover:text-goofy-teal transition-colors cursor-pointer"
                        aria-label={`Edit ${sup.name}`}
                      >
                        <SquarePen className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSupplement(sup.id)}
                        className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                        aria-label={`Remove ${sup.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Supplement name"
            value={newSupName}
            onChange={(e) => setNewSupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSupplement()}
            className="flex-1 border-2 border-goofy-teal/20 rounded-xl px-3 py-2 text-sm bg-transparent focus:border-goofy-teal outline-none"
          />
          <input
            type="number"
            min={1}
            max={10}
            value={newSupFreq}
            onChange={(e) => setNewSupFreq(parseInt(e.target.value, 10) || 1)}
            className="w-14 text-center border-2 border-goofy-teal/20 rounded-xl px-2 py-2 text-sm bg-transparent focus:border-goofy-teal outline-none"
            aria-label="Frequency per day"
          />
          <button
            type="button"
            onClick={handleAddSupplement}
            className="w-11 h-11 rounded-full bg-goofy-teal text-white flex items-center justify-center hover:bg-goofy-teal/80 transition-colors cursor-pointer"
            aria-label="Add supplement"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Medications */}
      <section className="bg-white rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">Medications</h2>

        {settings.meds_config.length > 0 && (
          <ul className="flex flex-col gap-2 mb-4">
            {settings.meds_config.map((med) => (
              <li key={med.id} className="bg-goofy-cream rounded-xl px-4 py-3">
                {editingMedId === med.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editMedName}
                      onChange={(e) => setEditMedName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEditMed()}
                      className="flex-1 border-2 border-goofy-teal/20 rounded-xl px-3 py-2 text-sm bg-white focus:border-goofy-teal outline-none"
                      autoFocus
                    />
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={editMedFreq}
                      onChange={(e) => setEditMedFreq(parseInt(e.target.value, 10) || 1)}
                      onKeyDown={(e) => e.key === "Enter" && saveEditMed()}
                      className="w-14 text-center border-2 border-goofy-teal/20 rounded-xl px-2 py-2 text-sm bg-white focus:border-goofy-teal outline-none"
                      aria-label="Frequency per day"
                    />
                    <button
                      type="button"
                      onClick={saveEditMed}
                      className="text-goofy-teal hover:text-goofy-teal/70 transition-colors cursor-pointer"
                      aria-label="Save changes"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMedId(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                      aria-label="Cancel editing"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{med.name}</span>
                      <span className="text-sm opacity-50 ml-2">{med.frequency}×/day</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditMed(med)}
                        className="text-goofy-teal/60 hover:text-goofy-teal transition-colors cursor-pointer"
                        aria-label={`Edit ${med.name}`}
                      >
                        <SquarePen className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMed(med.id)}
                        className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                        aria-label={`Remove ${med.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Medication name"
            value={newMedName}
            onChange={(e) => setNewMedName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddMed()}
            className="flex-1 border-2 border-goofy-teal/20 rounded-xl px-3 py-2 text-sm bg-transparent focus:border-goofy-teal outline-none"
          />
          <input
            type="number"
            min={1}
            max={10}
            value={newMedFreq}
            onChange={(e) => setNewMedFreq(parseInt(e.target.value, 10) || 1)}
            className="w-14 text-center border-2 border-goofy-teal/20 rounded-xl px-2 py-2 text-sm bg-transparent focus:border-goofy-teal outline-none"
            aria-label="Frequency per day"
          />
          <button
            type="button"
            onClick={handleAddMed}
            className="w-11 h-11 rounded-full bg-goofy-teal text-white flex items-center justify-center hover:bg-goofy-teal/80 transition-colors cursor-pointer"
            aria-label="Add medication"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Invite Partner */}
      <section className="bg-white rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-2">Invite Partner</h2>
        <p className="text-sm text-foreground/60 mb-4">
          Share this link so someone else can help track meals.
        </p>

        {inviteLink ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 bg-goofy-cream rounded-xl px-3 py-2.5">
              <LinkIcon className="w-4 h-4 text-goofy-teal shrink-0" />
              <span className="text-xs font-mono text-foreground/70 truncate flex-1">
                {inviteLink}
              </span>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="text-goofy-teal hover:text-goofy-teal/70 transition-colors cursor-pointer shrink-0"
                aria-label="Copy invite link"
              >
                {inviteCopied ? (
                  <CheckCheck className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-foreground/40 text-center">
              This link expires in 7 days and can only be used once.
            </p>
          </div>
        ) : (
          <button
            type="button"
            disabled={inviteLoading}
            onClick={handleGenerateInvite}
            className="w-full bg-goofy-yellow text-foreground font-bold text-base py-3 rounded-full shadow-sm hover:bg-goofy-yellow/80 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {inviteLoading ? "Generating…" : "Generate Invite Link"}
          </button>
        )}
      </section>
    </main>
  );
}
