import { AuditAction, AuditEntityType, DocumentSource } from "@prisma/client";
import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { renderTemplate } from "@/lib/templates";
import { documentCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }
  if (!hasPermission(auth.user.role, "DOCUMENT", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const url = new URL(request.url);
  const dossierId = url.searchParams.get("dossierId");

  const documents = await prisma.document.findMany({
    where: {
      dossierId: dossierId ?? undefined,
      dossier: { deletedAt: null }
    },
    orderBy: { createdAt: "desc" }
  });

  return Response.json(documents);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }
  if (!hasPermission(auth.user.role, "DOCUMENT", "CREATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, documentCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }

  let content = parsed.data.content ?? "";
  let source = parsed.data.source ?? DocumentSource.UPLOAD;

  if (parsed.data.templateId) {
    const [template, dossier] = await Promise.all([
      prisma.template.findUnique({ where: { id: parsed.data.templateId } }),
      prisma.dossier.findUnique({ where: { id: parsed.data.dossierId }, include: { client: true } })
    ]);

    if (!dossier) {
      return jsonError("Dossier not found", 404);
    }

    if (template) {
      content = renderTemplate(template.body, {
        "client.name": dossier.client.name,
        "dossier.title": dossier.title,
        "user.name": auth.user.name
      });
      source = DocumentSource.TEMPLATE;
    }
  }

  if (!content.trim()) {
    return jsonError("Content is required", 422);
  }

  const created = await prisma.document.create({
    data: {
      dossierId: parsed.data.dossierId,
      type: parsed.data.type,
      title: parsed.data.title,
      content,
      source,
      version: parsed.data.version ?? 1
    }
  });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.DOCUMENT,
    entityId: created.id,
    action: AuditAction.CREATE,
    after: created
  });

  return Response.json(created, { status: 201 });
}
