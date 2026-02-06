import { requireUser } from "@/lib/auth";
import { FloatingTimerButton } from "@/components/floating-timer";
import { Sidebar } from "@/components/sidebar";
import { prisma } from "@/lib/prisma";
import { TimerBar } from "@/components/timer-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [dossiers, runningEntry] = await Promise.all([
    prisma.dossier.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
    take: 100
  }),
    prisma.timeEntry.findFirst({
      where: { userId: user.id, endAt: null },
      include: { dossier: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const timerEntry = runningEntry
    ? {
        id: runningEntry.id,
        dossierId: runningEntry.dossierId,
        dossierTitle: runningEntry.dossier.title,
        startAt: runningEntry.startAt.toISOString(),
        description: runningEntry.description
      }
    : null;

  return (
    <div className="min-h-screen bg-[#eef3f9] lg:flex">
      <Sidebar />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div>{children}</div>
        <TimerBar initialEntry={timerEntry} userId={user.id} />
        <FloatingTimerButton dossiers={dossiers} disabled={Boolean(runningEntry)} userId={user.id} />
      </main>
    </div>
  );
}
