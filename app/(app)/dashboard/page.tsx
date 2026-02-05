import Link from "next/link";
import { addDays } from "@/lib/date";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function sumHours(entries: Array<{ startAt: Date; endAt: Date | null }>) {
  const totalMs = entries.reduce((sum, entry) => {
    if (!entry.endAt) return sum;
    return sum + (entry.endAt.getTime() - entry.startAt.getTime());
  }, 0);
  return totalMs / 1000 / 60 / 60;
}

function statusBadge(status: "OPEN" | "ON_HOLD" | "CLOSED") {
  if (status === "OPEN") {
    return <span className="ld-badge bg-emerald-100 text-emerald-700">Actief</span>;
  }

  if (status === "ON_HOLD") {
    return <span className="ld-badge bg-amber-100 text-amber-700">In afwachting</span>;
  }

  return <span className="ld-badge bg-slate-200 text-slate-600">Afgesloten</span>;
}

export default async function DashboardPage() {
  const user = await requireUser();

  const now = new Date();
  const nextWeek = addDays(now, 7);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = addDays(startToday, -7);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [openDossiers, openTasks, dueToday, recentDossiers, timeEntries, clientsCount, recentAudit] = await Promise.all([
    prisma.dossier.count({ where: { deletedAt: null, status: "OPEN" } }),
    prisma.task.count({ where: { status: { not: "DONE" }, dossier: { deletedAt: null } } }),
    prisma.task.findMany({
      where: {
        status: { not: "DONE" },
        deadline: { gte: startToday, lte: nextWeek },
        dossier: { deletedAt: null }
      },
      include: { dossier: true },
      orderBy: { deadline: "asc" },
      take: 4
    }),
    prisma.dossier.findMany({
      where: { deletedAt: null },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.timeEntry.findMany({
      where: { dossier: { deletedAt: null }, endAt: { not: null }, startAt: { gte: startMonth } },
      select: { startAt: true, endAt: true }
    }),
    prisma.client.count({ where: { deletedAt: null } }),
    prisma.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 6
    })
  ]);

  const todayHours = sumHours(timeEntries.filter((entry) => entry.startAt >= startToday));
  const weekHours = sumHours(timeEntries.filter((entry) => entry.startAt >= startWeek));
  const monthHours = sumHours(timeEntries);
  const monthRevenue = monthHours * 125;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="ld-page-title">{getGreeting(now)}</h1>
        <p className="mt-1 text-lg text-slate-500 capitalize">{formatDay(now)}</p>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Link href="/clients?new=1" className="ld-btn-primary">+ Nieuwe Cliënt</Link>
        <Link href="/dossiers?new=1" className="ld-btn-primary">+ Nieuw Dossier</Link>
        <Link href="/time-tracking?new=1" className="ld-btn-secondary">◷ Tijd loggen</Link>
        <Link href="/search" className="ld-btn-secondary">⌕ Zoeken (⌘K)</Link>
      </section>

      <section className="ld-panel px-6 py-5">
        <h2 className="text-2xl font-bold text-slate-800">Focus van vandaag</h2>
        {dueToday.length === 0 ? (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-6 text-center text-base font-semibold text-emerald-700">✓ Alles up-to-date!</p>
        ) : (
          <ul className="mt-5 space-y-2">
            {dueToday.map((task) => (
              <li key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-800">{task.title}</p>
                <p className="text-sm text-slate-500">
                  {task.dossier.title} · Deadline {task.deadline ? new Date(task.deadline).toLocaleDateString("nl-BE") : "-"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="ld-panel p-5">
          <p className="text-3xl font-extrabold text-slate-800">{openDossiers}</p>
          <p className="mt-1 text-sm text-slate-500">Actieve dossiers</p>
        </div>
        <div className="ld-panel p-5">
          <p className="text-3xl font-extrabold text-slate-800">{openTasks}</p>
          <p className="mt-1 text-sm text-slate-500">Open taken</p>
        </div>
        <div className="ld-panel p-5">
          <p className="text-3xl font-extrabold text-slate-800">{todayHours.toFixed(1)}u</p>
          <p className="mt-1 text-sm text-slate-500">Uren vandaag</p>
        </div>
        <div className="ld-panel p-5">
          <p className="text-3xl font-extrabold text-slate-800">{weekHours.toFixed(1)}u</p>
          <p className="mt-1 text-sm text-slate-500">Uren deze week</p>
        </div>
        <div className="ld-panel p-5">
          <p className="text-3xl font-extrabold text-slate-800">{monthHours.toFixed(1)}u</p>
          <p className="mt-1 text-sm text-slate-500">Uren deze maand</p>
          <p className="mt-1 text-sm font-semibold text-emerald-700">€{monthRevenue.toFixed(0)}</p>
        </div>
        <div className="ld-panel p-5">
          <p className="text-3xl font-extrabold text-slate-800">{clientsCount}</p>
          <p className="mt-1 text-sm text-slate-500">Cliënten</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="ld-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800">Recente dossiers</h3>
            <Link href="/dossiers" className="text-sm font-semibold text-[#2847b8]">Alle bekijken →</Link>
          </div>
          <ul className="space-y-3">
            {recentDossiers.map((dossier) => (
              <li key={dossier.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/dossiers/${dossier.id}`} className="text-base font-bold text-[#1f45b2] hover:underline">
                      {dossier.title}
                    </Link>
                    <p className="text-sm text-slate-500">{dossier.client.name}</p>
                  </div>
                  {statusBadge(dossier.status)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="ld-panel p-6">
          <h3 className="mb-4 text-xl font-bold text-slate-800">Recente activiteiten</h3>
          <ul className="divide-y divide-slate-200">
            {recentAudit.map((item) => (
              <li key={item.id} className="py-3">
                <p className="text-sm text-slate-800">
                  <span className="font-semibold">{item.action}</span> {item.entityType.toLowerCase()} · {item.actor?.name ?? user.name}
                </p>
                <p className="text-base text-slate-500">{new Date(item.createdAt).toLocaleString("nl-BE")}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
