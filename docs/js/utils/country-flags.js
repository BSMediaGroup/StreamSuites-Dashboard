(() => {
  "use strict";

  const FLAG_SVG_BASE = "https://flagcdn.com";

  function normalizeCountryCode(value) {
    const letters = String(value || "")
      .trim()
      .replace(/[^a-z]/gi, "")
      .toUpperCase();
    return /^[A-Z]{2}$/.test(letters) ? letters : "";
  }

  function buildCountryFlagToken(countryCode) {
    const normalized = normalizeCountryCode(countryCode);
    return normalized ? `fl-${normalized.toLowerCase()}` : "";
  }

  function buildPresentation(rawValue, countryCode) {
    const rawText = String(rawValue || "").trim();
    let normalizedCode = normalizeCountryCode(countryCode);
    if (!normalizedCode && /^fl-/i.test(rawText)) {
      normalizedCode = normalizeCountryCode(rawText.slice(3));
    }
    if (!normalizedCode && rawText) {
      normalizedCode = normalizeCountryCode(rawText);
    }

    if (normalizedCode) {
      return {
        rawValue: rawText || normalizedCode,
        renderText: normalizedCode,
        token: buildCountryFlagToken(normalizedCode),
        countryCode: normalizedCode,
        rich: true
      };
    }

    if (!rawText) return null;
    return {
      rawValue: rawText,
      renderText: rawText,
      token: /^fl-/i.test(rawText) ? rawText.toLowerCase() : "",
      countryCode: "",
      rich: false
    };
  }

  function getFlagSvgUrl(countryCode) {
    const normalized = normalizeCountryCode(countryCode);
    return normalized ? `${FLAG_SVG_BASE}/${normalized.toLowerCase()}.svg` : null;
  }

  function createFallbackIconElement(className = "flag-icon flag-icon-fallback") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 12");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", className);

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0.5");
    bg.setAttribute("y", "0.5");
    bg.setAttribute("width", "15");
    bg.setAttribute("height", "11");
    bg.setAttribute("rx", "2");
    bg.setAttribute("fill", "rgba(19, 28, 43, 0.9)");
    bg.setAttribute("stroke", "rgba(149, 183, 218, 0.5)");
    bg.setAttribute("stroke-width", "1");
    svg.appendChild(bg);

    const globe = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    globe.setAttribute("cx", "8");
    globe.setAttribute("cy", "6");
    globe.setAttribute("r", "3");
    globe.setAttribute("fill", "none");
    globe.setAttribute("stroke", "rgba(205, 226, 255, 0.95)");
    globe.setAttribute("stroke-width", "0.9");
    svg.appendChild(globe);

    const lat = document.createElementNS("http://www.w3.org/2000/svg", "path");
    lat.setAttribute("d", "M5.5 6h5");
    lat.setAttribute("fill", "none");
    lat.setAttribute("stroke", "rgba(205, 226, 255, 0.95)");
    lat.setAttribute("stroke-width", "0.8");
    lat.setAttribute("stroke-linecap", "round");
    svg.appendChild(lat);

    const lon = document.createElementNS("http://www.w3.org/2000/svg", "path");
    lon.setAttribute("d", "M8 3.2c-1.1 0-2 1.2-2 2.8s0.9 2.8 2 2.8 2-1.2 2-2.8-0.9-2.8-2-2.8z");
    lon.setAttribute("fill", "none");
    lon.setAttribute("stroke", "rgba(205, 226, 255, 0.95)");
    lon.setAttribute("stroke-width", "0.7");
    lon.setAttribute("stroke-linecap", "round");
    lon.setAttribute("stroke-linejoin", "round");
    svg.appendChild(lon);

    return svg;
  }

  function createFlagVisualNode(countryCode, options = {}) {
    const flagUrl = getFlagSvgUrl(countryCode);
    const imageClassName = String(options.imageClassName || "flag-icon").trim() || "flag-icon";
    const fallbackClassName = String(options.fallbackClassName || `${imageClassName} flag-icon-fallback`).trim();
    if (!flagUrl) {
      return createFallbackIconElement(fallbackClassName);
    }

    const img = document.createElement("img");
    img.className = imageClassName;
    img.decoding = "async";
    if (options.lazy !== false) {
      img.loading = "lazy";
    }
    img.src = flagUrl;
    img.alt = String(options.alt || `${normalizeCountryCode(countryCode)} flag`);
    img.addEventListener(
      "error",
      () => {
        img.replaceWith(createFallbackIconElement(fallbackClassName));
      },
      { once: true }
    );
    return img;
  }

  function renderFlagSlotHtml(countryCode, options = {}) {
    const className = String(options.className || "").trim();
    const slotClass = ["ss-country-flag-slot", className].filter(Boolean).join(" ");
    const normalized = normalizeCountryCode(countryCode);
    return `<span class="${slotClass}" data-ss-country-flag-slot="${normalized}" aria-hidden="true"></span>`;
  }

  function upgradeFlagSlots(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    root.querySelectorAll("[data-ss-country-flag-slot]").forEach((slot) => {
      if (!(slot instanceof HTMLElement)) return;
      if (slot.dataset.ssCountryFlagReady === "true") return;
      slot.dataset.ssCountryFlagReady = "true";
      const code = normalizeCountryCode(slot.dataset.ssCountryFlagSlot || "");
      slot.replaceChildren(
        createFlagVisualNode(code, {
          imageClassName: "ss-country-flag-slot__img",
          fallbackClassName: "ss-country-flag-slot__img flag-icon-fallback",
          alt: code ? `${code} flag` : "Country flag",
          lazy: false
        })
      );
    });
  }

  window.StreamSuitesCountryFlags = {
    buildCountryFlagToken,
    buildPresentation,
    createFallbackIconElement,
    createFlagVisualNode,
    getFlagSvgUrl,
    normalizeCountryCode,
    renderFlagSlotHtml,
    upgradeFlagSlots
  };
})();
