import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { clientCreateSchema } from "@/lib/validators";

function extractCity(address: string | null) {
  if (!address) return "-";
  const chunks = address.split(",").map((chunk) => chunk.trim()).filter(Boolean);
  if (chunks.length === 0) return "-";
  return chunks[chunks.length - 1] ?? "-";
}

function typeBadge(type: "PERSON" | "COMPANY") {
  if (type === "COMPANY") {
    return <span className="ld-badge bg-purple-100 text-purple-700">Bedrijf</span>;
  }

  return <span className="ld-badge bg-blue-100 text-blue-700">Particulier</span>;
}

export default async function ClientsPage({
  searchParams
}: {
  searchParams: { q?: string; new?: string; type?: string; created?: string; name?: string };
}) {
  const user = await requireUser();
  const q = searchParams.q?.trim() ?? "";

  const clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: "desc" }
  });

  async function createClientAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "CLIENT", "CREATE")) {
      throw new Error("FORBIDDEN");
    }

    const flowType = String(formData.get("flowType") || "PERSON") as "PERSON" | "COMPANY";

    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const companyName = String(formData.get("companyName") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const addressLine = String(formData.get("address") || "").trim();
    const postcode = String(formData.get("postcode") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    const vatNumber = String(formData.get("vatNumber") || "").trim();
    const companyNumber = String(formData.get("companyNumber") || "").trim();
    const contactFirstName = String(formData.get("contactFirstName") || "").trim();
    const contactLastName = String(formData.get("contactLastName") || "").trim();
    const contactEmail = String(formData.get("contactEmail") || "").trim();

    if (flowType === "COMPANY") {
      if (!companyName || !vatNumber || !contactFirstName || !contactLastName || !contactEmail) {
        throw new Error("Voor bedrijf zijn bedrijfsnaam, BTW en contactpersoon verplicht");
      }
    }

    if (flowType === "PERSON" && !firstName && !lastName) {
      throw new Error("Voornaam of naam is verplicht");
    }

    const name = flowType === "COMPANY" ? companyName : [firstName, lastName].filter(Boolean).join(" ");

    const joinedAddress = [addressLine, [postcode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

    const extraLines: string[] = [];
    if (flowType === "COMPANY") {
      extraLines.push(`BTW: ${vatNumber}`);
      if (companyNumber) extraLines.push(`Ondernemingsnummer: ${companyNumber}`);
      extraLines.push(`Contactpersoon: ${contactFirstName} ${contactLastName}`);
      extraLines.push(`Contact email: ${contactEmail}`);
    }
    if (notes) extraLines.push(`Notities: ${notes}`);

    const address = [joinedAddress, ...extraLines].filter(Boolean).join("\n");

    const parsed = clientCreateSchema.safeParse({
      type: flowType,
      name,
      email,
      phone,
      address
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
    redirect(`/clients?created=${created.id}&name=${encodeURIComponent(created.name)}`);
  }

  async function archiveClientAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "CLIENT", "DELETE")) {
      throw new Error("FORBIDDEN");
    }

    const id = String(formData.get("id") || "");
    const before = await prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!before) {
      return;
    }

    const updated = await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });

    await writeAuditLog({
      actorUserId: currentUser.id,
      entityType: AuditEntityType.CLIENT,
      entityId: id,
      action: AuditAction.DELETE,
      before,
      after: updated
    });

    revalidatePath("/clients");
  }

  const canCreate = hasPermission(user.role, "CLIENT", "CREATE");
  const canDelete = hasPermission(user.role, "CLIENT", "DELETE");
  const newType = searchParams.type === "company" ? "company" : searchParams.type === "person" ? "person" : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">Cliënten</h1>
          <p className="mt-1 text-base text-slate-500">{clients.length} cliënten</p>
        </div>
        {canCreate ? (
          <Link href="/clients?new=1" className="ld-btn-primary">+ Nieuwe cliënt</Link>
        ) : null}
      </div>

      <form className="ld-panel p-2" action="/clients" method="get">
        <input name="q" defaultValue={q} placeholder="Zoek op naam, email of bedrijf..." className="ld-input border-0" />
      </form>

      <div className="ld-panel overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-5 py-4">Naam</th>
              <th className="px-5 py-4">Contact</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Stad</th>
              <th className="px-5 py-4">Acties</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-t border-slate-200 text-sm">
                <td className="px-5 py-4">
                  <Link href={`/clients/${client.id}`} className="font-bold text-[#1f45b2] hover:underline">
                    {client.name}
                  </Link>
                </td>
                <td className="px-5 py-4">
                  <p>{client.email || "-"}</p>
                  <p className="text-slate-500">{client.phone || "-"}</p>
                </td>
                <td className="px-5 py-4">{typeBadge(client.type)}</td>
                <td className="px-5 py-4">{extractCity(client.address)}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/clients/${client.id}`} className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300">
                      Bewerken
                    </Link>
                    {canDelete ? (
                      <form action={archiveClientAction}>
                        <input type="hidden" name="id" value={client.id} />
                        <button type="submit" className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">
                          Verwijder
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {searchParams.created ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-7 text-center shadow-2xl">
            <p className="mb-3 text-5xl text-emerald-600">✓</p>
            <h2 className="text-3xl font-extrabold text-slate-800">Cliënt aangemaakt</h2>
            <p className="mt-2 text-base text-slate-500">{searchParams.name} is succesvol toegevoegd.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/clients" className="ld-btn-secondary">Sluiten</Link>
              <Link href={`/dossiers?new=1&clientId=${searchParams.created}`} className="ld-btn-primary">
                📁 Dossier aanmaken
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {searchParams.new === "1" && canCreate ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-6">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-extrabold text-slate-800">Nieuwe cliënt</h2>

            {!newType ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link href="/clients?new=1&type=person" className="rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50">
                  <p className="text-base font-bold text-slate-800">Particulier</p>
                  <p className="mt-1 text-sm text-slate-500">Maak een privépersoon aan</p>
                </Link>
                <Link href="/clients?new=1&type=company" className="rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50">
                  <p className="text-base font-bold text-slate-800">Bedrijf</p>
                  <p className="mt-1 text-sm text-slate-500">Maak een onderneming aan met BTW en contactpersoon</p>
                </Link>
                <div className="sm:col-span-2 flex justify-end">
                  <Link href="/clients" className="ld-btn-secondary">Annuleren</Link>
                </div>
              </div>
            ) : (
              <form action={createClientAction} className="mt-5 space-y-4">
                <input type="hidden" name="flowType" value={newType === "company" ? "COMPANY" : "PERSON"} />

                {newType === "person" ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Voornaam *</label>
                        <input name="firstName" className="ld-input" required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Naam *</label>
                        <input name="lastName" className="ld-input" required />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">Bedrijfsnaam *</label>
                      <input name="companyName" className="ld-input" required />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">BTW-nummer *</label>
                        <input name="vatNumber" className="ld-input" required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Ondernemingsnummer</label>
                        <input name="companyNumber" className="ld-input" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="mb-3 text-sm font-semibold text-slate-600">Contactpersoon binnen het bedrijf</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700">Voornaam *</label>
                          <input name="contactFirstName" className="ld-input" required />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700">Naam *</label>
                          <input name="contactLastName" className="ld-input" required />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Email *</label>
                        <input name="contactEmail" type="email" className="ld-input" required />
                      </div>
                    </div>
                  </>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                    <input name="email" type="email" className="ld-input" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Telefoon</label>
                    <input name="phone" className="ld-input" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Adres</label>
                  <input name="address" className="ld-input" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Postcode</label>
                    <input name="postcode" className="ld-input" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Stad</label>
                    <input name="city" className="ld-input" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Notities</label>
                  <textarea name="notes" rows={3} className="ld-input" />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Link href="/clients?new=1" className="ld-btn-secondary">Vorige</Link>
                  <button type="submit" className="ld-btn-primary">Toevoegen</button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
