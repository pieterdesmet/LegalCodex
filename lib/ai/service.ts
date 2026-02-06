import { AITrigger } from "@prisma/client";
import { buildDossierContext } from "@/lib/ai/context-builder";
import { getLLMClient } from "@/lib/ai/llm";
import {
  dossierAgentSystemPrompt,
  documentAgentSystemPrompt,
  planningAgentSystemPrompt
} from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";
import { aiOutputSchema } from "@/lib/validators";

export type AIAgentAction = "SUMMARY" | "SUGGEST_TASKS" | "REVIEW_LATEST_DOC" | "DEADLINE_SCAN" | "DASHBOARD_BRIEFING";

function buildSystemPrompt(action: AIAgentAction) {
  switch (action) {
    case "REVIEW_LATEST_DOC":
      return documentAgentSystemPrompt;
    case "DEADLINE_SCAN":
      return planningAgentSystemPrompt;
    case "DASHBOARD_BRIEFING":
      return dossierAgentSystemPrompt;
    default:
      return dossierAgentSystemPrompt;
  }
}

function toTrigger(action: AIAgentAction): AITrigger {
  switch (action) {
    case "SUMMARY":
      return AITrigger.SUMMARY;
    case "SUGGEST_TASKS":
      return AITrigger.SUGGEST_TASKS;
    case "REVIEW_LATEST_DOC":
      return AITrigger.REVIEW_LATEST_DOC;
    case "DEADLINE_SCAN":
      return AITrigger.DEADLINE_SCAN;
    case "DASHBOARD_BRIEFING":
      return AITrigger.DASHBOARD_BRIEFING;
  }
}

async function parseAIOutput(raw: string) {
  try {
    const json = JSON.parse(raw);
    return aiOutputSchema.parse(json);
  } catch {
    return null;
  }
}

export async function runAIAgent(params: {
  dossierId: string;
  action: AIAgentAction;
  userId: string;
  documentId?: string;
}) {
  const { context, serializedContext } = await buildDossierContext(params.dossierId);
  const llm = getLLMClient();
  const system = buildSystemPrompt(params.action);

  const baseInstruction = [
    `Action: ${params.action}`,
    params.documentId ? `Focus documentId: ${params.documentId}` : "",
    "Return strict JSON only that matches the schema exactly.",
    serializedContext
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    let raw = await llm.generate(system, baseInstruction);
    let parsed = await parseAIOutput(raw);

    if (!parsed) {
      raw = await llm.generate(system, `${baseInstruction}\n\nReturn valid JSON only. No markdown.`);
      parsed = await parseAIOutput(raw);
    }

    if (!parsed) {
      throw new Error("AI_INVALID_JSON");
    }

    const aiEvent = await prisma.aIEvent.create({
      data: {
        dossierId: params.dossierId,
        trigger: toTrigger(params.action),
        inputSummary: `${params.action} by user ${params.userId} for dossier ${context.dossier.title}`,
        outputJson: JSON.stringify(parsed),
        confidence: parsed.confidence
      }
    });

    return { aiEvent, output: parsed };
  } catch (error) {
    await prisma.aIEvent.create({
      data: {
        dossierId: params.dossierId,
        trigger: toTrigger(params.action),
        inputSummary: `${params.action} by user ${params.userId} for dossier ${context.dossier.title}`,
        outputJson: JSON.stringify({ error: error instanceof Error ? error.message : "AI_FAILURE" }),
        confidence: 0
      }
    });

    throw error;
  }
}
