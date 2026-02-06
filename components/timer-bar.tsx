"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RunningEntry = {
  id: string;
  dossierId: string;
  dossierTitle: string;
  startAt: string;
  description: string;
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

function loadTimerState(userId: string): StoredTimerState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTimerState>;
    if (!parsed?.dossierId) return null;
    return {
      dossierId: parsed.dossierId,
      dossierTitle: parsed.dossierTitle ?? "Dossier",
      description: parsed.description ?? "",
      carryMs: parsed.carryMs ?? 0,
      paused: parsed.paused ?? false,
      sessionId: parsed.sessionId ?? parsed.dossierId,
      segmentIds: parsed.segmentIds ?? [],
      pendingSave: parsed.pendingSave ?? false
    };
  } catch {
    return null;
  }
}

function saveTimerState(userId: string, state: StoredTimerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

function clearTimerState(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(userId));
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TimerBar({ initialEntry, userId }: { initialEntry: RunningEntry | null; userId: string }) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());
  const [timerState, setTimerState] = useState<StoredTimerState | null>(null);
  const [optimisticEntry, setOptimisticEntry] = useState<RunningEntry | null>(null);
  const [loading, setLoading] = useState<"pause" | "resume" | "stop" | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "delete" | null>(null);
  const [formDescription, setFormDescription] = useState("");
  const [hourlyRate, setHourlyRate] = useState(125);
  const [billable, setBillable] = useState(true);
  const [autoOpened, setAutoOpened] = useState(false);

  const runningEntry = initialEntry ?? optimisticEntry;
  const pausedState = !runningEntry && timerState?.paused ? timerState : null;
  const pendingSave = timerState?.pendingSave ?? false;

  useEffect(() => {
    setTimerState(loadTimerState(userId));
  }, [userId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!runningEntry) return;

    const shouldReset = !timerState || timerState.dossierId !== runningEntry.dossierId || timerState.pendingSave;
    const sessionId = shouldReset ? newSessionId() : timerState.sessionId;
    const segmentIds = shouldReset
      ? [runningEntry.id]
      : timerState.segmentIds.includes(runningEntry.id)
        ? timerState.segmentIds
        : [...timerState.segmentIds, runningEntry.id];
    const nextState: StoredTimerState = {
      dossierId: runningEntry.dossierId,
      dossierTitle: runningEntry.dossierTitle,
      description: runningEntry.description,
      carryMs: shouldReset ? 0 : timerState.carryMs,
      paused: false,
      pendingSave: false,
      sessionId,
      segmentIds
    };

    if (
      timerState &&
      timerState.dossierId === nextState.dossierId &&
      timerState.paused === nextState.paused &&
      timerState.pendingSave === nextState.pendingSave &&
      timerState.carryMs === nextState.carryMs &&
      timerState.sessionId === nextState.sessionId &&
      timerState.segmentIds.join(",") === nextState.segmentIds.join(",") &&
      timerState.description === nextState.description
    ) {
      return;
    }

    saveTimerState(userId, nextState);
    setTimerState(nextState);
  }, [runningEntry, timerState, userId]);

  useEffect(() => {
    if (initialEntry) {
      setOptimisticEntry(null);
    }
  }, [initialEntry]);

  useEffect(() => {
    if (timerState?.pendingSave && !autoOpened) {
      setFormDescription(timerState.description || "");
      setShowSaveModal(true);
      setAutoOpened(true);
    }
  }, [timerState?.pendingSave, timerState?.description, autoOpened]);

  const elapsedMs = useMemo(() => {
    if (runningEntry) {
      const base = timerState?.dossierId === runningEntry.dossierId ? timerState.carryMs : 0;
      return base + (now - new Date(runningEntry.startAt).getTime());
    }
    if (pausedState) return pausedState.carryMs;
    if (pendingSave && timerState) return timerState.carryMs;
    return 0;
  }, [runningEntry, pausedState, pendingSave, timerState, now]);

  async function pauseTimer() {
    if (!runningEntry) return;
    setLoading("pause");
    const totalMs = elapsedMs;

    try {
      const res = await fetch(`/api/time-entries/${runningEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endAt: new Date().toISOString() })
      });

      if (!res.ok) {
        throw new Error("Kon timer niet pauzeren");
      }

      const base = timerState ?? {
        dossierId: runningEntry.dossierId,
        dossierTitle: runningEntry.dossierTitle,
        description: runningEntry.description,
        carryMs: 0,
        paused: false,
        sessionId: newSessionId(),
        segmentIds: [runningEntry.id]
      };

      const nextState: StoredTimerState = {
        dossierId: runningEntry.dossierId,
        dossierTitle: runningEntry.dossierTitle,
        description: runningEntry.description,
        carryMs: totalMs,
        paused: true,
        pendingSave: false,
        sessionId: base.sessionId,
        segmentIds: base.segmentIds.includes(runningEntry.id)
          ? base.segmentIds
          : [...base.segmentIds, runningEntry.id]
      };
      saveTimerState(userId, nextState);
      setTimerState(nextState);
      setOptimisticEntry(null);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function stopTimer() {
    if (pendingSave) {
      setShowSaveModal(true);
      return;
    }
    setLoading("stop");
    setModalError(null);
    const totalMs = elapsedMs;

    try {
      if (runningEntry) {
        await fetch(`/api/time-entries/${runningEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endAt: new Date().toISOString() })
        });
      }

      const base = timerState ?? {
        dossierId: runningEntry?.dossierId ?? pausedState?.dossierId ?? "",
        dossierTitle: runningEntry?.dossierTitle ?? pausedState?.dossierTitle ?? "Dossier",
        description: runningEntry?.description ?? pausedState?.description ?? "",
        carryMs: 0,
        paused: true,
        sessionId: newSessionId(),
        segmentIds: runningEntry ? [runningEntry.id] : pausedState?.segmentIds ?? []
      };

      const nextState: StoredTimerState = {
        dossierId: base.dossierId,
        dossierTitle: base.dossierTitle,
        description: base.description,
        carryMs: totalMs,
        paused: true,
        pendingSave: true,
        sessionId: base.sessionId,
        segmentIds: base.segmentIds
      };

      saveTimerState(userId, nextState);
      setTimerState(nextState);
      setFormDescription(base.description || "");
      setShowSaveModal(true);
      setOptimisticEntry(null);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function resumeTimer() {
    if (!pausedState) return;
    setLoading("resume");
    setModalError(null);

    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossierId: pausedState.dossierId,
          startAt: new Date().toISOString(),
          description: pausedState.description || "Timer hervat",
          autoCaptured: false
        })
      });

      if (!res.ok) {
        throw new Error("Kon timer niet hervatten");
      }

      const created = (await res.json()) as { id: string; dossierId: string; startAt: string; description: string };
      const nextState: StoredTimerState = {
        ...pausedState,
        paused: false,
        pendingSave: false,
        segmentIds: pausedState.segmentIds?.length
          ? [...pausedState.segmentIds, created.id]
          : [created.id]
      };
      saveTimerState(userId, nextState);
      setTimerState(nextState);
      setOptimisticEntry({
        id: created.id,
        dossierId: created.dossierId,
        dossierTitle: pausedState.dossierTitle,
        startAt: created.startAt,
        description: created.description
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function saveTimeEntry() {
    if (!timerState) return;
    setSaving("save");
    setModalError(null);

    const description = formDescription.trim();
    if (!description) {
      setModalError("Beschrijving is verplicht");
      setSaving(null);
      return;
    }

    const segmentIds = timerState.segmentIds.length
      ? timerState.segmentIds
      : runningEntry
        ? [runningEntry.id]
        : [];

    if (segmentIds.length === 0) {
      setModalError("Geen timersegmenten gevonden");
      setSaving(null);
      return;
    }

    const finalDescription = `${description}${billable ? "" : " (niet factureerbaar)"} · €${hourlyRate}/u`;

    try {
      await Promise.all(
        segmentIds.map((id) =>
          fetch(`/api/time-entries/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: finalDescription })
          })
        )
      );

      clearTimerState(userId);
      setTimerState(null);
      setOptimisticEntry(null);
      setShowSaveModal(false);
      router.refresh();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Opslaan mislukt");
    } finally {
      setSaving(null);
    }
  }

  async function deleteSegments() {
    if (!timerState) return;
    setSaving("delete");
    setModalError(null);

    const segmentIds = timerState.segmentIds.length
      ? timerState.segmentIds
      : runningEntry
        ? [runningEntry.id]
        : [];

    if (segmentIds.length === 0) {
      setModalError("Geen timersegmenten gevonden");
      setSaving(null);
      return;
    }

    try {
      await Promise.all(segmentIds.map((id) => fetch(`/api/time-entries/${id}`, { method: "DELETE" })));
      clearTimerState(userId);
      setTimerState(null);
      setOptimisticEntry(null);
      setShowSaveModal(false);
      router.refresh();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Verwijderen mislukt");
    } finally {
      setSaving(null);
    }
  }

  if (!runningEntry && !pausedState && !pendingSave) {
    return null;
  }

  const title = runningEntry?.dossierTitle ?? pausedState?.dossierTitle ?? timerState?.dossierTitle ?? "Dossier";
  const label = pendingSave ? "Tijd te registreren" : pausedState ? "Gepauzeerde timer" : "Actieve timer";
  const totalMinutes = Math.max(1, Math.round(elapsedMs / 60000));
  const totalAmount = ((totalMinutes / 60) * hourlyRate).toFixed(2);

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-40 lg:left-[320px]">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#1c2942] px-5 py-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xl">⏱</span>
            <div>
              <p className="text-sm text-slate-300">{label}</p>
              <p className="text-base font-semibold">{title}</p>
            </div>
          </div>

          <div className="text-2xl font-mono text-emerald-400">{formatDuration(elapsedMs)}</div>

          <div className="flex items-center gap-2">
            {pendingSave ? null : pausedState ? (
              <button
                type="button"
                onClick={resumeTimer}
                disabled={loading !== null}
                className="rounded-xl bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-500 disabled:opacity-60"
              >
                Hervatten
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseTimer}
                disabled={loading !== null}
                className="rounded-xl bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-500 disabled:opacity-60"
              >
                Pauzeren
              </button>
            )}
            <button
              type="button"
              onClick={stopTimer}
              disabled={loading !== null}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              Stoppen
            </button>
          </div>
        </div>
      </div>

      {showSaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-7 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">⏱</span>
                <h3 className="text-2xl font-bold text-slate-800">Tijd registreren</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="rounded-md px-2 py-1 text-xl text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
              <p className="text-sm text-slate-500">Dossier</p>
              <p className="text-lg font-semibold text-slate-800">{title}</p>
              <p className="mt-1 text-sm text-slate-600">
                Duur: {formatDuration(elapsedMs)} ({totalMinutes} minuten)
              </p>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Beschrijving *</label>
              <textarea
                value={formDescription}
                onChange={(event) => setFormDescription(event.target.value)}
                placeholder="Wat heeft u gedaan?"
                rows={4}
                className="ld-input"
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-end">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Uurtarief (€)</label>
                <input
                  type="number"
                  min={0}
                  value={hourlyRate}
                  onChange={(event) => setHourlyRate(Number(event.target.value) || 0)}
                  className="ld-input"
                />
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={billable}
                  onChange={(event) => setBillable(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300"
                />
                Factureerbaar
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Bedrag: €{totalAmount}
            </div>

            {modalError ? <p className="mt-3 text-sm text-red-600">{modalError}</p> : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={deleteSegments}
                disabled={saving !== null}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
              >
                Verwijderen
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="ld-btn-secondary"
                >
                  Terug
                </button>
                <button
                  type="button"
                  onClick={saveTimeEntry}
                  disabled={saving !== null}
                  className="ld-btn-primary"
                >
                  {saving === "save" ? "Opslaan..." : "Tijd opslaan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
