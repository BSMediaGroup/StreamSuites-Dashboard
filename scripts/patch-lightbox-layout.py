from pathlib import Path

css = Path(__file__).resolve().parents[1] / "docs" / "css" / "components.css"
t = css.read_text(encoding="utf-8")

old = """.ss-economy-item-detail-modal {
  position: fixed;
  inset: 0;
  z-index: 1004;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(2, 6, 13, 0.78);
  backdrop-filter: blur(14px);
}

.ss-economy-item-detail-dialog {
  position: relative;
  width: min(1100px, 100%);
  max-height: calc(100vh - 44px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-columns: minmax(280px, 0.88fr) minmax(0, 1.12fr);
  gap: 22px;
  overflow: auto;
  border: 1px solid rgba(132, 184, 255, 0.28);
  border-radius: 12px;
  background:
    linear-gradient(145deg, rgba(19, 30, 49, 0.98), rgba(6, 11, 21, 0.98)),
    #08101d;
  box-shadow: 0 30px 96px rgba(0, 0, 0, 0.56);
  padding: 24px;
}"""

new = """.ss-economy-item-detail-modal {
  position: fixed;
  inset: 0;
  z-index: 1004;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 6, 13, 0.78);
  backdrop-filter: blur(14px);
}

.ss-economy-item-detail-dialog {
  position: relative;
  width: min(1360px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-columns: minmax(300px, 0.8fr) minmax(0, 1.2fr);
  gap: 24px;
  overflow: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(118, 134, 161, 0.66) rgba(8, 12, 18, 0.85);
  border: 1px solid rgba(132, 184, 255, 0.28);
  border-radius: 12px;
  background:
    linear-gradient(145deg, rgba(19, 30, 49, 0.98), rgba(6, 11, 21, 0.98)),
    #08101d;
  box-shadow: 0 30px 96px rgba(0, 0, 0, 0.56);
  padding: 24px;
}

.ss-economy-item-detail-dialog::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.ss-economy-item-detail-dialog::-webkit-scrollbar-track {
  background: rgba(8, 12, 18, 0.85);
  border-radius: 999px;
}

.ss-economy-item-detail-dialog::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(118, 134, 161, 0.66);
}

.ss-economy-item-detail-dialog::-webkit-scrollbar-thumb:hover {
  background: rgba(146, 164, 194, 0.82);
}"""

if old not in t:
    raise SystemExit("dashboard block missing")
css.write_text(t.replace(old, new, 1), encoding="utf-8")
print("dashboard css ok")