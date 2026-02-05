import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { dossierCreateSchema } from "@/lib/validators";

const legalAreas = [
  "Familierecht",
  "Strafrecht",
  "Ondernemingsrecht",
  "Arbeidsrecht",
  "Huurrecht",
  "Verzekeringsrecht",
  "Bestuursrecht",
  "Fiscaal recht",
  "Andere"
] as const;

function mapLegalAreaToType(area: string): "DISPUTE" | "CONTRACT" | "REAL_ESTATE" | "OTHER" {
  if (area === "Ondernemingsrecht") return "CONTRACT";
  if (area === "Huurrecht" || area === "Vastgoed") return "REAL_ESTATE";
  if (area === "Andere") return "OTHER";
  return "DISPUTE";
}

function getLegalAreaFromContext(aiContext: string | null) {
  if (!aiContext) return "Andere";
  const line = aiContext.split("\n").find((part) => part.startsWith("Rechtsdomein:"));
  return line ? line.replace("Rechtsdomein:", "").trim() : "Andere";
}

function dossierReference(index: number, createdAt: Date) {
  return `${createdAt.getFullYear()}/${String(index + 1).padStart(4, "0")}`;
}

function statusBadge(status: "OPEN" | "ON_HOLD" | "CLOSED") {
  if (status === "OPEN") return <span className="ld-badge bg-emerald-100 text-emerald-700">Actief</span>;
  if (status === "ON_HOLD") return <span className="ld-badge bg-amber-100 text-amber-700">In afwachting</span>;
  return <span className="ld-badge bg-slate-200 text-slate-600">Afgesloten</span>;
}

function priorityBadge(priority: "LAAG" | "NORMAAL" | "HOOG" | "URGENT") {
  if (priority === "URGENT") return <span className="ld-badge bg-red-100 text-red-700">Urgent</span>;
  if (priority === "HOOG") return <span className="ld-badge bg-amber-100 text-amber-700">Hoog</span>;
  if (priority === "LAAG") return <span className="ld-badge bg-slate-200 text-slate-600">Laag</span>;
  return <span className="ld-badge bg-blue-100 text-blue-700">Normaal</span>;
}

