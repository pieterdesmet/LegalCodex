import assert from "node:assert/strict";
import test from "node:test";
import { renderTemplate } from "@/lib/templates";

test("template rendering replaces placeholders", () => {
  const output = renderTemplate("Hello {{client.name}} re {{dossier.title}}", {
    "client.name": "Northwind Ventures",
    "dossier.title": "MSA Negotiation"
  });

  assert.equal(output, "Hello Northwind Ventures re MSA Negotiation");
});

test("unknown placeholders become empty strings", () => {
  const output = renderTemplate("Missing={{missing.key}}", {});
  assert.equal(output, "Missing=");
});
