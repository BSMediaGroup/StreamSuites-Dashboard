(() => {
  "use strict";

  const elTotal = document.getElementById("jobs-total");
  const elByStatus = document.getElementById("jobs-by-status");
  const elByType = document.getElementById("jobs-by-type");
  const elByCreator = document.getElementById("jobs-by-creator");
  const elError = document.getElementById("jobs-error");

  function clear(el) {
    el.innerHTML = "";
  }

  function showError(msg) {
    elError.textContent = msg;
    elError.classList.remove("hidden");
  }

  function hideError() {
    elError.classList.add("hidden");
    elError.textContent = "";
  }

  async function loadJobs() {
    hideError();

    try {
      const loadState = window.StreamSuitesState?.loadStateJson;
      const data = loadState
        ? await loadState("jobs.json")
        : null;

      if (!data) {
        throw new Error("No job state available");
      }

      const jobs = Array.isArray(data.jobs) ? data.jobs : [];

      renderMetrics(jobs);
    } catch (err) {
      console.error("[Dashboard][Jobs]", err);
      showError("Failed to load job state");
    }
  }

  function renderMetrics(jobs) {
    elTotal.textContent = jobs.length;

    const byStatus = {};
    const byType = {};
    const byCreator = {};

    for (const job of jobs) {
      const status = job.status || "unknown";
      const type = job.type || "unknown";
      const creator = job.creator_id || "unknown";

      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;

      if (!byCreator[creator]) {
        byCreator[creator] = 0;
      }
      byCreator[creator]++;
    }

    renderTable(elByStatus, byStatus);
    renderTable(elByType, byType);
    renderCreatorTable(elByCreator);
  }

  function renderTable(tbody, map) {
    clear(tbody);

    Object.entries(map).forEach(([key, count]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${key}</td><td>${count}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderCreatorTable(map) {
    clear(elByCreator);

    Object.entries(map).forEach(([creator, total]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${creator}</td><td>${total}</td>`;
      elByCreator.appendChild(tr);
    });
  }

  window.JobsView = {
    init: loadJobs
  };
})();
