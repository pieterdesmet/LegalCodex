import { requireUser } from "@/lib/auth";
import { FloatingTimerButton } from "@/components/floating-timer";
import { Sidebar } from "@/components/sidebar";
import { prisma } from "@/lib/prisma";
import { TimerBar } from "@/components/timer-bar";
import { hasPermission } from "@/lib/rbac";

function dossierReference(index: number, createdAt: Date) {
  return `${createdAt.getFullYear()}/${String(index + 1).padStart(4, "0")}`;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [dossiers, runningEntry] = await Promise.all([
    prisma.dossier.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    prisma.timeEntry.findFirst({
      where: { userId: user.id, endAt: null },
      include: { dossier: { select: { id: true, title: true, createdAt: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const dossierOptions = dossiers.map((dossier, index) => {
    const reference = dossierReference(index, dossier.createdAt);
    return {
      id: dossier.id,
      title: dossier.title,
      label: `${reference} - ${dossier.title}`
    };
  });
  const dossierLabelMap = new Map(dossierOptions.map((item) => [item.id, item.label]));
  const canDeleteTimeEntry = hasPermission(user.role, "TIME_ENTRY", "DELETE");

  const timerEntry = runningEntry
    ? {
        id: runningEntry.id,
        dossierId: runningEntry.dossierId,
        dossierTitle: dossierLabelMap.get(runningEntry.dossierId) ?? runningEntry.dossier.title,
        startAt: runningEntry.startAt.toISOString(),
        description: runningEntry.description
      }
    : null;

  return (
    <div className="min-h-screen bg-[#eef3f9] lg:flex">
      <Sidebar />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div>{children}</div>
        <TimerBar initialEntry={timerEntry} userId={user.id} canDelete={canDeleteTimeEntry} />
        <FloatingTimerButton dossiers={dossierOptions} disabled={Boolean(runningEntry)} userId={user.id} />
      </main>
    </div>
  );
}
