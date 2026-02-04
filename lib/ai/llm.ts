import { MockLLMClient } from "@/lib/ai/providers/mock";
import { OpenAILLMClient } from "@/lib/ai/providers/openai";

export interface LLMClient {
  generate(system: string, user: string): Promise<string>;
}

export function getLLMClient(): LLMClient {
  if (process.env.OPENAI_API_KEY) {
    return new OpenAILLMClient();
  }

  return new MockLLMClient();
}
