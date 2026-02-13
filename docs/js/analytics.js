/* ============================================================
   StreamSuites Dashboard - Analytics view scaffold
   ============================================================ */

(() => {
  "use strict";

  const DEFAULT_MAP_STYLE_URL =
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  const SOURCE_ID = "ss-analytics-points";
  const HALO_LAYER_ID = "ss-analytics-points-halo";
  const CORE_LAYER_ID = "ss-analytics-points-core";

  const state = {
    map: null,
    mapReady: false,
    mapEl: null,
    feedbackEl: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function resolveMapStyleUrl() {
    const override = window.SS_ANALYTICS_MAP_STYLE_URL;
    if (typeof override === "string" && override.trim()) {
      return override.trim();
    }
    return DEFAULT_MAP_STYLE_URL;
  }

  function buildPlaceholderGeoJson() {
    return {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { count: 280, label: "US East" }, geometry: { type: "Point", coordinates: [-74.0, 40.7] } },
        { type: "Feature", properties: { count: 190, label: "US West" }, geometry: { type: "Point", coordinates: [-118.2, 34.0] } },
        { type: "Feature", properties: { count: 126, label: "London" }, geometry: { type: "Point", coordinates: [-0.1, 51.5] } },
        { type: "Feature", properties: { count: 88, label: "Sao Paulo" }, geometry: { type: "Point", coordinates: [-46.6, -23.5] } },
        { type: "Feature", properties: { count: 74, label: "Lagos" }, geometry: { type: "Point", coordinates: [3.4, 6.5] } },
        { type: "Feature", properties: { count: 110, label: "Mumbai" }, geometry: { type: "Point", coordinates: [72.8, 19.1] } },
        { type: "Feature", properties: { count: 98, label: "Singapore" }, geometry: { type: "Point", coordinates: [103.8, 1.3] } },
        { type: "Feature", properties: { count: 142, label: "Tokyo" }, geometry: { type: "Point", coordinates: [139.7, 35.7] } },
        { type: "Feature", properties: { count: 63, label: "Sydney" }, geometry: { type: "Point", coordinates: [151.2, -33.8] } }
      ]
    };
  }

  function setMapFeedback(message) {
    if (!state.feedbackEl) return;
    const text = String(message || "").trim();
    if (!text) {
      state.feedbackEl.textContent = "";
      state.feedbackEl.classList.add("hidden");
      state.mapEl?.classList.remove("is-error");
      return;
    }
    state.feedbackEl.textContent = text;
    state.feedbackEl.classList.remove("hidden");
    state.mapEl?.classList.add("is-error");
  }

  function addPlaceholderLayers() {
    if (!state.map) return;

    const map = state.map;
    const payload = buildPlaceholderGeoJson();

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: payload
      });
    } else {
      map.getSource(SOURCE_ID).setData(payload);
    }

    if (!map.getLayer(HALO_LAYER_ID)) {
      map.addLayer({
        id: HALO_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": "#4db8ff",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            40, 14,
            120, 24,
            300, 36
          ],
          "circle-opacity": 0.2,
          "circle-blur": 0.7
        }
      });
    }

    if (!map.getLayer(CORE_LAYER_ID)) {
      map.addLayer({
        id: CORE_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": "#9be7ff",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            40, 4,
            120, 7,
            300, 12
          ],
          "circle-opacity": 0.92,
          "circle-stroke-color": "rgba(255,255,255,0.75)",
          "circle-stroke-width": 0.8
        }
      });
    }
  }

  function setPointData(geojson) {
    if (!state.map) return false;
    const source = state.map.getSource(SOURCE_ID);
    if (!source) return false;
    source.setData(geojson);
    return true;
  }

  function initMap() {
    if (!state.mapEl || !state.feedbackEl) return;

    if (!window.maplibregl || typeof window.maplibregl.Map !== "function") {
      setMapFeedback("Map preview unavailable: Map library failed to load.");
      return;
    }

    setMapFeedback("");

    try {
      state.map = new window.maplibregl.Map({
        container: state.mapEl,
        style: resolveMapStyleUrl(),
        center: [10, 20],
        zoom: 1.15,
        minZoom: 1,
        maxZoom: 5,
        projection: "mercator",
        attributionControl: false,
        pitch: 0,
        bearing: 0,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false
      });
    } catch (err) {
      setMapFeedback("Map preview unavailable: unable to initialize renderer.");
      return;
    }

    state.map.dragRotate?.disable();
    state.map.touchZoomRotate?.disableRotation();
    state.map.keyboard?.disableRotation();
    state.map.addControl(
      new window.maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      "top-right"
    );

    state.map.on("error", (event) => {
      if (state.mapReady) return;
      const detail =
        event?.error?.message ||
        event?.error?.statusText ||
        "style or tiles failed to load.";
      setMapFeedback(`Map preview unavailable: ${detail}`);
    });

    state.map.once("load", () => {
      state.mapReady = true;
      setMapFeedback("");
      addPlaceholderLayers();
    });
  }

  function init() {
    state.mapEl = $("analytics-world-map");
    state.feedbackEl = $("analytics-map-feedback");
    state.mapReady = false;

    initMap();
  }

  function destroy() {
    if (state.map) {
      state.map.remove();
      state.map = null;
    }
    state.mapReady = false;
    state.mapEl = null;
    state.feedbackEl = null;
  }

  window.AnalyticsView = {
    init,
    destroy,
    setPointData
  };
})();
