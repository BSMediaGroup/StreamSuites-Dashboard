from pathlib import Path

p = Path(__file__).resolve().parents[1] / "tests" / "economy-admin-controls.test.mjs"
t = p.read_text(encoding="utf-8")

old = """  assert.match(css, /\\.ss-economy-exclusion-switch\\s*\\{[\\s\\S]*grid-template-columns:\\s*58px minmax\\(0,\\s*1fr\\)/);
  assert.match(css, /\\.ss-economy-exclusion-switch\\s*\\{[\\s\\S]*overflow:\\s*hidden/);
  assert.match(css, /\\.ss-economy-exclusion-switch \\.switch-button\\s*\\{/);
  assert.match(css, /\\.ss-economy-exclusion-switch \\.switch-scale\\s*\\{[\\s\\S]*transform:\\s*none/);"""

new = """  assert.match(css, /\\.ss-economy-exclusion-switch\\s*\\{[\\s\\S]*grid-template-columns:\\s*60px minmax\\(0,\\s*1fr\\)/);
  assert.match(css, /\\.ss-economy-exclusion-switch\\s*\\{[\\s\\S]*overflow:\\s*visible/);
  assert.match(css, /\\.ss-economy-exclusion-switch \\.switch-button\\s*\\{/);
  assert.match(css, /\\.ss-economy-exclusion-switch \\.switch-scale\\s*\\{[\\s\\S]*transform:\\s*scale\\(0\\.5\\)/);
  assert.match(css, /\\.ss-economy-item-modal-close span\\s*\\{[\\s\\S]*width:\\s*18px[\\s\\S]*-webkit-mask-image:\\s*url\\("\\/assets\\/icons\\/ui\\/cross\\.svg"\\)/);
  assert.match(css, /\\.ss-economy-item-modal-close\\s*\\{[\\s\\S]*color:\\s*#edf5ff/);"""

if old not in t:
    raise SystemExit("test block missing")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("tests patched")