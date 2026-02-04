import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AuditAction, AuditEntityType, DossierType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { dossierCreateSchema } from "@/lib/validators";

export default async function DossiersPage() {
  const user = await requireUser();

  const [dossiers, clients, users] = await Promise.all([
    prisma.dossier.findMany({
      where: { deletedAt: null },
      include: { client: true, owner: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } })
  ]);

  async function createDossierAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "DOSSIER", "CREATE")) {
      throw new Error("FORBIDDEN");
    }

    const parsed = dossierCreateSchema.safeParse({
      clientId: formData.get("clientId"),
      title: formData.get("title"),
      type: formData.get("type"),
      status: formData.get("status"),
      ownerUserId: formData.get("ownerUserId"),
      summary: formData.get("summary"),
      aiContext: formData.get("aiContext")
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
  }

  const canCreate = hasPermission(user.role, "DOSSIER", "CREATE");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dossiers</h1>

      {canCreate ? (
        <form action={createDossierAction} className="grid gap-3 rounded border border-slate-200 bg-white p-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm">Client</label>
            <select name="clientId" required className="w-full rounded border border-slate-300 px-2 py-2 text-sm">
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Owner</label>
            <select name="ownerUserId" required className="w-full rounded border border-slate-300 px-2 py-2 text-sm">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Title</label>
            <input name="title" required className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm">Type</label>
            <select name="type" defaultValue={DossierType.CONTRACT} className="w-full rounded border border-slate-300 px-2 py-2 text-sm">
              <option value="CONTRACT">Contract</option>
              <option value="DISPUTE">Dispute</option>
              <option value="REAL_ESTATE">Real estate</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Status</label>
            <select name="status" defaultValue="OPEN" className="w-full rounded border border-slate-300 px-2 py-2 text-sm">
              <option value="OPEN">Open</option>
              <option value="ON_HOLD">On hold</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">AI context</label>
            <input name="aiContext" className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm">Summary</label>
            <textarea name="summary" rows={3} className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <button className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700" type="submit">
              Create dossier
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Your role can view dossiers but cannot create them.
        </div>
      )}

      <div className="rounded border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map((dossier) => (
              <tr key={dossier.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/dossiers/${dossier.id}`} className="text-primary-700 hover:text-primary-600">
                    {dossier.title}
                  </Link>
                </td>
                <td className="px-3 py-2">{dossier.client.name}</td>
                <td className="px-3 py-2">{dossier.owner.name}</td>
                <td className="px-3 py-2">{dossier.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
