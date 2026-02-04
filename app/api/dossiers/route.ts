import { AuditAction, AuditEntityType } from "@prisma/client";
import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { dossierCreateSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }

  if (!hasPermission(auth.user.role, "DOSSIER", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const dossiers = await prisma.dossier.findMany({
    where: { deletedAt: null },
    include: { client: true, owner: true },
    orderBy: { createdAt: "desc" }
  });

  return Response.json(dossiers);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }

  if (!hasPermission(auth.user.role, "DOSSIER", "CREATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, dossierCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const created = await prisma.dossier.create({
    data: {
      ...parsed.data,
      summary: parsed.data.summary || null,
      aiContext: parsed.data.aiContext || null
    }
  });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.DOSSIER,
    entityId: created.id,
    action: AuditAction.CREATE,
    after: created
  });

  return Response.json(created, { status: 201 });
}
