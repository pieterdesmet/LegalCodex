import { jsonError, parseBody, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { runAIAgent } from "@/lib/ai/service";
import { aiAgentRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) {
    return auth.error;
  }

  if (!hasPermission(auth.user.role, "DOSSIER", "READ")) {
    return jsonError("Forbidden", 403);
  }

  const parsed = await parseBody(request, aiAgentRequestSchema);
  if (parsed.error) {
    return parsed.error;
  }

  const dossier = await prisma.dossier.findFirst({
    where: { id: parsed.data.dossierId, deletedAt: null }
  });

  if (!dossier) {
    return jsonError("Dossier not found", 404);
  }

  try {
    const result = await runAIAgent({
      dossierId: parsed.data.dossierId,
      action: parsed.data.action,
      userId: auth.user.id,
      documentId: parsed.data.documentId
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "AI request failed", 500);
  }
}
