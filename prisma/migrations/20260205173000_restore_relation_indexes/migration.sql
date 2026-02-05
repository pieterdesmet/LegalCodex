-- Restore relation indexes that were removed by sync migration.
CREATE INDEX "AIEvent_dossierId_idx" ON "AIEvent" ("dossierId");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog" ("actorUserId");
CREATE INDEX "Document_dossierId_idx" ON "Document" ("dossierId");
CREATE INDEX "Dossier_clientId_idx" ON "Dossier" ("clientId");
CREATE INDEX "Dossier_ownerUserId_idx" ON "Dossier" ("ownerUserId");
CREATE INDEX "Task_dossierId_idx" ON "Task" ("dossierId");
CREATE INDEX "TimeEntry_dossierId_idx" ON "TimeEntry" ("dossierId");
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry" ("userId");
