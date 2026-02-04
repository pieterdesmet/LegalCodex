import { AuditAction, AuditEntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditPayload = {
  actorUserId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
};

export async function writeAuditLog(payload: AuditPayload) {
  await prisma.auditLog.create({
    data: {
      actorUserId: payload.actorUserId ?? null,
      entityType: payload.entityType,
      entityId: payload.entityId,
      action: payload.action,
      beforeJson: payload.before ? JSON.stringify(payload.before) : null,
      afterJson: payload.after ? JSON.stringify(payload.after) : null
    }
  });
}
