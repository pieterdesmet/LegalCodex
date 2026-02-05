import { requireUser } from "@/lib/auth";
import { FloatingTimerButton } from "@/components/floating-timer";
import { Sidebar } from "@/components/sidebar";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const dossiers = await prisma.dossier.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
    take: 100
  });

  return (
    <div className="min-h-screen bg-[#eef3f9] lg:flex">
      <Sidebar />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div>{children}</div>
        <FloatingTimerButton dossiers={dossiers} />
      </main>
    </div>
  );
}
