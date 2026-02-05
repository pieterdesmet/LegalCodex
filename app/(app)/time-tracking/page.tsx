import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

function todayInputDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function TimeTrackingPage({
  searchParams
}: {
  searchParams: { new?: string };
}) {
  const user = await requireUser();

  const [entries, dossiers, runningEntry] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { dossier: { deletedAt: null } },
      include: { dossier: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.dossier.findMany({ where: { deletedAt: null }, orderBy: { title: "asc" } }),
    prisma.timeEntry.findFirst({ where: { userId: user.id, endAt: null }, include: { dossier: true } })
  ]);

  async function registerTimeAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "TIME_ENTRY", "CREATE")) {
      throw new Error("FORBIDDEN");
    }

    const dossierId = String(formData.get("dossierId") || "");
    const description = String(formData.get("description") || "").trim();
    const date = String(formData.get("date") || "");
    const duration = Number(formData.get("duration") || 0);
    const hourlyRate = Number(formData.get("hourlyRate") || 125);
    const billable = formData.get("billable") === "on";

    if (!dossierId || !description || !date || duration <= 0) {
      throw new Error("Vul alle verplichte velden in");
    }

    const startAt = new Date(`${date}T09:00:00`);
    const endAt = new Date(startAt.getTime() + duration * 60_000);
    const finalDescription = `${description}${billable ? "" : " (niet factureerbaar)"} · €${hourlyRate}/u`;

    const created = await prisma.timeEntry.create({
      data: {
        dossierId,
        userId: currentUser.id,
        startAt,
        endAt,
        description: finalDescription,
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
    revalidatePath("/dashboard");
  }

  async function startTimerAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "TIME_ENTRY", "CREATE")) {
      throw new Error("FORBIDDEN");
    }

    const dossierId = String(formData.get("dossierId") || "");
    const description = String(formData.get("description") || "");

    if (!dossierId || !description) {
      throw new Error("Dossier en beschrijving zijn verplicht");
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

  const canCreate = hasPermission(user.role, "TIME_ENTRY", "CREATE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">Tijd registreren</h1>
      </div>

      <section className="ld-panel p-6">
        <form action={registerTimeAction} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Dossier *</label>
            <select name="dossierId" required className="ld-input" defaultValue={searchParams.new ? "" : dossiers[0]?.id}>
              <option value="">Selecteer dossier...</option>
              {dossiers.map((dossier) => (
                <option key={dossier.id} value={dossier.id}>
                  {dossier.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Beschrijving *</label>
            <input
              name="description"
              required
              placeholder="Bijv. Telefonisch overleg met cliënt"
              className="ld-input"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Datum</label>
              <input name="date" type="date" defaultValue={todayInputDate()} className="ld-input" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Duur (minuten) *</label>
              <input name="duration" type="number" min={1} defaultValue={30} className="ld-input" required />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:items-end">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Uurtarief (€)</label>
              <input name="hourlyRate" type="number" min={0} defaultValue={125} className="ld-input" />
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input name="billable" type="checkbox" defaultChecked className="h-6 w-6 rounded border-slate-300" />
              Factureerbaar
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/dashboard" className="ld-btn-secondary">Annuleren</Link>
            <button type="submit" className="ld-btn-primary">Registreren</button>
          </div>
        </form>
      </section>

      {canCreate ? (
        <section className="ld-panel p-6">
          <h2 className="text-2xl font-extrabold text-slate-800">Snelle timer</h2>
          {runningEntry ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-base font-semibold text-emerald-700">Timer loopt: {runningEntry.description}</p>
              <p className="text-sm text-slate-500">{runningEntry.dossier.title}</p>
              <form action={stopTimerAction} className="mt-3">
                <input type="hidden" name="id" value={runningEntry.id} />
                <button type="submit" className="ld-btn-primary">Stop timer</button>
              </form>
            </div>
          ) : (
            <form action={startTimerAction} className="mt-4 grid gap-3 md:grid-cols-3">
              <select name="dossierId" required className="ld-input">
                {dossiers.map((dossier) => (
                  <option key={dossier.id} value={dossier.id}>
                    {dossier.title}
                  </option>
                ))}
              </select>
              <input name="description" required placeholder="Wat ben je aan het doen?" className="ld-input md:col-span-2" />
              <button type="submit" className="ld-btn-primary w-fit">Start timer</button>
            </form>
          )}
        </section>
      ) : null}

      <section className="ld-panel p-6">
        <h2 className="text-2xl font-extrabold text-slate-800">Recente registraties</h2>
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => {
            const minutes = entry.endAt
              ? Math.round((entry.endAt.getTime() - entry.startAt.getTime()) / 60000)
              : null;

            return (
              <li key={entry.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">{entry.description}</p>
                <p className="text-sm text-slate-500">
                  {entry.dossier.title} · {entry.user.name} · {new Date(entry.startAt).toLocaleDateString("nl-BE")}
                  {minutes ? ` · ${minutes} min` : " · Lopend"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
