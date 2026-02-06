"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type DossierOption = {
  id: string;
  title: string;
  label?: string;
};

type StoredTimerState = {
  dossierId: string;
  dossierTitle: string;
  description: string;
  carryMs: number;
  paused: boolean;
  sessionId: string;
  segmentIds: string[];
  pendingSave?: boolean;
};

function storageKey(userId: string) {
  return `ld_timer_${userId}`;
}

function newSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function saveTimerState(userId: string, state: StoredTimerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function FloatingTimerButton({
  dossiers,
  disabled,
  userId
}: {
  dossiers: DossierOption[];
  disabled?: boolean;
  userId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dossierId, setDossierId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (disabled || pathname.startsWith("/time-tracking")) {
    return null;
  }

  async function startTimer() {
    if (!dossierId) {
      setError("Selecteer een dossier");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossierId,
          startAt: new Date().toISOString(),
          description: "Timer gestart via snelknop",
          autoCaptured: false
        })
      });

      const payload = (await response.json()) as { id?: string; dossierId?: string; description?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Kon timer niet starten");
      }

      const dossierTitle = dossiers.find((item) => item.id === dossierId)?.label ?? dossiers.find((item) => item.id === dossierId)?.title ?? "Dossier";
      if (payload.id) {
        saveTimerState(userId, {
          dossierId,
          dossierTitle,
          description: payload.description ?? "Timer gestart via snelknop",
          carryMs: 0,
          paused: false,
          pendingSave: false,
          sessionId: newSessionId(),
          segmentIds: [payload.id]
        });
      }

      setOpen(false);
      setDossierId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon timer niet starten");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#2847b8] text-xl text-white shadow-lg transition hover:bg-[#203ca3]"
        aria-label="Timer starten"
      >
        ⏱
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-800">⏱ Timer starten</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xl text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">Dossier *</label>
            <select value={dossierId} onChange={(event) => setDossierId(event.target.value)} className="ld-input">
              <option value="">Selecteer een dossier...</option>
              {dossiers.map((dossier) => (
                <option key={dossier.id} value={dossier.id}>
                  {dossier.label ?? dossier.title}
                </option>
              ))}
            </select>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="ld-btn-secondary">
                Annuleren
              </button>
              <button type="button" onClick={startTimer} disabled={loading} className="ld-btn-primary">
                {loading ? "Starten..." : "Starten"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
