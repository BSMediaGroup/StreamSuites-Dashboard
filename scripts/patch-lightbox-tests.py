from pathlib import Path

p = Path(__file__).resolve().parents[1] / "tests" / "economy-admin-controls.test.mjs"
t = p.read_text(encoding="utf-8")
t = t.replace(
    '  assert.match(css, /\\.ss-economy-item-detail-dialog\\s*\\{[\\s\\S]*grid-template-columns:\\s*minmax\\(280px, 0\\.88fr\\) minmax\\(0, 1\\.12fr\\)/);',
    '  assert.match(css, /\\.ss-economy-item-detail-dialog\\s*\\{[\\s\\S]*width:\\s*min\\(1360px, calc\\(100vw - 32px\\)\\)/);\n  assert.match(css, /\\.ss-economy-item-detail-dialog\\s*\\{[\\s\\S]*grid-template-columns:\\s*minmax\\(300px, 0\\.8fr\\) minmax\\(0, 1\\.2fr\\)/);\n  assert.match(css, /\\.ss-economy-item-detail-dialog\\s*\\{[\\s\\S]*scrollbar-width:\\s*thin/);\n  assert.match(css, /\\.ss-economy-item-detail-dialog::-webkit-scrollbar-thumb\\s*\\{/);',
    1,
)
p.write_text(t, encoding="utf-8")
print("dashboard tests ok")