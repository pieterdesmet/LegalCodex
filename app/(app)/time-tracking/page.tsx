import { revalidatePath } from "next/cache";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export default async function TimeTrackingPage() {
  const user = await requireUser();

  const [entries, dossiers, runningEntry] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { dossier: { deletedAt: null } },
      include: { dossier: true, user: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.dossier.findMany({ where: { deletedAt: null }, orderBy: { title: "asc" } }),
    prisma.timeEntry.findFirst({ where: { userId: user.id, endAt: null }, include: { dossier: true } })
  ]);

  async function startTimerAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "TIME_ENTRY", "CREATE")) {
      throw new Error("FORBIDDEN");
    }

    const dossierId = String(formData.get("dossierId") || "");
    const description = String(formData.get("description") || "");

    if (!dossierId || !description) {
      throw new Error("Dossier and description are required");
    }

    const created = await prisma.timeEntry.create({
      data: {
        dossierId,
        userId: currentUser.id,
        description,
        startAt: new Date(),
        autoCaptured: false
      }
    });

    await writeAuditLog({
      actorUserId: currentUser.id,
      entityType: AuditEntityType.TIME_ENTRY,
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created
    });

    revalidatePath("/time-tracking");
  }

  async function stopTimerAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "TIME_ENTRY", "UPDATE")) {
      throw new Error("FORBIDDEN");
    }

    const id = String(formData.get("id") || "");
    const before = await prisma.timeEntry.findUnique({ where: { id } });
    if (!before) {
      return;
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: { endAt: new Date() }
    });

    await writeAuditLog({
      actorUserId: currentUser.id,
      entityType: AuditEntityType.TIME_ENTRY,
      entityId: id,
      action: AuditAction.UPDATE,
      before,
      after: updated
    });

    revalidatePath("/time-tracking");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Time Tracking</h1>

      {hasPermission(user.role, "TIME_ENTRY", "CREATE") ? (
        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Start / stop timer</h2>

          {runningEntry ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="font-medium">Running: {runningEntry.description}</p>
              <p className="text-xs text-slate-600">{runningEntry.dossier.title}</p>
              <form action={stopTimerAction} className="mt-2">
                <input type="hidden" name="id" value={runningEntry.id} />
                <button type="submit" className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white">
                  Stop timer
                </button>
              </form>
            </div>
          ) : (
            <form action={startTimerAction} className="grid gap-3 md:grid-cols-3">
              <select name="dossierId" required className="rounded border border-slate-300 px-2 py-2 text-sm">
                {dossiers.map((dossier) => (
                  <option key={dossier.id} value={dossier.id}>
                    {dossier.title}
                  </option>
                ))}
              </select>
              <input name="description" required placeholder="What are you working on?" className="rounded border border-slate-300 px-2 py-2 text-sm md:col-span-2" />
              <button type="submit" className="w-fit rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                Start timer
              </button>
            </form>
          )}
        </section>
      ) : null}

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Entries</h2>
        <ul className="space-y-2">
          {entries.length === 0 ? (
            <li className="text-sm text-slate-500">No time entries yet.</li>
          ) : (
            entries.map((entry) => (
              <li key={entry.id} className="rounded border border-slate-100 p-3 text-sm">
                <p className="font-medium">{entry.description}</p>
                <p className="text-xs text-slate-500">
                  {entry.dossier.title} · {entry.user.name} · {new Date(entry.startAt).toLocaleString()} -{" "}
                  {entry.endAt ? new Date(entry.endAt).toLocaleString() : "Running"}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
