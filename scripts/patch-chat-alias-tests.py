from pathlib import Path

p = Path(__file__).resolve().parents[1] / "tests" / "economy-admin-controls.test.mjs"
t = p.read_text(encoding="utf-8")
needle = '  assert.match(js, /variant: "item-code"/);\n'
insert = needle + """  assert.match(js, /label === "Item code" \\|\\| label === "Chat alias"/);
  assert.match(js, /addMeta\\("Item code", code\\);[\\s\\S]*addMeta\\("Chat alias"/);
  assert.match(js, /addMeta\\("Chat alias", firstPresent\\(item\\.chat_alias[\\s\\S]*\\{ always: true \\}\\)/);
"""
if 'label === "Item code" \\|\\| label === "Chat alias"' not in t:
    # insert after first variant item-code in item detail test block (~753)
    t = t.replace(needle, insert, 1)
    p.write_text(t, encoding="utf-8")
print("dashboard tests ok")