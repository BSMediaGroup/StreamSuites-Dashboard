(() => {
  "use strict";

  const GITHUB_PRIMARY_OWNER = "BSMediaGroup";
  const GITHUB_FALLBACK_OWNER = "DanielClancy";
  const UPDATES_CACHE_KEY = "updates_cache_v1";
  const CACHE_VERSION = 1;
  const NO_CACHE_MESSAGE = "No cached update data. Click Refresh to fetch latest commits.";

  const MAX_PATCH_LINES = 200;
  const MAX_PATCH_CHARS = 12000;

  const repositories = [
    {
      key: "runtime",
      repo: "StreamSuites",
      elements: {
        title: "updates-runtime-title",
        author: "updates-runtime-author",
        date: "updates-runtime-date",
        link: "updates-runtime-link",
        sha: "updates-runtime-sha",
        description: "updates-runtime-description",
        diff: "updates-runtime-diff"
      }
    },
    {
      key: "dashboard",
      repo: "StreamSuites-Dashboard",
      elements: {
        title: "updates-dashboard-title",
        author: "updates-dashboard-author",
        date: "updates-dashboard-date",
        link: "updates-dashboard-link",
        sha: "updates-dashboard-sha",
        description: "updates-dashboard-description",
        diff: "updates-dashboard-diff"
      }
    }
  ];

  let abortController = null;
  let refreshButton = null;
  let refreshListenerBound = false;

  function getEl(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = getEl(id);
    if (el) {
      el.textContent = value;
    }
  }

  function setLink(id, href, label) {
    const el = getEl(id);
    if (!el) return;

    if (href) {
      el.href = href;
      el.textContent = label || href;
    } else {
      el.removeAttribute("href");
      el.textContent = label || "Unavailable";
    }
  }

  function formatDate(value) {
    if (!value) return "Unknown";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Unknown";
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      console.warn("[Updates] Failed to format date", e);
      return "Unknown";
    }
  }

  function setCacheMessage(message, isError = false) {
    const cacheMessage = getEl("updates-cache-message");
    if (!cacheMessage) return;
    cacheMessage.textContent = message;
    cacheMessage.classList.toggle("updates-status-error", Boolean(isError));
  }

  function setCacheTimestamp(text) {
    const cacheTimestamp = getEl("updates-cache-timestamp");
    if (!cacheTimestamp) return;
    cacheTimestamp.textContent = text;
  }

  function setRefreshButtonState(isLoading) {
    if (!refreshButton) return;
    refreshButton.disabled = isLoading;
    refreshButton.textContent = isLoading ? "Refreshing…" : "Refresh updates";
  }

  function formatCacheTimestamp(value) {
    if (!value) return "Cache last updated: —";
    return `Cache last updated: ${formatDate(value)}`;
  }

  function loadCachedUpdates() {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(UPDATES_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== CACHE_VERSION) return null;
      return parsed;
    } catch (err) {
      console.warn("[Updates] Unable to read cached data", err);
      return null;
    }
  }

  function persistCachedUpdates(payload) {
    if (typeof localStorage === "undefined") return;
    if (!payload?.runtime || !payload?.dashboard) return;

    const cache = {
      version: CACHE_VERSION,
      timestamp: new Date().toISOString(),
      runtime: payload.runtime,
      dashboard: payload.dashboard
    };

    try {
      localStorage.setItem(UPDATES_CACHE_KEY, JSON.stringify(cache));
      setCacheTimestamp(formatCacheTimestamp(cache.timestamp));
      setCacheMessage("Cache updated from the latest refresh.");
    } catch (err) {
      console.warn("[Updates] Unable to persist cached data", err);
    }
  }

  function setAwaitingRefresh(repoConfig) {
    setText(repoConfig.elements.title, "Awaiting refresh");
    setText(repoConfig.elements.author, "—");
    setText(repoConfig.elements.date, "—");
    setText(repoConfig.elements.sha, "—");
    setLink(repoConfig.elements.link, "#", "Unavailable");

    const desc = getEl(repoConfig.elements.description);
    if (desc) {
      desc.textContent = "No cached data. Click Refresh to fetch latest commits.";
      desc.classList.remove("updates-error");
    }

    const diff = getEl(repoConfig.elements.diff);
    if (diff) {
      diff.innerHTML = `<p class="updates-empty">No cached data for this repository.</p>`;
    }
  }

  function renderCachedCommits(cache) {
    if (!cache) return false;

    const runtimeRepo = repositories.find((repo) => repo.key === "runtime");
    const dashboardRepo = repositories.find((repo) => repo.key === "dashboard");

    let hasData = false;

    if (cache.runtime && runtimeRepo) {
      populateCommit(runtimeRepo.elements, cache.runtime);
      hasData = true;
    } else if (runtimeRepo) {
      setAwaitingRefresh(runtimeRepo);
    }

    if (cache.dashboard && dashboardRepo) {
      populateCommit(dashboardRepo.elements, cache.dashboard);
      hasData = true;
    } else if (dashboardRepo) {
      setAwaitingRefresh(dashboardRepo);
    }

    if (hasData) {
      setCacheMessage("Showing cached data. Click Refresh to fetch the latest commits.");
      setCacheTimestamp(formatCacheTimestamp(cache.timestamp));
    }

    return hasData;
  }

  function renderError(elements, message) {
    setText(elements.title, "Unavailable");
    setText(elements.author, "—");
    setText(elements.date, "—");
    setText(elements.sha, "—");
    setLink(elements.link, "#", "Unavailable");

    const desc = getEl(elements.description);
    if (desc) {
      desc.textContent = message;
      desc.classList.add("updates-error");
    }

    const diff = getEl(elements.diff);
    if (diff) {
      diff.innerHTML = `<p class="updates-error">${message}</p>`;
    }
  }

  async function fetchLatestCommit(repoName, signal) {
    const owners = [GITHUB_PRIMARY_OWNER, GITHUB_FALLBACK_OWNER];
    const attemptErrors = [];

    for (const owner of owners) {
      try {
        const latestUrl = `https://api.github.com/repos/${owner}/${repoName}/commits?per_page=1`;
        const latestRes = await fetch(latestUrl, { signal, cache: "no-store" });
        if (!latestRes.ok) {
          attemptErrors.push(`${owner} (${latestRes.status})`);
          continue;
        }

        const list = await latestRes.json();
        if (!Array.isArray(list) || list.length === 0) {
          attemptErrors.push(`${owner} (empty response)`);
          continue;
        }

        const sha = list[0]?.sha;
        if (!sha) {
          attemptErrors.push(`${owner} (missing sha)`);
          continue;
        }

        const commitUrl = `https://api.github.com/repos/${owner}/${repoName}/commits/${sha}`;
        const commitRes = await fetch(commitUrl, { signal, cache: "no-store" });
        if (!commitRes.ok) {
          attemptErrors.push(`${owner} detail (${commitRes.status})`);
          continue;
        }

        const commitData = await commitRes.json();
        commitData.__owner = owner;
        return commitData;
      } catch (err) {
        if (err?.name === "AbortError") throw err;
        attemptErrors.push(`${owner} (${err?.message || "error"})`);
      }
    }

    throw new Error(`Unable to load commit: ${attemptErrors.join(", ")}`);
  }

  function buildDiffLines(files) {
    if (!Array.isArray(files)) return [];

    const lines = [];

    files.forEach((file) => {
      if (!file?.patch) return;

      lines.push(`diff --git a/${file.filename} b/${file.filename}`);
      lines.push(`--- a/${file.filename}`);
      lines.push(`+++ b/${file.filename}`);

      file.patch.split("\n").forEach((line) => {
        lines.push(line);
      });
    });

    return lines;
  }

  function renderDiffPreview(targetId, files) {
    const container = getEl(targetId);
    if (!container) return;

    container.innerHTML = "";
    const lines = buildDiffLines(files);

    if (!lines.length) {
      container.innerHTML = `<p class="updates-empty">No diff preview available for this commit.</p>`;
      return;
    }

    let truncated = false;
    let content = lines.join("\n");

    if (content.length > MAX_PATCH_CHARS) {
      content = content.slice(0, MAX_PATCH_CHARS);
      truncated = true;
    }

    let renderedLines = content.split("\n");
    if (renderedLines.length > MAX_PATCH_LINES) {
      renderedLines = renderedLines.slice(0, MAX_PATCH_LINES);
      truncated = true;
    }

    const pre = document.createElement("pre");
    const code = document.createElement("code");

    renderedLines.forEach((line) => {
      const span = document.createElement("span");
      span.classList.add("diff-line");

      if (line.startsWith("+")) {
        span.classList.add("diff-add");
      } else if (line.startsWith("-")) {
        span.classList.add("diff-remove");
      } else if (line.startsWith("@@")) {
        span.classList.add("diff-hunk");
      }

      span.textContent = line;
      code.appendChild(span);
    });

    if (truncated) {
      const notice = document.createElement("span");
      notice.classList.add("diff-line", "diff-hunk");
      notice.textContent = "... diff preview truncated ...";
      code.appendChild(notice);
    }

    pre.appendChild(code);
    container.appendChild(pre);
  }

  function populateCommit(elements, commit) {
    const message = commit?.commit?.message || "";
    const [title, ...rest] = message.split("\n");
    const description = rest.join("\n").trim();

    setText(elements.title, title || "No commit message");

    const authorName =
      commit?.commit?.author?.name ||
      commit?.author?.login ||
      "Unknown";
    setText(elements.author, authorName);

    const date = commit?.commit?.author?.date;
    setText(elements.date, formatDate(date));

    const sha = commit?.sha ? commit.sha.slice(0, 7) : "—";
    setText(elements.sha, sha);

    const htmlUrl = commit?.html_url || null;
    setLink(elements.link, htmlUrl, htmlUrl ? "View on GitHub" : "Unavailable");

    const descEl = getEl(elements.description);
    if (descEl) {
      descEl.textContent = description || "No additional description.";
      descEl.classList.remove("updates-error");
    }

    renderDiffPreview(elements.diff, commit?.files);
  }

  async function loadRepository(repoConfig, signal) {
    try {
      const commit = await fetchLatestCommit(repoConfig.repo, signal);
      populateCommit(repoConfig.elements, commit);
      return commit;
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      console.error(`[Updates] Failed to load ${repoConfig.repo}`, err);
      renderError(repoConfig.elements, "Unable to load commit details at this time.");
      return null;
    }
  }

  function setLoadingState(repoConfig) {
    setText(repoConfig.elements.title, "Fetching…");
    setText(repoConfig.elements.author, "—");
    setText(repoConfig.elements.date, "—");
    setText(repoConfig.elements.sha, "—");
    setLink(repoConfig.elements.link, "#", "Fetching…");

    const desc = getEl(repoConfig.elements.description);
    if (desc) {
      desc.textContent = "Loading commit details…";
      desc.classList.remove("updates-error");
    }

    const diff = getEl(repoConfig.elements.diff);
    if (diff) {
      diff.innerHTML = `<p class="updates-empty">Loading diff preview…</p>`;
    }
  }

  async function refreshUpdates() {
    abort();
    abortController = new AbortController();

    setRefreshButtonState(true);
    setCacheMessage("Refreshing updates from GitHub…");
    setCacheTimestamp("Cache last updated: —");

    const results = {};
    let hadError = false;

    repositories.forEach((repo) => {
      setLoadingState(repo);
    });

    for (const repo of repositories) {
      try {
        const commit = await loadRepository(repo, abortController.signal);
        if (commit) {
          results[repo.key] = commit;
        } else {
          hadError = true;
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          setRefreshButtonState(false);
          return;
        }
        hadError = true;
      }
    }

    if (!hadError && results.runtime && results.dashboard) {
      persistCachedUpdates({
        runtime: results.runtime,
        dashboard: results.dashboard
      });
    } else {
      const cached = loadCachedUpdates();
      if (cached) {
        const runtimeRepo = repositories.find((repo) => repo.key === "runtime");
        const dashboardRepo = repositories.find((repo) => repo.key === "dashboard");

        if (!results.runtime && cached.runtime && runtimeRepo) {
          populateCommit(runtimeRepo.elements, cached.runtime);
        }

        if (!results.dashboard && cached.dashboard && dashboardRepo) {
          populateCommit(dashboardRepo.elements, cached.dashboard);
        }

        setCacheMessage("Unable to refresh all updates. Showing cached data where available.", true);
        setCacheTimestamp(formatCacheTimestamp(cached.timestamp));
      } else {
        setCacheMessage("Unable to refresh updates right now. Please try again.", true);
        setCacheTimestamp("Cache last updated: —");
      }
    }

    setRefreshButtonState(false);
  }

  function setupRefreshButton() {
    refreshButton = getEl("updates-refresh-btn");
    if (refreshButton && !refreshListenerBound) {
      refreshButton.addEventListener("click", refreshUpdates);
      refreshListenerBound = true;
    }
    setRefreshButtonState(false);
  }

  function teardownRefreshButton() {
    if (refreshButton && refreshListenerBound) {
      refreshButton.removeEventListener("click", refreshUpdates);
      refreshListenerBound = false;
    }
    refreshButton = null;
  }

  function init() {
    abort();
    setupRefreshButton();

    const cached = loadCachedUpdates();
    if (!cached || !renderCachedCommits(cached)) {
      setCacheMessage(NO_CACHE_MESSAGE);
      setCacheTimestamp("Cache last updated: —");
      repositories.forEach((repo) => {
        setAwaitingRefresh(repo);
      });
    }
  }

  function abort() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  function destroy() {
    abort();
    teardownRefreshButton();
  }

  window.UpdatesView = {
    init,
    destroy
  };
})();
