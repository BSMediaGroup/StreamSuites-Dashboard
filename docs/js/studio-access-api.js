/* ======================================================================
   StreamSuites Dashboard - Studio ALPHA access API adapter.
   Runtime/Auth remains the only authority for grants and capacity.
   ====================================================================== */

(() => {
  "use strict";

  /** @typedef {{stage?: string, active_invited_tester_count?: number, maximum_invited_tester_count?: number, admins_consume_invited_tester_slots?: boolean}} StudioAccessSummary */
  /** @typedef {{id?: string, user_code?: string, display_name?: string, role?: string, tier?: string, account_status?: string}} StudioGrantAccount */
  /** @typedef {{account_id?: string, enabled?: boolean, granted_at?: string, updated_at?: string, revoked_at?: string|null, granted_by_account_id?: string, updated_by_account_id?: string, note?: string|null, account?: StudioGrantAccount, granted_by?: object, updated_by?: object}} StudioAccessGrant */
  /** @typedef {{success?: boolean, items?: StudioAccessGrant[], summary?: StudioAccessSummary}} StudioAccessListResponse */

  const STUDIO_ACCESS_PATH = "/api/admin/studio/access";
  const ACCOUNT_LIST_PATH = "/admin/accounts";

  function client() {
    if (!window.StreamSuitesApi?.apiFetch) {
      throw new Error("StreamSuites API client is unavailable.");
    }
    return window.StreamSuitesApi;
  }

  function jsonOptions(method, body, options = {}) {
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: options.timeoutMs ?? 8000,
      signal: options.signal
    };
  }

  /** @returns {Promise<StudioAccessListResponse>} */
  function getStudioAccess(options = {}) {
    return client().apiFetch(STUDIO_ACCESS_PATH, {
      forceRefresh: true,
      timeoutMs: options.timeoutMs ?? 8000,
      signal: options.signal
    });
  }

  function createStudioAccess(accountId, note, options = {}) {
    const payload = { account_id: String(accountId || "").trim() };
    if (typeof note === "string" && note.trim()) payload.note = note.trim();
    return client().apiFetch(STUDIO_ACCESS_PATH, jsonOptions("POST", payload, options));
  }

  function updateStudioAccess(accountId, changes, options = {}) {
    return client().apiFetch(
      `${STUDIO_ACCESS_PATH}/${encodeURIComponent(String(accountId || "").trim())}`,
      jsonOptions("PATCH", changes, options)
    );
  }

  function revokeStudioAccess(accountId, options = {}) {
    return client().apiFetch(
      `${STUDIO_ACCESS_PATH}/${encodeURIComponent(String(accountId || "").trim())}`,
      {
        method: "DELETE",
        timeoutMs: options.timeoutMs ?? 8000,
        signal: options.signal
      }
    );
  }

  function getAdminAccounts(options = {}) {
    return client().apiFetch(ACCOUNT_LIST_PATH, {
      forceRefresh: true,
      timeoutMs: options.timeoutMs ?? 8000,
      signal: options.signal
    });
  }

  window.StreamSuitesStudioAccessApi = Object.freeze({
    STUDIO_ACCESS_PATH,
    ACCOUNT_LIST_PATH,
    getStudioAccess,
    createStudioAccess,
    updateStudioAccess,
    revokeStudioAccess,
    getAdminAccounts
  });
})();
