import { AuditAction, AuditEntityType } from "@prisma/client";
import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { documentUpdateSchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user.role, "DOCUMENT", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const document = await prisma.document.findUnique({ where: { id: params.id } });
  if (!document) {
    return jsonError("Document not found", 404);
  }

  return Response.json(document);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user.role, "DOCUMENT", "UPDATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, documentUpdateSchema);
  if (parsed.error) return parsed.error;

  const before = await prisma.document.findUnique({ where: { id: params.id } });
  if (!before) {
    return jsonError("Document not found", 404);
  }

  const updated = await prisma.document.update({
    where: { id: params.id },
    data: parsed.data
  });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.DOCUMENT,
    entityId: params.id,
    action: AuditAction.UPDATE,
    before,
    after: updated
  });

  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user.role, "DOCUMENT", "DELETE")) {
    return jsonError("Forbidden", 403);
  }

  const before = await prisma.document.findUnique({ where: { id: params.id } });
  if (!before) {
    return jsonError("Document not found", 404);
  }

  await prisma.document.delete({ where: { id: params.id } });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.DOCUMENT,
    entityId: params.id,
    action: AuditAction.DELETE,
    before
  });

  return Response.json({ success: true });
}
