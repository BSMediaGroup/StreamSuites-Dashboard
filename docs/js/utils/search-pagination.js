/* ======================================================================
   StreamSuites Dashboard — Shared Search + Pagination Utility
   - Reusable across entities, signals, admin tables, and public gallery
   - Client-side only; safe for static hosting
   ====================================================================== */

(function () {
  "use strict";

  const DEFAULT_PAGE_SIZE = 5;

  function normalizeTerm(term) {
    return (term || "").toString().trim().toLowerCase();
  }

  function resolveValue(item, field) {
    if (!item || !field) return null;
    if (field.includes(".")) {
      return field.split(".").reduce((value, key) => {
        if (value && Object.prototype.hasOwnProperty.call(value, key)) {
          return value[key];
        }
        return undefined;
      }, item);
    }
    return item[field];
  }

  function filterData(data, term, fields) {
    if (!Array.isArray(data)) return [];
    const query = normalizeTerm(term);
    if (!query) return [...data];

    return data.filter((item) => {
      return (fields || []).some((field) => {
        const value = resolveValue(item, field);
        if (value === undefined || value === null) return false;
        return String(value).toLowerCase().includes(query);
      });
    });
  }

  function sortData(data, field, direction = "asc") {
    if (!field) return [...data];

    const dir = direction === "desc" ? -1 : 1;
    return [...data].sort((a, b) => {
      const aVal = resolveValue(a, field);
      const bVal = resolveValue(b, field);

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * dir;
      }

      const aNum = Number(aVal);
      const bNum = Number(bVal);

      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return (aNum - bNum) * dir;
      }

      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }

  function paginate(data, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
    const total = Array.isArray(data) ? data.length : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: (data || []).slice(start, end),
      total,
      totalPages,
      page: safePage,
      pageSize
    };
  }

  function renderPagination(container, state, onChange) {
    if (!container) return;
    container.innerHTML = "";

    if (state.total === 0) {
      const muted = document.createElement("span");
      muted.className = "muted";
      muted.textContent = "No results";
      container.appendChild(muted);
      return;
    }

    const info = document.createElement("span");
    info.className = "muted";
    info.textContent = `Showing page ${state.page} of ${state.totalPages} (${state.total} items)`;
    container.appendChild(info);

    const controls = document.createElement("div");
    controls.className = "pager-controls";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "ss-btn ss-btn-small";
    prevBtn.textContent = "Prev";
    prevBtn.disabled = state.page <= 1;
    prevBtn.addEventListener("click", () => onChange(Math.max(1, state.page - 1)));

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "ss-btn ss-btn-small";
    nextBtn.textContent = "Next";
    nextBtn.disabled = state.page >= state.totalPages;
    nextBtn.addEventListener("click", () => onChange(Math.min(state.totalPages, state.page + 1)));

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    container.appendChild(controls);
  }

  function createTableManager(config) {
    const state = {
      data: Array.isArray(config.data) ? config.data : [],
      searchTerm: "",
      page: 1,
      pageSize: config.pageSize || DEFAULT_PAGE_SIZE,
      sortField: config.defaultSortField || null,
      sortDirection: config.defaultSortDirection || "asc"
    };

    function renderSortState() {
      if (!config.table) return;
      const headers = config.table.querySelectorAll("th[data-sort]");
      headers.forEach((th) => {
        const field = th.getAttribute("data-sort");
        th.classList.remove("sorted-asc", "sorted-desc");
        if (field === state.sortField) {
          th.classList.add(state.sortDirection === "desc" ? "sorted-desc" : "sorted-asc");
        }
      });
    }

    function render() {
      const filtered = filterData(state.data, state.searchTerm, config.searchFields || []);
      const sorted = sortData(filtered, state.sortField, state.sortDirection);
      const pageState = paginate(sorted, state.page, state.pageSize);

      if (config.emptyState) {
        if (pageState.total === 0) {
          config.emptyState.classList.remove("hidden");
        } else {
          config.emptyState.classList.add("hidden");
        }
      }

      if (config.tableBody) {
        config.tableBody.innerHTML = "";
        pageState.items.forEach((item) => {
          const row = document.createElement("tr");
          row.innerHTML = config.renderRow(item);
          config.tableBody.appendChild(row);
        });
      }

      if (config.countLabel) {
        config.countLabel.textContent = `${pageState.total} items`;
      }

      renderPagination(config.paginationContainer, pageState, (nextPage) => {
        state.page = nextPage;
        render();
      });

      renderSortState();

      if (typeof config.onRender === "function") {
        try {
          config.onRender(pageState.items, pageState);
        } catch (err) {
          console.warn("[SearchPagination] onRender hook failed", err);
        }
      }
    }

    function handleSearch(event) {
      state.searchTerm = event.target.value || "";
      state.page = 1;
      render();
    }

    function handleSort(event) {
      const field = event.currentTarget.getAttribute("data-sort");
      if (!field) return;
      if (state.sortField === field) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortField = field;
        state.sortDirection = "asc";
      }
      state.page = 1;
      render();
    }

    if (config.searchInput) {
      config.searchInput.addEventListener("input", handleSearch);
    }

    if (config.table) {
      const headers = config.table.querySelectorAll("th[data-sort]");
      headers.forEach((th) => {
        th.addEventListener("click", handleSort);
        th.classList.add("sortable");
      });
    }

    return {
      setData(data) {
        state.data = Array.isArray(data) ? data : [];
        state.page = 1;
        render();
      },
      refresh() {
        render();
      }
    };
  }

  window.SearchPagination = {
    filterData,
    sortData,
    paginate,
    renderPagination,
    createTableManager
  };
})();
