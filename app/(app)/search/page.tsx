import Link from "next/link";
import { AuditEntityType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; auditType?: string } }) {
  const user = await requireUser();

  const q = searchParams.q?.trim() ?? "";
  const auditTypeOptions = [
    "all",
    AuditEntityType.CLIENT,
    AuditEntityType.DOSSIER,
    AuditEntityType.TASK,
    AuditEntityType.DOCUMENT,
    AuditEntityType.TIME_ENTRY,
    AuditEntityType.TEMPLATE
  ] as const;
  const auditType =
    searchParams.auditType && auditTypeOptions.includes(searchParams.auditType as typeof auditTypeOptions[number])
      ? (searchParams.auditType as typeof auditTypeOptions[number])
      : "all";
  const canReadClients = hasPermission(user.role, "CLIENT", "READ");
  const canReadDossiers = hasPermission(user.role, "DOSSIER", "READ");
  const canReadTasks = hasPermission(user.role, "TASK", "READ");
  const canReadDocuments = hasPermission(user.role, "DOCUMENT", "READ");
  const canReadTemplates = hasPermission(user.role, "TEMPLATE", "READ");
  const canReadTimeEntries = hasPermission(user.role, "TIME_ENTRY", "READ");
  const canReadAudit = user.role !== "STAFF";

  const [clients, dossiers, tasks, documents, templates, timeEntries, auditLogs] = q
    ? await Promise.all([
        canReadClients
          ? prisma.client.findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { vatNumber: { contains: q, mode: "insensitive" } },
              { contactEmail: { contains: q, mode: "insensitive" } }
            ]
          },
          take: 8,
          orderBy: { createdAt: "desc" }
        })
          : Promise.resolve([]),
        canReadDossiers
          ? prisma.dossier.findMany({
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
        })
          : Promise.resolve([]),
        canReadTasks
          ? prisma.task.findMany({
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
        })
          : Promise.resolve([]),
        canReadDocuments
          ? prisma.document.findMany({
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
          : Promise.resolve([]),
        canReadTemplates
          ? prisma.template.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { type: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } }
            ]
          },
          take: 8,
          orderBy: { createdAt: "desc" }
        })
          : Promise.resolve([]),
        canReadTimeEntries
          ? prisma.timeEntry.findMany({
          where: {
            OR: [{ description: { contains: q, mode: "insensitive" } }, { dossier: { title: { contains: q, mode: "insensitive" } } }],
            dossier: { deletedAt: null }
          },
          include: { dossier: true, user: true },
          take: 8,
          orderBy: { createdAt: "desc" }
        })
          : Promise.resolve([]),
        canReadAudit
          ? prisma.auditLog.findMany({
          where: {
            AND: [
              auditType !== "all" ? { entityType: auditType } : {},
              {
                OR: [
                  { entityId: { contains: q, mode: "insensitive" } },
                  { actor: { is: { name: { contains: q, mode: "insensitive" } } } }
                ]
              }
            ]
          },
          include: { actor: true },
          take: 8,
          orderBy: { createdAt: "desc" }
        })
          : Promise.resolve([])
      ])
    : [[], [], [], [], [], [], []];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="ld-page-title">Zoeken</h1>
        <p className="mt-1 text-base text-slate-500">Doorzoek de volledige applicatie</p>
      </div>

      <form action="/search" method="get" className="ld-panel flex flex-col gap-3 p-3 md:flex-row">
        <input name="q" defaultValue={q} placeholder="Zoekterm..." className="ld-input flex-1" />
        {canReadAudit ? (
          <select name="auditType" defaultValue={auditType} className="ld-input md:w-56">
            <option value="all">Audit: alle types</option>
            <option value={AuditEntityType.CLIENT}>Audit: cliënten</option>
            <option value={AuditEntityType.DOSSIER}>Audit: dossiers</option>
            <option value={AuditEntityType.TASK}>Audit: taken</option>
            <option value={AuditEntityType.DOCUMENT}>Audit: documenten</option>
            <option value={AuditEntityType.TIME_ENTRY}>Audit: tijd</option>
            <option value={AuditEntityType.TEMPLATE}>Audit: templates</option>
          </select>
        ) : null}
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

          <section className="ld-panel p-5">
            <h2 className="text-lg font-bold text-slate-800">Templates ({templates.length})</h2>
            <ul className="mt-3 space-y-2">
              {templates.map((template) => (
                <li key={template.id} className="text-sm">
                  <p className="font-semibold text-slate-800">{template.name}</p>
                  <p className="text-xs text-slate-500">{template.type}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="ld-panel p-5">
            <h2 className="text-lg font-bold text-slate-800">Tijdsregistraties ({timeEntries.length})</h2>
            <ul className="mt-3 space-y-2">
              {timeEntries.map((entry) => (
                <li key={entry.id}>
                  <Link href="/time-tracking" className="text-sm font-semibold text-[#1f45b2] hover:underline">
                    {entry.description}
                  </Link>
                  <p className="text-xs text-slate-500">{entry.dossier.title} · {entry.user.name}</p>
                </li>
              ))}
            </ul>
          </section>

          {canReadAudit ? (
            <section className="ld-panel p-5 lg:col-span-2">
              <h2 className="text-lg font-bold text-slate-800">Audit logs ({auditLogs.length})</h2>
              <ul className="mt-3 space-y-2">
                {auditLogs.map((item) => (
                  <li key={item.id} className="text-sm text-slate-700">
                    <span className="font-semibold">{item.action}</span> {item.entityType} ({item.entityId}) · {item.actor?.name ?? "Onbekend"}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
