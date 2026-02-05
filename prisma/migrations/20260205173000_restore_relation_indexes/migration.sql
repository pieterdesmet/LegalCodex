-- Restore relation indexes that were removed by sync migration.
CREATE INDEX IF NOT EXISTS "AIEvent_dossierId_idx" ON "AIEvent" ("dossierId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog" ("actorUserId");
CREATE INDEX IF NOT EXISTS "Document_dossierId_idx" ON "Document" ("dossierId");
CREATE INDEX IF NOT EXISTS "Dossier_clientId_idx" ON "Dossier" ("clientId");
CREATE INDEX IF NOT EXISTS "Dossier_ownerUserId_idx" ON "Dossier" ("ownerUserId");
CREATE INDEX IF NOT EXISTS "Task_dossierId_idx" ON "Task" ("dossierId");
CREATE INDEX IF NOT EXISTS "TimeEntry_dossierId_idx" ON "TimeEntry" ("dossierId");
CREATE INDEX IF NOT EXISTS "TimeEntry_userId_idx" ON "TimeEntry" ("userId");