export default async function DossiersPage({
  searchParams
}: {
  searchParams: { q?: string; status?: string; new?: string; clientId?: string };
}) {
  const user = await requireUser();
  const q = searchParams.q?.trim() ?? "";
  const statusFilter = searchParams.status ?? "all";

  const [dossiers, clients] = await Promise.all([
    prisma.dossier.findMany({
      where: {
        deletedAt: null,
        ...(statusFilter !== "all" ? { status: statusFilter as "OPEN" | "ON_HOLD" | "CLOSED" } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { client: { name: { contains: q, mode: "insensitive" } } }
              ]
            }
          : {})
      },
      include: {
        client: true,
        tasks: {
          where: { status: { not: "DONE" } },
          select: { priority: true }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } })
  ]);

  async function createDossierAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "DOSSIER", "CREATE")) {
      throw new Error("FORBIDDEN");
    }

    const title = String(formData.get("title") || "").trim();
    const clientId = String(formData.get("clientId") || "");
    const legalArea = String(formData.get("legalArea") || "Andere");
    const status = String(formData.get("status") || "OPEN") as "OPEN" | "ON_HOLD" | "CLOSED";
    const priority = String(formData.get("priority") || "NORMAAL");
    const court = String(formData.get("court") || "").trim();
    const counterparty = String(formData.get("counterparty") || "").trim();
    const counterLawyer = String(formData.get("counterLawyer") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    const mappedType = mapLegalAreaToType(legalArea);

    const aiContext = [
      `Rechtsdomein: ${legalArea}`,
      `Prioriteit: ${priority}`,
      court ? `Rechtbank: ${court}` : "",
      counterparty ? `Tegenpartij: ${counterparty}` : "",
      counterLawyer ? `Advocaat tegenpartij: ${counterLawyer}` : "",
      notes ? `Notities: ${notes}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    const parsed = dossierCreateSchema.safeParse({
      clientId,
      title,
      type: mappedType,
      status,
      ownerUserId: currentUser.id,
      summary: description,
      aiContext
    });

    if (!parsed.success) {
      throw new Error("Invalid dossier data");
    }

    const created = await prisma.dossier.create({
      data: {
        ...parsed.data,
        summary: parsed.data.summary || null,
        aiContext: parsed.data.aiContext || null
      }
    });

    await writeAuditLog({
      actorUserId: currentUser.id,
      entityType: AuditEntityType.DOSSIER,
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created
    });

    revalidatePath("/dossiers");
    redirect(`/dossiers/${created.id}`);
  }

  const canCreate = hasPermission(user.role, "DOSSIER", "CREATE");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="ld-page-title">Dossiers</h1>
          <p className="mt-1 text-base text-slate-500">{dossiers.length} dossiers</p>
        </div>
        {canCreate ? (
          <Link href="/dossiers?new=1" className="ld-btn-primary">+ Nieuw dossier</Link>
        ) : null}
      </div>

      <form className="flex flex-col gap-3 xl:flex-row" action="/dossiers" method="get">
        <input name="q" defaultValue={q} placeholder="Zoek op titel, referentie of tegenpartij..." className="ld-input flex-1" />
        <select name="status" defaultValue={statusFilter} className="ld-input w-full xl:w-60">
          <option value="all">Alle statussen</option>
          <option value="OPEN">Actief</option>
          <option value="ON_HOLD">In afwachting</option>
          <option value="CLOSED">Afgesloten</option>
        </select>
      </form>

      <div className="ld-panel overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-5 py-4">Referentie</th>
              <th className="px-5 py-4">Titel</th>
              <th className="px-5 py-4">Cliënt</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Prioriteit</th>
              <th className="px-5 py-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map((dossier, index) => {
              const openPriorities = dossier.tasks.map((task) => task.priority);
              const computedPriority = openPriorities.includes("HIGH")
                ? "URGENT"
                : openPriorities.includes("MEDIUM")
                  ? "HOOG"
                  : openPriorities.length > 0
                    ? "NORMAAL"
                    : "LAAG";

              return (
                <tr key={dossier.id} className="border-t border-slate-200 text-sm">
                  <td className="px-5 py-4 font-bold text-slate-700">{dossierReference(index, dossier.createdAt)}</td>
                  <td className="px-5 py-4">
                    <Link href={`/dossiers/${dossier.id}`} className="font-bold text-[#1f45b2] hover:underline">
                      {dossier.title}
                    </Link>
                  </td>
                  <td className="px-5 py-4">{dossier.client.name}</td>
                  <td className="px-5 py-4">
                    <span className="ld-badge bg-slate-100 text-slate-600">{getLegalAreaFromContext(dossier.aiContext)}</span>
                  </td>
                  <td className="px-5 py-4">{priorityBadge(computedPriority)}</td>
                  <td className="px-5 py-4">{statusBadge(dossier.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {searchParams.new === "1" && canCreate ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-6">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-extrabold text-slate-800">Nieuw dossier</h2>
            <form action={createDossierAction} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Titel *</label>
                <input name="title" required className="ld-input" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cliënt *</label>
                  <select name="clientId" required className="ld-input" defaultValue={searchParams.clientId ?? ""}>
                    <option value="">Selecteer cliënt...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Type</label>
                  <select name="legalArea" className="ld-input" defaultValue="Andere">
                    {legalAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Prioriteit</label>
                  <select name="priority" className="ld-input" defaultValue="NORMAAL">
                    <option value="LAAG">Laag</option>
                    <option value="NORMAAL">Normaal</option>
                    <option value="HOOG">Hoog</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Rechtbank</label>
                  <input name="court" className="ld-input" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Tegenpartij</label>
                  <input name="counterparty" className="ld-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Advocaat tegenpartij</label>
                  <input name="counterLawyer" className="ld-input" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Beschrijving</label>
                <textarea name="description" rows={4} className="ld-input" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Notities</label>
                <textarea name="notes" rows={3} className="ld-input" />
              </div>

              <input type="hidden" name="status" value="OPEN" />

              <div className="flex justify-end gap-3 pt-2">
                <Link href="/dossiers" className="ld-btn-secondary">Annuleren</Link>
                <button type="submit" className="ld-btn-primary">Aanmaken</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
