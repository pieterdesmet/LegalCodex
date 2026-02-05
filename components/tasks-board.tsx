"use client";

import { useMemo, useState } from "react";

type TaskItem = {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dossierId: string;
  dossierTitle: string;
  deadline: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
};

function priorityBadge(priority: TaskItem["priority"]) {
  if (priority === "HIGH") return <span className="ld-badge bg-red-100 text-red-700">Urgent</span>;
  if (priority === "MEDIUM") return <span className="ld-badge bg-amber-100 text-amber-700">Hoog</span>;
  return <span className="ld-badge bg-blue-100 text-blue-700">Normaal</span>;
}

function columnStyle(status: TaskItem["status"]) {
  if (status === "TODO") {
    return { wrapper: "border-blue-200 bg-blue-50/40", title: "text-blue-600", count: "bg-blue-500", label: "Te doen" };
  }
  if (status === "IN_PROGRESS") {
    return { wrapper: "border-amber-200 bg-amber-50/40", title: "text-amber-600", count: "bg-amber-500", label: "Bezig" };
  }
  return { wrapper: "border-emerald-200 bg-emerald-50/40", title: "text-emerald-700", count: "bg-emerald-600", label: "Voltooid" };
}

export function TasksBoard({ initialTasks, canDelete }: { initialTasks: TaskItem[]; canDelete: boolean }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [dragId, setDragId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return {
      TODO: tasks.filter((task) => task.status === "TODO"),
      IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS"),
      DONE: tasks.filter((task) => task.status === "DONE")
    };
  }, [tasks]);

  async function moveTask(taskId: string, status: TaskItem["status"]) {
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      // Restore last known state from server could be nicer; for MVP just refresh.
      window.location.reload();
    }
  }

  async function deleteTask(taskId: string) {
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!response.ok) {
      return;
    }

    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      {(["TODO", "IN_PROGRESS", "DONE"] as const).map((status) => {
        const style = columnStyle(status);

        return (
          <div
            key={status}
            className={`ld-panel border-2 p-3 ${style.wrapper}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData("text/task-id") || dragId;
              if (!taskId) return;
              moveTask(taskId, status);
              setDragId(null);
            }}
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className={`text-xs font-extrabold uppercase ${style.title}`}>{style.label}</h2>
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${style.count}`}>
                {grouped[status].length}
              </span>
            </div>

            <div className="space-y-3">
              {grouped[status].map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/task-id", task.id);
                    setDragId(task.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className="cursor-grab rounded-2xl border border-slate-200 bg-white p-4 active:cursor-grabbing"
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <p className={`text-base font-bold ${status === "DONE" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {task.title}
                    </p>
                    {priorityBadge(task.priority)}
                  </div>
                  <p className="text-sm text-slate-500">
                    {task.deadline ? new Date(task.deadline).toLocaleDateString("nl-BE") : "Geen deadline"}
                  </p>
                  <p className="text-sm text-slate-500">Dossier: {task.dossierTitle}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["TODO", "IN_PROGRESS", "DONE"] as const)
                      .filter((item) => item !== status)
                      .map((target) => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => moveTask(task.id, target)}
                          className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
                        >
                          {target === "TODO" ? "Te doen" : target === "IN_PROGRESS" ? "Bezig" : "Voltooid"}
                        </button>
                      ))}
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Verwijder
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
