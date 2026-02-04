import { AuditAction, AuditEntityType } from "@prisma/client";
import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { templateCreateSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }
  if (!hasPermission(auth.user.role, "TEMPLATE", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json(templates);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }
  if (!hasPermission(auth.user.role, "TEMPLATE", "CREATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, templateCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const created = await prisma.template.create({ data: parsed.data });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.TEMPLATE,
    entityId: created.id,
    action: AuditAction.CREATE,
    after: created
  });

  return Response.json(created, { status: 201 });
}
