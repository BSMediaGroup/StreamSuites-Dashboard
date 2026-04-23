import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("rumble integrations page renders challenge and authenticated-session posture", () => {
  const rumbleJs = read("docs/js/platforms/rumble.js");
  const rumbleHtml = read("docs/views/platforms/rumble.html");

  assert.match(rumbleHtml, /Raw Runtime Debug/);
  assert.match(rumbleJs, /Challenge \/ Interstitial Classification/);
  assert.match(rumbleJs, /Authenticated Session Posture/);
  assert.match(rumbleJs, /Sample Path vs Session-Backed Path/);
  assert.match(rumbleJs, /challenge_classification/);
  assert.match(rumbleJs, /authenticated_session_posture/);
  assert.match(rumbleJs, /session_backed_attempted/);
  assert.match(rumbleJs, /cookie_material_present/);
  assert.match(rumbleJs, /selected_material_type/);
  assert.match(rumbleJs, /validation_errors/);
  assert.match(rumbleJs, /secret_last_updated_at/);
  assert.match(rumbleJs, /likely_pre_parse_block/);
  assert.match(rumbleJs, /expected_content_type/);
  assert.match(rumbleJs, /observed_content_type/);
});

test("rumble raw debug and request chain include additive response-shape fields", () => {
  const rumbleJs = read("docs/js/platforms/rumble.js");

  assert.match(rumbleJs, /Response Shape/);
  assert.match(rumbleJs, /formatJson\(responseShape\)/);
  assert.match(rumbleJs, /Challenge:/);
  assert.match(rumbleJs, /Pre-parse block:/);
  assert.match(rumbleJs, /Session-backed:/);
  assert.match(rumbleJs, /Auth probe:/);
  assert.match(rumbleJs, /Authenticated mode changed result/);
  assert.match(rumbleJs, /No runtime-backed debug object is currently exported/);
  assert.doesNotMatch(rumbleJs, /request_headers\"\\s*:\\s*\\{[^}]*Cookie/);
});
