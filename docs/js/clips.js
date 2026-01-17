(() => {
  "use strict";

  const POLL_INTERVAL_MS = 10000;

  const els = {
    refresh: null,
    status: null,
    error: null,
    empty: null,
    tableBody: null,
    exportTime: null,
    totalCount: null
  };

  let pollHandle = null;
  let lastFetchedAt = null;
  let runtimePollingLogged = false;

  function cacheElements() {
    els.refresh = document.getElementById("clips-refresh");
    els.status = document.getElementById("clips-status");
    els.error = document.getElementById("clips-error");
    els.empty = document.getElementById("clips-empty");
    els.tableBody = document.getElementById("clips-tbody");
    els.exportTime = document.getElementById("clips-exported-at");
    els.totalCount = document.getElementById("clips-total");
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value;
  }

  function showError(message) {
    if (!els.error) return;
    els.error.textContent = message;
    els.error.classList.remove("hidden");
  }

  function hideError() {
    if (!els.error) return;
    els.error.classList.add("hidden");
    els.error.textContent = "";
  }

  function clearTable() {
    if (!els.tableBody) return;
    els.tableBody.innerHTML = "";
  }

  function formatTimestamp(value) {
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      return window.StreamSuitesState.formatTimestamp(value) || "—";
    }
    return value || "—";
  }

  function normalizeState(state) {
    if (typeof state !== "string") return { key: "unknown", label: "unknown" };
    const label = state.trim() || "unknown";
    const key = label.toLowerCase();
    return { key, label };
  }

  function buildStateBadge(state) {
    const { key, label } = normalizeState(state);
    const span = document.createElement("span");
    span.className = `clip-state clip-state-${key}`;
    span.textContent = label;
    return span;
  }

  function formatSource(clip) {
    return (
      clip?.source_platform ||
      clip?.platform ||
      clip?.origin_platform ||
      "—"
    );
  }

  function formatClipper(clip) {
    const clipper =
      clip?.clipper || clip?.clipper_username || clip?.user || null;
    const requestedBy =
      clip?.requested_by ||
      clip?.requestedBy ||
      clip?.requested_by_username ||
      clip?.requester ||
      null;
    const requestedPlatform =
      clip?.requested_by_platform ||
      clip?.requested_platform ||
      clip?.requested_source ||
      clip?.source_platform ||
      null;
    const suffix = requestedPlatform ? ` via ${requestedPlatform}` : "";

    if (clipper && requestedBy && requestedBy !== clipper) {
      return `${clipper} (requested by ${requestedBy}${suffix})`;
    }
    if (requestedBy) {
      return `${requestedBy}${suffix}`;
    }
    return clipper || "—";
  }

  function resolveDestinationUrl(clip) {
    const dest = clip?.destination || {};
    return (
      dest.channel_url ||
      dest.url ||
      dest.link ||
      clip?.destination_url ||
      clip?.destination_link ||
      null
    );
  }

  function formatDestination(clip) {
    const dest = clip?.destination || {};
    const platform =
      dest.platform ||
      dest.service ||
      clip?.destination_platform ||
      clip?.target_platform ||
      null;
    const channel =
      dest.channel ||
      dest.channel_name ||
      dest.channel_url ||
      dest.destination ||
      clip?.destination_channel ||
      clip?.channel ||
      null;

    if (!platform && !channel) return "—";
    if (platform && channel) return `${platform} — ${channel}`;
    return platform || channel || "—";
  }

  function renderClips(clips, meta) {
    clearTable();

    if (!Array.isArray(clips) || clips.length === 0) {
      if (els.empty) els.empty.classList.remove("hidden");
      if (els.tableBody && els.tableBody.parentElement) {
        els.tableBody.parentElement.classList.add("hidden");
      }
      setText(els.totalCount, "0");
    } else {
      if (els.empty) els.empty.classList.add("hidden");
      if (els.tableBody && els.tableBody.parentElement) {
        els.tableBody.parentElement.classList.remove("hidden");
      }
      setText(els.totalCount, String(clips.length));

      clips.forEach((clip) => {
        const tr = document.createElement("tr");

        const tdId = document.createElement("td");
        const clipId = clip?.clip_id || clip?.id || null;
        if (clipId) {
          const link = document.createElement("a");
          link.href = `/clips/detail.html?id=${encodeURIComponent(clipId)}`;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = clipId;
          tdId.appendChild(link);
        } else {
          tdId.textContent = "—";
        }
        tr.appendChild(tdId);

        const tdTitle = document.createElement("td");
        tdTitle.textContent = clip?.title || clip?.name || "—";
        tr.appendChild(tdTitle);

        const tdSource = document.createElement("td");
        tdSource.textContent = formatSource(clip);
        tr.appendChild(tdSource);

        const tdClipper = document.createElement("td");
        tdClipper.textContent = formatClipper(clip);
        tr.appendChild(tdClipper);

        const tdState = document.createElement("td");
        tdState.appendChild(buildStateBadge(clip?.state || clip?.status));
        tr.appendChild(tdState);

        const tdCreated = document.createElement("td");
        tdCreated.textContent = formatTimestamp(
          clip?.created_at || clip?.created || clip?.queued_at
        );
        tr.appendChild(tdCreated);

        const tdUpdated = document.createElement("td");
        tdUpdated.textContent = formatTimestamp(
          clip?.updated_at ||
            clip?.last_updated ||
            clip?.finished_at ||
            clip?.published_at
        );
        tr.appendChild(tdUpdated);

        const tdDestination = document.createElement("td");
        const destinationLabel = formatDestination(clip);
        const destinationUrl = resolveDestinationUrl(clip);
        if (destinationUrl) {
          const link = document.createElement("a");
          link.href = destinationUrl;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = destinationLabel;
          tdDestination.appendChild(link);
        } else {
          tdDestination.textContent = destinationLabel;
        }
        tr.appendChild(tdDestination);

        els.tableBody.appendChild(tr);
      });
    }

    const exportedAt =
      meta?.exported_at ||
      meta?.exportedAt ||
      meta?.generated_at ||
      null;

    setText(els.exportTime, exportedAt ? formatTimestamp(exportedAt) : "—");
  }

  async function fetchClips() {
    hideError();

    if (typeof window.StreamSuitesState?.loadStateJson !== "function") {
      showError("Clip snapshot loader is unavailable.");
      return;
    }

    try {
      const data = await window.StreamSuitesState.loadStateJson("clips.json");

      if (!data) {
        showError("No clip snapshot available (clips.json missing).");
        return;
      }

      const clips = Array.isArray(data.clips) ? data.clips : [];
      renderClips(clips, data.meta || {});
      lastFetchedAt = Date.now();
      setStatus(
        `Last updated ${new Date(lastFetchedAt).toLocaleTimeString(undefined, {
          hour12: false
        })}`
      );
    } catch (err) {
      console.error("[Dashboard][Clips]", err);
      showError("Failed to load runtime clip exports.");
    }
  }

  function setStatus(message) {
    setText(els.status, message);
  }

  function startPolling() {
    if (window.__RUNTIME_AVAILABLE__ !== true) {
      if (!runtimePollingLogged) {
        console.info("[Dashboard] Runtime unavailable. Polling disabled.");
        runtimePollingLogged = true;
      }
      return;
    }
    if (pollHandle) return;
    pollHandle = setInterval(fetchClips, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (!pollHandle) return;
    clearInterval(pollHandle);
    pollHandle = null;
  }

  function bindEvents() {
    if (els.refresh) {
      els.refresh.addEventListener("click", () => {
        fetchClips();
      });
    }
  }

  function init() {
    cacheElements();
    bindEvents();
    setStatus(`Polling every ${POLL_INTERVAL_MS / 1000}s`);
    fetchClips();
    startPolling();
  }

  function destroy() {
    stopPolling();
  }

  window.ClipsView = {
    init,
    destroy
  };
})();
