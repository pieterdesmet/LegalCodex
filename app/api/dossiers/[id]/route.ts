import { AuditAction, AuditEntityType } from "@prisma/client";
import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { dossierUpdateSchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user.role, "DOSSIER", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const dossier = await prisma.dossier.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      client: true,
      owner: true,
      tasks: true,
      documents: true,
      timeEntries: true
    }
  });

  if (!dossier) {
    return jsonError("Dossier not found", 404);
  }

  return Response.json(dossier);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user.role, "DOSSIER", "UPDATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, dossierUpdateSchema);
  if (parsed.error) return parsed.error;

  const before = await prisma.dossier.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!before) {
    return jsonError("Dossier not found", 404);
  }

  const updated = await prisma.dossier.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      summary: parsed.data.summary || null,
      aiContext: parsed.data.aiContext || null
    }
  });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.DOSSIER,
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
  if (!hasPermission(auth.user.role, "DOSSIER", "DELETE")) {
    return jsonError("Forbidden", 403);
  }

  const before = await prisma.dossier.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!before) {
    return jsonError("Dossier not found", 404);
  }

  const updated = await prisma.dossier.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.DOSSIER,
    entityId: params.id,
    action: AuditAction.DELETE,
    before,
    after: updated
  });

  return Response.json({ success: true });
}
