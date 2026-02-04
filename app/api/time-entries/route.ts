import { AuditAction, AuditEntityType } from "@prisma/client";
import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { timeEntryCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }
  if (!hasPermission(auth.user.role, "TIME_ENTRY", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const url = new URL(request.url);
  const dossierId = url.searchParams.get("dossierId");

  const entries = await prisma.timeEntry.findMany({
    where: {
      dossierId: dossierId ?? undefined,
      dossier: { deletedAt: null }
    },
    include: { user: true },
    orderBy: { createdAt: "desc" }
  });

  return Response.json(entries);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }
  if (!hasPermission(auth.user.role, "TIME_ENTRY", "CREATE")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, timeEntryCreateSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const created = await prisma.timeEntry.create({
    data: {
      dossierId: parsed.data.dossierId,
      userId: auth.user.id,
      startAt: new Date(parsed.data.startAt),
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
      description: parsed.data.description,
      autoCaptured: parsed.data.autoCaptured ?? false
    }
  });

  await writeAuditLog({
    actorUserId: auth.user.id,
    entityType: AuditEntityType.TIME_ENTRY,
    entityId: created.id,
    action: AuditAction.CREATE,
    after: created
  });

  return Response.json(created, { status: 201 });
}
