import assert from "node:assert/strict";
import test from "node:test";
import { MockLLMClient } from "@/lib/ai/providers/mock";
import { aiOutputSchema } from "@/lib/validators";

test("mock LLM returns schema-valid JSON", async () => {
  const mock = new MockLLMClient();
  const raw = await mock.generate("system", "deadline check");
  const parsed = aiOutputSchema.parse(JSON.parse(raw));

  assert.equal(typeof parsed.summary, "string");
  assert.equal(parsed.proposedTasks.length > 0, true);
  assert.equal(parsed.confidence >= 0 && parsed.confidence <= 1, true);

  for (const risk of parsed.risks) {
    assert.equal(Array.isArray(risk.sourceRefs), true);
  }
});
