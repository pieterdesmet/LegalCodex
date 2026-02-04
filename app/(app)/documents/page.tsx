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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Documents & Templates</h1>

      {hasPermission(user.role, "TEMPLATE", "CREATE") ? (
        <form action={createTemplateAction} className="grid gap-3 rounded border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input name="name" placeholder="Template name" required className="rounded border border-slate-300 px-2 py-2 text-sm" />
            <input name="type" placeholder="Type (LETTER/CONTRACT/...)" required className="rounded border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <textarea
            name="body"
            rows={4}
            required
            placeholder="Use placeholders like {{client.name}} and {{dossier.title}}"
            className="rounded border border-slate-300 px-2 py-2 text-sm"
          />
          <button type="submit" className="w-fit rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            Create template
          </button>
        </form>
      ) : null}

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Templates</h2>
        <ul className="space-y-2">
          {templates.length === 0 ? (
            <li className="text-sm text-slate-500">No templates yet.</li>
          ) : (
            templates.map((template) => (
              <li key={template.id} className="rounded border border-slate-100 p-3 text-sm">
                <p className="font-medium">{template.name}</p>
                <p className="text-xs text-slate-500">{template.type}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">All Documents</h2>
        <ul className="space-y-2">
          {documents.length === 0 ? (
            <li className="text-sm text-slate-500">No documents yet.</li>
          ) : (
            documents.map((document) => (
              <li key={document.id} className="rounded border border-slate-100 p-3 text-sm">
                <p className="font-medium">{document.title}</p>
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
