import Link from "next/link";
import { addDays } from "@/lib/date";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  await requireUser();

  const now = new Date();
  const nextWeek = addDays(now, 7);

  const [openDossiers, dueTasks, recentDocuments, latestAIEvent] = await Promise.all([
    prisma.dossier.count({ where: { deletedAt: null, status: "OPEN" } }),
    prisma.task.findMany({
      where: {
        deadline: {
          gte: now,
          lte: nextWeek
        },
        status: { not: "DONE" },
        dossier: { deletedAt: null }
      },
      include: { dossier: true },
      orderBy: { deadline: "asc" },
      take: 8
    }),
    prisma.document.findMany({
      where: { dossier: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: { dossier: true },
      take: 6
    }),
    prisma.aIEvent.findFirst({
      orderBy: { createdAt: "desc" },
      include: { dossier: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Open dossiers</p>
          <p className="mt-2 text-3xl font-semibold">{openDossiers}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Tasks due next 7 days</p>
          <p className="mt-2 text-3xl font-semibold">{dueTasks.length}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Recent documents</p>
          <p className="mt-2 text-3xl font-semibold">{recentDocuments.length}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Deadlines</h2>
            <Link href="/tasks" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {dueTasks.length === 0 ? (
              <li className="text-sm text-slate-500">No deadlines in the next 7 days.</li>
            ) : (
              dueTasks.map((task) => (
                <li key={task.id} className="rounded border border-slate-100 p-3 text-sm">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-slate-500">{task.dossier.title}</p>
                  <p className="text-xs text-slate-400">
                    Due {task.deadline ? new Date(task.deadline).toLocaleString() : "No deadline"}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">AI Briefing</h2>
          <p className="text-xs text-slate-500">
            AI suggestions only. Not legal advice. Review and approve manually before applying changes.
          </p>
          {latestAIEvent ? (
            <div className="mt-4 rounded border border-blue-100 bg-blue-50 p-3">
              <p className="text-sm font-medium">Dossier: {latestAIEvent.dossier.title}</p>
              <p className="mt-1 text-xs text-slate-600">Trigger: {latestAIEvent.trigger}</p>
              <p className="mt-1 text-xs text-slate-600">Confidence: {(latestAIEvent.confidence * 100).toFixed(0)}%</p>
              <p className="mt-2 text-xs text-slate-500">{latestAIEvent.inputSummary}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No AI events yet.</p>
          )}
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Recent Documents</h2>
        <ul className="space-y-3">
          {recentDocuments.length === 0 ? (
            <li className="text-sm text-slate-500">No documents found.</li>
          ) : (
            recentDocuments.map((document) => (
              <li key={document.id} className="rounded border border-slate-100 p-3 text-sm">
                <p className="font-medium">{document.title}</p>
                <p className="text-slate-500">{document.dossier.title}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
