(() => {
  const active = new Map();
  const exitMs = 220;

  function getRegion() {
    let region = document.querySelector("[data-ss-alert-stack='admin']");
    if (region) return region;
    region = document.createElement("div");
    region.className = "ss-alert-stack";
    region.dataset.ssAlertStack = "admin";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "false");
    document.body.appendChild(region);
    return region;
  }

  function dismiss(id) {
    const entry = active.get(id);
    if (!entry) return;
    if (entry.timer) {
      window.clearTimeout(entry.timer);
    }
    active.delete(id);
    entry.node.classList.remove("is-visible");
    entry.node.classList.add("is-leaving");
    window.setTimeout(() => entry.node.remove(), exitMs);
  }

  function show(message, options = {}) {
    const text = String(message || "").trim();
    if (!text) return "";
    const tone = ["success", "info", "warning", "error"].includes(options.tone)
      ? options.tone
      : "info";
    const id = String(options.key || `${tone}:${text}`).trim();
    dismiss(id);

    const node = document.createElement("section");
    node.className = "ss-floating-alert";
    node.dataset.tone = tone;
    node.setAttribute("role", tone === "error" || tone === "warning" ? "alert" : "status");
    node.setAttribute("aria-live", tone === "error" || tone === "warning" ? "assertive" : "polite");

    const title = document.createElement("strong");
    title.className = "ss-floating-alert__title";
    title.textContent = options.title || tone;

    const body = document.createElement("span");
    body.className = "ss-floating-alert__message";
    body.textContent = text;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "ss-floating-alert__dismiss";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";
    close.addEventListener("click", () => dismiss(id));

    node.append(title, body, close);
    getRegion().appendChild(node);
    window.requestAnimationFrame(() => node.classList.add("is-visible"));

    const autoDismissMs = Number.isFinite(options.autoDismissMs)
      ? options.autoDismissMs
      : tone === "error" || tone === "warning"
        ? 6200
        : 3800;
    const timer = autoDismissMs > 0 ? window.setTimeout(() => dismiss(id), autoDismissMs) : 0;
    active.set(id, { node, timer });
    return id;
  }

  function clearAll() {
    Array.from(active.keys()).forEach(dismiss);
  }

  window.StreamSuitesToast = {
    show,
    dismiss,
    clearAll,
    success(message, options = {}) {
      return show(message, { ...options, tone: "success" });
    },
    info(message, options = {}) {
      return show(message, { ...options, tone: "info" });
    },
    warning(message, options = {}) {
      return show(message, { ...options, tone: "warning" });
    },
    error(message, options = {}) {
      return show(message, { ...options, tone: "error" });
    }
  };
})();
