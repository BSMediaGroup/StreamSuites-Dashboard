from pathlib import Path

p = Path(__file__).resolve().parents[1] / "docs" / "js" / "economy.js"
t = p.read_text(encoding="utf-8")

old = """    const addMeta = (label, value, options = {}) => {
      const formatted = options.timestamp ? formatEconomyDetailTimestamp(value) : detailValue(value);
      if (!formatted) return;
      if (label === "Item code") {
        meta.push({ label, value: formatted, variant: "item-code" });
        return;
      }
      meta.push({ label, value: formatted });
    };
    addMeta("Item code", code);
    addMeta("Category / type", category ? categoryDisplayLabel(category) : "");
    addMeta("Rarity / tier", rarity ? formatLabel(rarity) : "");
    addMeta("Chat alias", firstPresent(item.chat_alias, definition.chat_alias, metadata.chat_alias));"""

new = """    const addMeta = (label, value, options = {}) => {
      const formatted = options.timestamp ? formatEconomyDetailTimestamp(value) : detailValue(value);
      if (!formatted && !options.always) return;
      if (label === "Item code" || label === "Chat alias") {
        meta.push({ label, value: formatted || "—", variant: "item-code" });
        return;
      }
      meta.push({ label, value: formatted });
    };
    addMeta("Item code", code);
    addMeta("Chat alias", firstPresent(item.chat_alias, definition.chat_alias, metadata.chat_alias), { always: true });
    addMeta("Category / type", category ? categoryDisplayLabel(category) : "");
    addMeta("Rarity / tier", rarity ? formatLabel(rarity) : "");"""

if old not in t:
    raise SystemExit("dashboard addMeta block missing")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("dashboard ok")