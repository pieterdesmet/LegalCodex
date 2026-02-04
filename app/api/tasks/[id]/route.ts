import { AuditAction, AuditEntityType } from "@prisma/client";
import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { taskUpdateSchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user.role, "TASK", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) {
    return jsonError("Task not found", 404);
  }

  return Response.json(task);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (!hasPermission(auth.user.role, "TASK", "UPDATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, taskUpdateSchema);
  if (parsed.error) return parsed.error;

  const before = await prisma.task.findUnique({ where: { id: params.id } });
  if (!before) {
    return jsonError("Task not found", 404);
  }

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      description: parsed.data.description || null,
      deadline: parsed.data.deadline
        ? new Date(parsed.data.deadline)
        : parsed.data.deadline === null
          ? null
          : undefined
    }
  });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.TASK,
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
  if (!hasPermission(auth.user.role, "TASK", "DELETE")) {
    return jsonError("Forbidden", 403);
  }

  const before = await prisma.task.findUnique({ where: { id: params.id } });
  if (!before) {
    return jsonError("Task not found", 404);
  }

  await prisma.task.delete({ where: { id: params.id } });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.TASK,
    entityId: params.id,
    action: AuditAction.DELETE,
    before
  });

  return Response.json({ success: true });
}
