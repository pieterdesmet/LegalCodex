import { AuditAction, AuditEntityType } from "@prisma/client";
import { parseBody, requireApiUser, jsonError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { clientCreateSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }

  if (!hasPermission(auth.user.role, "CLIENT", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" }
  });

  return Response.json(clients);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }

  if (!hasPermission(auth.user.role, "CLIENT", "CREATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, clientCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const created = await prisma.client.create({
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
    entityId: created.id,
    action: AuditAction.CREATE,
    after: created
  });

  return Response.json(created, { status: 201 });
}
