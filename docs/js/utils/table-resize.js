/* ======================================================================
   StreamSuites Dashboard — Table Resize Utility
   - Drag column handles to resize
   - Double-click handle to auto-fit visible content
   - Persists widths in localStorage
   ====================================================================== */

(function () {
  "use strict";

  const DEFAULT_MIN_WIDTH = 80;
  const DEFAULT_MAX_WIDTH = 960;
  const WIDTH_PADDING_PX = 24;
  let textMeasureCanvas = null;

  function toFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getTextMeasureContext() {
    if (!textMeasureCanvas) {
      textMeasureCanvas = document.createElement("canvas");
    }
    return textMeasureCanvas.getContext("2d");
  }

  function extractHeaderText(th) {
    if (!(th instanceof HTMLElement)) return "";
    let text = "";
    th.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || "";
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains("ss-col-resizer")) return;
      text += node.textContent || "";
    });
    return text.replace(/\s+/g, " ").trim();
  }

  function computeHeaderMinWidth(th, options = {}) {
    if (!(th instanceof HTMLElement)) return DEFAULT_MIN_WIDTH;
    const floor = toFiniteNumber(options.floor) || DEFAULT_MIN_WIDTH;
    const ceiling = toFiniteNumber(options.ceiling) || DEFAULT_MAX_WIDTH;
    const resizable = options.resizable === true;
    const text = extractHeaderText(th) || " ";
    const style = window.getComputedStyle(th);
    const ctx = getTextMeasureContext();
    if (!ctx) return floor;

    const fontStyle = style.fontStyle || "normal";
    const fontVariant = style.fontVariant || "normal";
    const fontWeight = style.fontWeight || "400";
    const fontSize = style.fontSize || "13px";
    const fontFamily = style.fontFamily || "sans-serif";
    ctx.font = `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize} ${fontFamily}`;

    const textWidth = Math.ceil(ctx.measureText(text).width);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const sortAllowance = th.hasAttribute("data-sort") ? 14 : 0;
    const handleAllowance = resizable ? 16 : 8;
    const next = textWidth + paddingLeft + paddingRight + sortAllowance + handleAllowance;
    return clamp(Math.ceil(next), floor, ceiling);
  }

  function loadStoredWidths(storageKey) {
    if (!storageKey) return {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function saveStoredWidths(storageKey, widths) {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch (err) {
      // Storage failures are non-fatal.
    }
  }

  function initResizableTable(config = {}) {
    const table = config.table;
    if (!(table instanceof HTMLTableElement)) return null;

    const storageKey = String(config.storageKey || "").trim();
    const minWidth = toFiniteNumber(config.minWidth) || DEFAULT_MIN_WIDTH;
    const maxWidth = toFiniteNumber(config.maxWidth) || DEFAULT_MAX_WIDTH;
    const skipLastHandle = config.skipLastHandle !== false;
    const ignoreBodyRowSelector = String(config.ignoreBodyRowSelector || "").trim();

    let columns = [];
    let disposed = false;
    let storedWidths = loadStoredWidths(storageKey);
    let dragSession = null;

    function resolveHeaders() {
      return Array.from(table.querySelectorAll("thead th"));
    }

    function ensureColgroup(headers) {
      let colgroup = table.querySelector('colgroup[data-resize-colgroup="1"]');
      if (!colgroup) {
        colgroup = document.createElement("colgroup");
        colgroup.setAttribute("data-resize-colgroup", "1");
        table.insertBefore(colgroup, table.firstChild);
      }

      while (colgroup.children.length < headers.length) {
        colgroup.appendChild(document.createElement("col"));
      }
      while (colgroup.children.length > headers.length) {
        colgroup.removeChild(colgroup.lastChild);
      }

      return colgroup;
    }

    function buildColumnState() {
      const headers = resolveHeaders();
      const colgroup = ensureColgroup(headers);

      columns = headers.map((th, index) => {
        const key =
          (th.getAttribute("data-col-key") || th.getAttribute("data-sort") || `col_${index}`).trim();
        const canResize = !(skipLastHandle && index === headers.length - 1);
        th.setAttribute("data-col-key", key);
        const col = colgroup.children[index];
        if (col) {
          col.setAttribute("data-col-key", key);
        }
        return {
          key,
          th,
          col,
          index,
          canResize,
          minWidth: computeHeaderMinWidth(th, { floor: minWidth, ceiling: maxWidth, resizable: canResize })
        };
      });
    }

    function collectCurrentWidths() {
      const next = {};
      columns.forEach((column) => {
        const width = Math.round(column.th.getBoundingClientRect().width);
        if (Number.isFinite(width) && width > 0) {
          next[column.key] = width;
        }
      });
      return next;
    }

    function persistCurrentWidths() {
      const next = collectCurrentWidths();
      storedWidths = next;
      saveStoredWidths(storageKey, next);
    }

    function setColumnWidth(column, rawWidth, options = {}) {
      if (!column || !column.th) return;
      const persist = options.persist === true;
      const columnMin = toFiniteNumber(column.minWidth) || minWidth;
      const width = Math.round(clamp(rawWidth, columnMin, maxWidth));
      const widthPx = `${width}px`;

      if (column.col) {
        column.col.style.width = widthPx;
        column.col.style.minWidth = widthPx;
        column.col.style.maxWidth = widthPx;
      }

      column.th.style.width = widthPx;
      column.th.style.minWidth = widthPx;
      column.th.style.maxWidth = widthPx;

      if (persist) {
        persistCurrentWidths();
      }
    }

    function applyStoredWidths() {
      columns.forEach((column) => {
        const saved = toFiniteNumber(storedWidths[column.key]);
        if (!saved || saved <= 0) return;
        setColumnWidth(column, saved, { persist: false });
      });
    }

    function autoFitColumn(column) {
      if (!column || !column.th) return;

      let bestWidth = Math.ceil(column.th.scrollWidth) + WIDTH_PADDING_PX;
      const bodyRows = table.tBodies[0] ? Array.from(table.tBodies[0].rows) : [];

      bodyRows.forEach((row) => {
        if (!(row instanceof HTMLTableRowElement)) return;
        if (ignoreBodyRowSelector && row.matches(ignoreBodyRowSelector)) return;

        const cell = row.cells[column.index];
        if (!cell) return;
        bestWidth = Math.max(bestWidth, Math.ceil(cell.scrollWidth) + WIDTH_PADDING_PX);
      });

      setColumnWidth(column, bestWidth, { persist: true });
    }

    function stopDragging() {
      if (!dragSession) return;
      const { onMove, onUp } = dragSession;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      dragSession = null;
      document.body.classList.remove("ss-col-resizing-active");
    }

    function bindHandle(column, isLastColumn) {
      if (!column?.th || (skipLastHandle && isLastColumn)) return;

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "ss-col-resizer";
      handle.setAttribute("aria-label", `Resize ${column.th.textContent || "column"}`);
      handle.setAttribute("tabindex", "-1");
      handle.setAttribute("data-col-key", column.key);

      handle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      handle.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        autoFitColumn(column);
      });

      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();

        stopDragging();

        const startX = event.clientX;
        const startWidth = column.th.getBoundingClientRect().width;
        document.body.classList.add("ss-col-resizing-active");

        const onMove = (moveEvent) => {
          const delta = moveEvent.clientX - startX;
          setColumnWidth(column, startWidth + delta, { persist: false });
        };

        const onUp = () => {
          stopDragging();
          persistCurrentWidths();
        };

        dragSession = { onMove, onUp };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      });

      column.th.classList.add("ss-col-resizable");
      column.th.appendChild(handle);
    }

    function renderHandles() {
      columns.forEach((column) => {
        const oldHandles = column.th.querySelectorAll(".ss-col-resizer");
        oldHandles.forEach((handle) => handle.remove());
        column.th.classList.remove("ss-col-resizable");
      });

      columns.forEach((column, index) => {
        bindHandle(column, index === columns.length - 1);
      });
    }

    function refresh() {
      if (disposed) return;
      buildColumnState();
      applyStoredWidths();
      renderHandles();
    }

    function destroy() {
      disposed = true;
      stopDragging();
      columns.forEach((column) => {
        column.th.classList.remove("ss-col-resizable");
        const handles = column.th.querySelectorAll(".ss-col-resizer");
        handles.forEach((handle) => handle.remove());
      });
      columns = [];
    }

    refresh();

    return {
      refresh,
      destroy,
      autoFitColumnByKey(key) {
        const column = columns.find((entry) => entry.key === key);
        if (!column) return;
        autoFitColumn(column);
      },
      getWidths() {
        return { ...storedWidths };
      }
    };
  }

  window.TableResize = {
    initResizableTable
  };
})();
