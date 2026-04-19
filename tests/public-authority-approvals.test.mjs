import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("approvals view includes public authority review controls", () => {
  const html = read("docs/views/approvals.html");
  assert.match(html, /Public Authority Review/);
  assert.match(html, /approvals-refresh-authority/);
  assert.match(html, /approvals-authority-status-filter/);
  assert.match(html, /approvals-authority-type-filter/);
  assert.match(html, /approvals-authority-list/);
  assert.match(html, /suppresses public visibility rather than[\s\S]*deleting records/i);
});

test("approvals controller uses the runtime public authority list and patch contract", () => {
  const js = read("docs/js/approvals.js");
  assert.match(js, /AUTHORITY_LIST = "\/api\/admin\/public\/authority\/requests\?status=all"/);
  assert.match(js, /AUTHORITY_UPDATE = \(id\) => `\/api\/admin\/public\/authority\/requests\/\$\{encodeURIComponent\(id\)\}`/);
  assert.match(js, /normalizeAuthorityRequest/);
  assert.match(js, /mutateAuthority/);
  assert.match(js, /resolution_metadata:\s*\{\s*operator_surface:\s*"admin_dashboard"/);
  assert.match(js, /request_removal/);
  assert.match(js, /assign_to_profile/);
  assert.match(js, /claim_profile/);
});
