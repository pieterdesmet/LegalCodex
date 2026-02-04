import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission } from "@/lib/rbac";

test("ADMIN has full permissions", () => {
  assert.equal(hasPermission("ADMIN", "CLIENT", "DELETE"), true);
  assert.equal(hasPermission("ADMIN", "DOSSIER", "DELETE"), true);
});

test("LAWYER can delete dossiers and templates", () => {
  assert.equal(hasPermission("LAWYER", "DOSSIER", "DELETE"), true);
  assert.equal(hasPermission("LAWYER", "TEMPLATE", "DELETE"), true);
});

test("STAFF cannot delete clients/dossiers", () => {
  assert.equal(hasPermission("STAFF", "CLIENT", "DELETE"), false);
  assert.equal(hasPermission("STAFF", "DOSSIER", "DELETE"), false);
});

test("STAFF can create practice operations entries", () => {
  assert.equal(hasPermission("STAFF", "TASK", "CREATE"), true);
  assert.equal(hasPermission("STAFF", "DOCUMENT", "CREATE"), true);
  assert.equal(hasPermission("STAFF", "TIME_ENTRY", "CREATE"), true);
});
