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
      address: formData.get("address"),
      vatNumber: formData.get("vatNumber"),
      companyNumber: formData.get("companyNumber"),
      contactFirstName: formData.get("contactFirstName"),
      contactLastName: formData.get("contactLastName"),
      contactEmail: formData.get("contactEmail")
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
        address: parsed.data.address || null,
        vatNumber: parsed.data.vatNumber || null,
        companyNumber: parsed.data.companyNumber || null,
        contactFirstName: parsed.data.contactFirstName || null,
        contactLastName: parsed.data.contactLastName || null,
        contactEmail: parsed.data.contactEmail || null
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
        <h1 className="ld-page-title">{client.name}</h1>
        {canDelete ? (
          <form action={archiveClientAction}>
            <button className="rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50" type="submit">
              Cliënt archiveren
            </button>
          </form>
        ) : null}
      </div>

      {canEdit ? (
        <form action={updateClientAction} className="ld-panel grid gap-4 p-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Type</label>
            <select name="type" defaultValue={client.type} className="ld-input">
              <option value="PERSON">Particulier</option>
              <option value="COMPANY">Bedrijf</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Naam</label>
            <input name="name" defaultValue={client.name} required className="ld-input" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
            <input name="email" type="email" defaultValue={client.email ?? ""} className="ld-input" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Telefoon</label>
            <input name="phone" defaultValue={client.phone ?? ""} className="ld-input" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Adres</label>
            <input name="address" defaultValue={client.address ?? ""} className="ld-input" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">BTW-nummer</label>
            <input name="vatNumber" defaultValue={client.vatNumber ?? ""} className="ld-input" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Ondernemingsnummer</label>
            <input name="companyNumber" defaultValue={client.companyNumber ?? ""} className="ld-input" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voornaam contactpersoon</label>
            <input name="contactFirstName" defaultValue={client.contactFirstName ?? ""} className="ld-input" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Naam contactpersoon</label>
            <input name="contactLastName" defaultValue={client.contactLastName ?? ""} className="ld-input" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email contactpersoon</label>
            <input name="contactEmail" type="email" defaultValue={client.contactEmail ?? ""} className="ld-input" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="ld-btn-primary" type="submit">
              Wijzigingen opslaan
            </button>
          </div>
        </form>
      ) : null}

      <section className="ld-panel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Dossiers</h2>
        <ul className="space-y-2">
          {client.dossiers.length === 0 ? (
            <li className="text-sm text-slate-500">Geen dossiers voor deze cliënt.</li>
          ) : (
            client.dossiers.map((dossier) => (
              <li key={dossier.id} className="rounded-xl border border-slate-200 p-3">
                <Link href={`/dossiers/${dossier.id}`} className="text-sm font-semibold text-[#1f45b2] hover:underline">
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
