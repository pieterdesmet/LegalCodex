import { AuditAction, AuditEntityType } from "@prisma/client";
import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { timeEntryUpdateSchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user.role, "TIME_ENTRY", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const entry = await prisma.timeEntry.findUnique({ where: { id: params.id } });
  if (!entry) {
    return jsonError("Time entry not found", 404);
  }

  return Response.json(entry);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user.role, "TIME_ENTRY", "UPDATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, timeEntryUpdateSchema);
  if (parsed.error) return parsed.error;

  const before = await prisma.timeEntry.findUnique({ where: { id: params.id } });
  if (!before) {
    return jsonError("Time entry not found", 404);
  }

  const updated = await prisma.timeEntry.update({
    where: { id: params.id },
    data: {
      endAt: parsed.data.endAt
        ? new Date(parsed.data.endAt)
        : parsed.data.endAt === null
          ? null
          : undefined,
      description: parsed.data.description,
      autoCaptured: parsed.data.autoCaptured
    }
  });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.TIME_ENTRY,
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
  if (!hasPermission(auth.user.role, "TIME_ENTRY", "DELETE")) {
    return jsonError("Forbidden", 403);
  }

  const before = await prisma.timeEntry.findUnique({ where: { id: params.id } });
  if (!before) {
    return jsonError("Time entry not found", 404);
  }

  await prisma.timeEntry.delete({ where: { id: params.id } });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.TIME_ENTRY,
    entityId: params.id,
    action: AuditAction.DELETE,
    before
  });

  return Response.json({ success: true });
}
