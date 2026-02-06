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
};

function storageKey(userId: string) {
  return `ld_timer_${userId}`;
}

function loadTimerState(userId: string): StoredTimerState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredTimerState;
    if (!parsed?.dossierId) return null;
    return parsed;
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

  const runningEntry = initialEntry ?? optimisticEntry;
  const pausedState = !runningEntry && timerState?.paused ? timerState : null;

  useEffect(() => {
    setTimerState(loadTimerState(userId));
  }, [userId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!runningEntry) return;
    if (!timerState) {
      const next = {
        dossierId: runningEntry.dossierId,
        dossierTitle: runningEntry.dossierTitle,
        description: runningEntry.description,
        carryMs: 0,
        paused: false
      };
      saveTimerState(userId, next);
      setTimerState(next);
      return;
    }

    if (timerState.dossierId !== runningEntry.dossierId) {
      const next = {
        dossierId: runningEntry.dossierId,
        dossierTitle: runningEntry.dossierTitle,
        description: runningEntry.description,
        carryMs: 0,
        paused: false
      };
      saveTimerState(userId, next);
      setTimerState(next);
      return;
    }

    if (timerState.paused) {
      const next = { ...timerState, paused: false };
      saveTimerState(userId, next);
      setTimerState(next);
    }
  }, [runningEntry, timerState, userId]);

  useEffect(() => {
    if (initialEntry) {
      setOptimisticEntry(null);
    }
  }, [initialEntry]);

  const elapsedMs = useMemo(() => {
    if (runningEntry) {
      const base = timerState?.dossierId === runningEntry.dossierId ? timerState.carryMs : 0;
      return base + (now - new Date(runningEntry.startAt).getTime());
    }
    if (pausedState) return pausedState.carryMs;
    return 0;
  }, [runningEntry, pausedState, timerState, now]);

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

      const nextState: StoredTimerState = {
        dossierId: runningEntry.dossierId,
        dossierTitle: runningEntry.dossierTitle,
        description: runningEntry.description,
        carryMs: totalMs,
        paused: true
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
    setLoading("stop");
    try {
      if (runningEntry) {
        await fetch(`/api/time-entries/${runningEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endAt: new Date().toISOString() })
        });
      }

      clearTimerState(userId);
      setTimerState(null);
      setOptimisticEntry(null);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function resumeTimer() {
    if (!pausedState) return;
    setLoading("resume");

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
      const nextState: StoredTimerState = { ...pausedState, paused: false };
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

  if (!runningEntry && !pausedState) {
    return null;
  }

  const title = runningEntry?.dossierTitle ?? pausedState?.dossierTitle ?? "Dossier";
  const label = pausedState ? "Gepauzeerde timer" : "Actieve timer";

  return (
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
          {pausedState ? (
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
  );
}
