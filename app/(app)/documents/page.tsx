import { revalidatePath } from "next/cache";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { templateCreateSchema } from "@/lib/validators";

export default async function DocumentsPage() {
  const user = await requireUser();

  const [documents, templates] = await Promise.all([
    prisma.document.findMany({
      where: { dossier: { deletedAt: null } },
      include: { dossier: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.template.findMany({ orderBy: { createdAt: "desc" } })
  ]);

  async function createTemplateAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "TEMPLATE", "CREATE")) {
      throw new Error("FORBIDDEN");
    }

    const parsed = templateCreateSchema.safeParse({
      name: formData.get("name"),
      type: formData.get("type"),
      body: formData.get("body")
    });

    if (!parsed.success) {
      throw new Error("Invalid template data");
    }

    const created = await prisma.template.create({ data: parsed.data });

    await writeAuditLog({
      actorUserId: currentUser.id,
      entityType: AuditEntityType.TEMPLATE,
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created
    });

    revalidatePath("/documents");
  }

  const canCreateTemplate = hasPermission(user.role, "TEMPLATE", "CREATE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ld-page-title">Documenten</h1>
        <p className="mt-1 text-base text-slate-500">{documents.length} documenten · {templates.length} templates</p>
      </div>

      {canCreateTemplate ? (
        <section className="ld-panel p-6">
          <h2 className="text-lg font-bold text-slate-800">Nieuwe template</h2>
          <form action={createTemplateAction} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <input name="name" placeholder="Naam van template" required className="ld-input" />
              <input name="type" placeholder="Type (LETTER/CONTRACT/...)" required className="ld-input" />
            </div>
            <textarea
              name="body"
              rows={4}
              required
              placeholder="Gebruik placeholders zoals {{client.name}} en {{dossier.title}}"
              className="ld-input"
            />
            <button type="submit" className="ld-btn-primary w-fit">
              Template aanmaken
            </button>
          </form>
        </section>
      ) : null}

      <section className="ld-panel p-6">
        <h2 className="text-lg font-bold text-slate-800">Templates</h2>
        <ul className="mt-4 space-y-2">
          {templates.length === 0 ? (
            <li className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">Nog geen templates.</li>
          ) : (
            templates.map((template) => (
              <li key={template.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{template.name}</p>
                <p className="text-xs text-slate-500">{template.type}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ld-panel p-6">
        <h2 className="text-lg font-bold text-slate-800">Recente documenten</h2>
        <ul className="mt-4 space-y-2">
          {documents.length === 0 ? (
            <li className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">Nog geen documenten.</li>
          ) : (
            documents.map((document) => (
              <li key={document.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{document.title}</p>
                <p className="text-xs text-slate-500">
                  {document.dossier.title} · {document.type} · {document.source}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
