import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AuditAction, AuditEntityType, ClientType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { clientCreateSchema } from "@/lib/validators";

export default async function ClientsPage() {
  const user = await requireUser();

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { dossiers: true } } }
  });

  async function createClientAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "CLIENT", "CREATE")) {
      throw new Error("FORBIDDEN");
    }

    const parsed = clientCreateSchema.safeParse({
      type: formData.get("type"),
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      address: formData.get("address")
    });

    if (!parsed.success) {
      throw new Error("Invalid client data");
    }

    const created = await prisma.client.create({
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
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created
    });

    revalidatePath("/clients");
  }

  const canCreate = hasPermission(user.role, "CLIENT", "CREATE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
      </div>

      {canCreate ? (
        <form action={createClientAction} className="grid gap-3 rounded border border-slate-200 bg-white p-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm">Type</label>
            <select name="type" defaultValue={ClientType.PERSON} className="w-full rounded border border-slate-300 px-2 py-2 text-sm">
              <option value="PERSON">Person</option>
              <option value="COMPANY">Company</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Name</label>
            <input name="name" required className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <input name="email" type="email" className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm">Phone</label>
            <input name="phone" className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm">Address</label>
            <input name="address" className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <button className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700" type="submit">
              Create client
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Your role can view clients but cannot create them.
        </div>
      )}

      <div className="rounded border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Dossiers</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/clients/${client.id}`} className="text-primary-700 hover:text-primary-600">
                    {client.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{client.type}</td>
                <td className="px-3 py-2">{client.email ?? "-"}</td>
                <td className="px-3 py-2">{client._count.dossiers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
