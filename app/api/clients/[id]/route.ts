import { AuditAction, AuditEntityType } from "@prisma/client";
import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { clientUpdateSchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.user.role, "CLIENT", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const client = await prisma.client.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { dossiers: { where: { deletedAt: null } } }
  });

  if (!client) {
    return jsonError("Client not found", 404);
  }

  return Response.json(client);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.user.role, "CLIENT", "UPDATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, clientUpdateSchema);
  if (parsed.error) return parsed.error;

  const before = await prisma.client.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!before) {
    return jsonError("Client not found", 404);
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
    actorUserId: auth.user.id,
    entityType: AuditEntityType.CLIENT,
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

  if (!hasPermission(auth.user.role, "CLIENT", "DELETE")) {
    return jsonError("Forbidden", 403);
  }

  const before = await prisma.client.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!before) {
    return jsonError("Client not found", 404);
  }

  const updated = await prisma.client.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.CLIENT,
    entityId: params.id,
    action: AuditAction.DELETE,
    before,
    after: updated
  });

  return Response.json({ success: true });
}
