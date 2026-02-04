import { prisma } from "@/lib/prisma";

export async function buildDossierContext(dossierId: string) {
  const dossier = await prisma.dossier.findFirst({
    where: { id: dossierId, deletedAt: null },
    include: {
      client: true,
      tasks: {
        orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
        take: 20
      },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 5
      },
      timeEntries: {
        orderBy: { createdAt: "desc" },
        take: 5
      }
    }
  });

  if (!dossier) {
    throw new Error("DOSSIER_NOT_FOUND");
  }

  const context = {
    dossier: {
      id: dossier.id,
      title: dossier.title,
      type: dossier.type,
      status: dossier.status,
      summary: dossier.summary,
      aiContext: dossier.aiContext
    },
    client: {
      id: dossier.client.id,
      name: dossier.client.name,
      type: dossier.client.type
    },
    tasks: dossier.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline?.toISOString() ?? null
    })),
    documents: dossier.documents.map((document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      version: document.version,
      createdAt: document.createdAt.toISOString(),
      excerpt: document.content.slice(0, 500)
    })),
    timeEntries: dossier.timeEntries.map((entry) => ({
      id: entry.id,
      description: entry.description,
      startAt: entry.startAt.toISOString(),
      endAt: entry.endAt?.toISOString() ?? null
    }))
  };

  return {
    dossier,
    context,
    serializedContext: JSON.stringify(context, null, 2)
  };
}
