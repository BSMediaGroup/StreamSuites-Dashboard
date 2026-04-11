import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("admin notifications hydrate and mutate through the runtime contract instead of local read-id storage", () => {
  const js = read("docs/js/notifications.js");
  const html = read("docs/views/notifications.html");

  assert.match(js, /const NOTIFICATIONS_ENDPOINT_PATH = "\/api\/admin\/notifications";/);
  assert.match(js, /method:\s*"PATCH"/);
  assert.match(js, /await loadNotifications\(\{ showLoader: false \}\);/);
  assert.doesNotMatch(js, /READ_IDS_STORAGE_KEY/);
  assert.doesNotMatch(js, /persistReadIds/);
  assert.match(html, /runtime notification contract for the signed-in operator/);
});
