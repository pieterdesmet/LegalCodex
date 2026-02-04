import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { clientUpdateSchema } from "@/lib/validators";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();

  const client = await prisma.client.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      dossiers: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!client) {
    notFound();
  }

  async function updateClientAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "CLIENT", "UPDATE")) {
      throw new Error("FORBIDDEN");
    }

    const parsed = clientUpdateSchema.safeParse({
      type: formData.get("type"),
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      address: formData.get("address")
    });

    if (!parsed.success) {
      throw new Error("Invalid update data");
    }

    const before = await prisma.client.findUnique({ where: { id: params.id } });
    if (!before) {
      throw new Error("Client not found");
    }

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null
      }
    });

    await writeAuditLog({
      actorUserId: currentUser.id,
      entityType: AuditEntityType.CLIENT,
      entityId: updated.id,
      action: AuditAction.UPDATE,
      before,
      after: updated
    });

    revalidatePath(`/clients/${params.id}`);
    revalidatePath("/clients");
  }

  async function archiveClientAction() {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "CLIENT", "DELETE")) {
      throw new Error("FORBIDDEN");
    }

    const before = await prisma.client.findUnique({ where: { id: params.id } });
    if (!before) {
      return;
    }

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: { deletedAt: new Date() }
    });

    await writeAuditLog({
      actorUserId: currentUser.id,
      entityType: AuditEntityType.CLIENT,
      entityId: params.id,
      action: AuditAction.DELETE,
      before,
      after: updated
    });

    revalidatePath("/clients");
  }

  const canEdit = hasPermission(user.role, "CLIENT", "UPDATE");
  const canDelete = hasPermission(user.role, "CLIENT", "DELETE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{client.name}</h1>
        {canDelete ? (
          <form action={archiveClientAction}>
            <button className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50" type="submit">
              Archive client
            </button>
          </form>
        ) : null}
      </div>

      {canEdit ? (
        <form action={updateClientAction} className="grid gap-3 rounded border border-slate-200 bg-white p-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm">Type</label>
            <select name="type" defaultValue={client.type} className="w-full rounded border border-slate-300 px-2 py-2 text-sm">
              <option value="PERSON">Person</option>
              <option value="COMPANY">Company</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Name</label>
            <input name="name" defaultValue={client.name} required className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <input name="email" type="email" defaultValue={client.email ?? ""} className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm">Phone</label>
            <input name="phone" defaultValue={client.phone ?? ""} className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm">Address</label>
            <input name="address" defaultValue={client.address ?? ""} className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <button className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700" type="submit">
              Save changes
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Dossiers</h2>
        <ul className="space-y-2">
          {client.dossiers.length === 0 ? (
            <li className="text-sm text-slate-500">No dossiers for this client.</li>
          ) : (
            client.dossiers.map((dossier) => (
              <li key={dossier.id} className="rounded border border-slate-100 p-3">
                <Link href={`/dossiers/${dossier.id}`} className="text-sm font-medium text-primary-700 hover:text-primary-600">
                  {dossier.title}
                </Link>
                <p className="text-xs text-slate-500">
                  {dossier.type} · {dossier.status}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
