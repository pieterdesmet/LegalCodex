import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireUser();

  const q = searchParams.q?.trim() ?? "";

  const [clients, dossiers, tasks, documents] = q
    ? await Promise.all([
        prisma.client.findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } }
            ]
          },
          take: 8,
          orderBy: { createdAt: "desc" }
        }),
        prisma.dossier.findMany({
          where: {
            deletedAt: null,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { aiContext: { contains: q, mode: "insensitive" } }
            ]
          },
          include: { client: true },
          take: 8,
          orderBy: { createdAt: "desc" }
        }),
        prisma.task.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } }
            ],
            dossier: { deletedAt: null }
          },
          include: { dossier: true },
          take: 8,
          orderBy: { createdAt: "desc" }
        }),
        prisma.document.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } }
            ],
            dossier: { deletedAt: null }
          },
          include: { dossier: true },
          take: 8,
          orderBy: { createdAt: "desc" }
        })
      ])
    : [[], [], [], []];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">Zoeken</h1>
        <p className="mt-1 text-base text-slate-500">Doorzoek cliënten, dossiers, taken en documenten</p>
      </div>

      <form action="/search" method="get" className="ld-panel p-3">
        <input name="q" defaultValue={q} placeholder="Zoekterm..." className="ld-input" />
      </form>

      {!q ? (
        <div className="ld-panel p-6 text-sm text-slate-500">Geef een zoekterm op.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="ld-panel p-5">
            <h2 className="text-lg font-bold text-slate-800">Cliënten ({clients.length})</h2>
            <ul className="mt-3 space-y-2">
              {clients.map((client) => (
                <li key={client.id}>
                  <Link href={`/clients/${client.id}`} className="text-sm font-semibold text-[#1f45b2] hover:underline">
                    {client.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="ld-panel p-5">
            <h2 className="text-lg font-bold text-slate-800">Dossiers ({dossiers.length})</h2>
            <ul className="mt-3 space-y-2">
              {dossiers.map((dossier) => (
                <li key={dossier.id}>
                  <Link href={`/dossiers/${dossier.id}`} className="text-sm font-semibold text-[#1f45b2] hover:underline">
                    {dossier.title}
                  </Link>
                  <p className="text-xs text-slate-500">{dossier.client.name}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="ld-panel p-5">
            <h2 className="text-lg font-bold text-slate-800">Taken ({tasks.length})</h2>
            <ul className="mt-3 space-y-2">
              {tasks.map((task) => (
                <li key={task.id}>
                  <Link href={`/dossiers/${task.dossierId}`} className="text-sm font-semibold text-[#1f45b2] hover:underline">
                    {task.title}
                  </Link>
                  <p className="text-xs text-slate-500">{task.dossier.title}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="ld-panel p-5">
            <h2 className="text-lg font-bold text-slate-800">Documenten ({documents.length})</h2>
            <ul className="mt-3 space-y-2">
              {documents.map((document) => (
                <li key={document.id}>
                  <Link href={`/dossiers/${document.dossierId}`} className="text-sm font-semibold text-[#1f45b2] hover:underline">
                    {document.title}
                  </Link>
                  <p className="text-xs text-slate-500">{document.dossier.title}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
