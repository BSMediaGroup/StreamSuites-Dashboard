/* ======================================================================
   StreamSuites™ Dashboard — Discord OAuth2 (Static)
   - OAuth2 Authorization Code with PKCE
   - Stores session in localStorage
   ====================================================================== */

(function () {
  const AUTH_STORAGE_KEY = "streamsuites.discord.session";
  const AUTH_FLOW_KEY = "streamsuites.discord.oauth";
  const DISCORD_API_BASE = "https://discord.com/api";
  const DEFAULT_SCOPES = ["identify", "guilds"];

  const Auth = {
    session: null,
    config: {
      clientId: null,
      redirectUri: null,
      scopes: DEFAULT_SCOPES
    },
    elements: {
      loginButton: null,
      logoutButton: null,
      userWrap: null,
      userName: null,
      userAvatar: null,
      loginStatus: null,
      guildRow: null
    },
    loggedSessionNotified: false,

    init() {
      this.cacheElements();
      this.loadConfig();
      this.bindEvents();
      this.bootstrap();
    },

    cacheElements() {
      this.elements.loginButton = document.getElementById("discord-login-button");
      this.elements.logoutButton = document.getElementById("discord-logout-button");
      this.elements.userWrap = document.getElementById("discord-user");
      this.elements.userName = document.getElementById("discord-username");
      this.elements.userAvatar = document.getElementById("discord-avatar");
      this.elements.loginStatus = document.getElementById("discord-auth-status");
      this.elements.guildRow = document.getElementById("discord-guild-row");
    },

    loadConfig() {
      const metaClient = document.querySelector('meta[name="discord-client-id"]');
      const metaRedirect = document.querySelector('meta[name="discord-redirect-uri"]');
      const metaScopes = document.querySelector('meta[name="discord-scopes"]');

      const clientId =
        window.StreamSuitesDiscordAuth?.clientId ||
        (metaClient ? metaClient.getAttribute("content") : "") ||
        "";

      const redirectUri =
        window.StreamSuitesDiscordAuth?.redirectUri ||
        (metaRedirect ? metaRedirect.getAttribute("content") : "") ||
        `${window.location.origin}${window.location.pathname}`;

      const scopes =
        window.StreamSuitesDiscordAuth?.scopes ||
        (metaScopes ? metaScopes.getAttribute("content") : "") ||
        DEFAULT_SCOPES.join(" ");

      this.config.clientId = clientId;
      this.config.redirectUri = redirectUri;
      this.config.scopes = String(scopes)
        .split(/[,\s]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);

      if (!this.config.clientId || !this.config.redirectUri) {
        console.warn(
          "[Discord Auth] OAuth disabled — missing clientId or redirectUri",
          this.config
        );
      }
    },

    bindEvents() {
      if (this.elements.loginButton) {
        this.elements.loginButton.addEventListener("click", () => {
          this.startLogin();
        });
      }

      if (this.elements.logoutButton) {
        this.elements.logoutButton.addEventListener("click", () => {
          this.logout();
        });
      }

      document.addEventListener("click", (event) => {
        const lockedNav = event.target.closest("[data-discord-nav]");
        if (lockedNav && !this.session) {
          event.preventDefault();
          event.stopPropagation();
          this.startLogin();
        }

        const loginTrigger = event.target.closest("[data-discord-login]");
        if (loginTrigger) {
          event.preventDefault();
          this.startLogin();
        }
      });

      const container = document.getElementById("view-container");
      if (container) {
        const observer = new MutationObserver(() => {
          this.applyLockState();
        });
        observer.observe(container, { childList: true, subtree: true });
      }
    },

    async bootstrap() {
      const handled = await this.handleRedirect();
      if (!handled) {
        await this.restoreSession();
      }
      this.applyLockState();
      this.updateUI();
    },

    async handleRedirect() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (!code && !error) return false;

      if (error) {
        console.warn("[Discord Auth] OAuth error:", error);
        this.clearFlow();
        this.clearSession();
        this.updateUI();
        this.applyLockState();
        this.cleanUrl();
        return true;
      }

      const flow = this.loadFlow();
      if (!flow || flow.state !== state) {
        console.warn("[Discord Auth] OAuth state mismatch.");
        this.clearFlow();
        this.cleanUrl();
        return true;
      }

      try {
        const token = await this.exchangeCode(code, flow.verifier);
        const session = await this.hydrateSession(token);
        this.session = session;
        this.saveSession(session);
      } catch (err) {
        console.warn("[Discord Auth] Token exchange failed:", err);
        this.clearSession();
      } finally {
        this.clearFlow();
        this.cleanUrl();
      }

      return true;
    },

    async restoreSession() {
      const stored = this.loadSession();
      if (!stored) return;

      if (this.isExpired(stored)) {
        if (stored.refresh_token) {
          try {
            const refreshed = await this.refreshSession(stored.refresh_token);
            const session = await this.hydrateSession(refreshed, stored);
            this.session = session;
            this.saveSession(session);
          } catch (err) {
            console.warn("[Discord Auth] Refresh failed:", err);
            this.clearSession();
          }
        } else {
          this.clearSession();
        }
        return;
      }

      this.session = stored;

      if (!stored.user || !stored.guilds) {
        try {
          const session = await this.hydrateSession(stored);
          this.session = session;
          this.saveSession(session);
        } catch (err) {
          console.warn("[Discord Auth] Profile refresh failed:", err);
          this.clearSession();
        }
      }
    },

    async startLogin() {
      if (!this.config.clientId) {
        console.warn("[Discord Auth] Missing client ID.");
        return;
      }

      const verifier = this.generateVerifier();
      const challenge = await this.generateChallenge(verifier);
      const state = this.generateState();

      this.saveFlow({ verifier, state });

      const params = new URLSearchParams({
        response_type: "code",
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        scope: this.config.scopes.join(" "),
        code_challenge: challenge,
        code_challenge_method: "S256",
        state
      });

      window.location.assign(`${DISCORD_API_BASE}/oauth2/authorize?${params.toString()}`);
    },

    logout() {
      this.clearSession();
      this.loggedSessionNotified = false;
      this.updateUI();
      this.applyLockState();
    },

    applyLockState() {
      const locked = !this.session;
      document.body.classList.toggle("discord-auth-required", locked);
      document.body.classList.toggle("discord-authenticated", !locked);
      const lockStatus = document.getElementById("discord-auth-status");
      if (lockStatus) {
        lockStatus.textContent = locked ? "Discord login required" : "Discord authenticated";
      }

      const lockedNav = document.querySelector("[data-discord-nav]");
      if (lockedNav) {
        lockedNav.setAttribute("aria-disabled", locked ? "true" : "false");
      }
    },

    updateUI() {
      const loggedIn = Boolean(this.session && this.session.user);
      const canLogin = this.canStartLogin();
      if (this.elements.loginButton) {
        this.elements.loginButton.classList.toggle("hidden", loggedIn);
        this.elements.loginButton.disabled = !canLogin;
      }

      if (this.elements.userWrap) {
        this.elements.userWrap.classList.toggle("hidden", !loggedIn);
      }

      if (this.elements.guildRow) {
        this.elements.guildRow.classList.toggle("hidden", !loggedIn);
      }

      if (!loggedIn) {
        this.emitSessionChange();
        return;
      }

      if (!this.loggedSessionNotified) {
        console.info("[Discord Auth] OAuth session detected.");
        this.loggedSessionNotified = true;
      }

      const user = this.session.user;
      if (this.elements.userName) {
        this.elements.userName.textContent = user.username;
      }

      if (this.elements.userAvatar) {
        this.elements.userAvatar.src = this.getAvatarUrl(user);
        this.elements.userAvatar.alt = `${user.username} avatar`;
      }

      this.emitSessionChange();
    },

    emitSessionChange() {
      window.dispatchEvent(
        new CustomEvent("streamsuites:discord-auth", {
          detail: { session: this.session }
        })
      );
    },

    async exchangeCode(code, verifier) {
      const body = new URLSearchParams({
        client_id: this.config.clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
        code_verifier: verifier
      });

      const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const payload = await response.json();
      return this.normalizeToken(payload);
    },

    async refreshSession(refreshToken) {
      const body = new URLSearchParams({
        client_id: this.config.clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken
      });

      const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const payload = await response.json();
      return this.normalizeToken(payload);
    },

    async hydrateSession(token, existing = {}) {
      const accessToken = token.access_token || existing.access_token;
      if (!accessToken) {
        throw new Error("Missing access token.");
      }

      const [user, guilds] = await Promise.all([
        this.fetchUser(accessToken),
        this.fetchGuilds(accessToken)
      ]);

      return {
        ...existing,
        ...token,
        user,
        guilds
      };
    },

    async fetchUser(accessToken) {
      const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user.");
      }

      const data = await response.json();
      return {
        user_id: data.id,
        username: data.global_name || data.username,
        avatar: data.avatar,
        discriminator: data.discriminator
      };
    },

    async fetchGuilds(accessToken) {
      const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch guilds.");
      }

      const data = await response.json();
      return data.map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner: guild.owner,
        permissions: guild.permissions
      }));
    },

    getAvatarUrl(user) {
      if (user.avatar) {
        return `https://cdn.discordapp.com/avatars/${user.user_id}/${user.avatar}.png?size=64`;
      }
      const index = Number(user.discriminator || 0) % 5;
      return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    },

    normalizeToken(payload) {
      const now = Date.now();
      const expiresIn = Number(payload.expires_in || 0);
      return {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token || null,
        token_type: payload.token_type,
        scope: payload.scope,
        expires_at: now + expiresIn * 1000,
        fetched_at: now
      };
    },

    isExpired(session) {
      if (!session.expires_at) return true;
      return Date.now() > session.expires_at - 60 * 1000;
    },

    saveSession(session) {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      } catch (err) {
        console.warn("[Discord Auth] Failed to save session:", err);
      }
    },

    loadSession() {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.warn("[Discord Auth] Failed to load session:", err);
        return null;
      }
    },

    clearSession() {
      this.session = null;
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch (err) {
        console.warn("[Discord Auth] Failed to clear session:", err);
      }
    },

    saveFlow(flow) {
      try {
        localStorage.setItem(AUTH_FLOW_KEY, JSON.stringify(flow));
      } catch (err) {
        console.warn("[Discord Auth] Failed to save flow:", err);
      }
    },

    loadFlow() {
      try {
        const raw = localStorage.getItem(AUTH_FLOW_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.warn("[Discord Auth] Failed to load flow:", err);
        return null;
      }
    },

    clearFlow() {
      try {
        localStorage.removeItem(AUTH_FLOW_KEY);
      } catch (err) {
        console.warn("[Discord Auth] Failed to clear flow:", err);
      }
    },

    cleanUrl() {
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      url.searchParams.delete("error");
      window.history.replaceState({}, document.title, url.toString());
    },

    generateVerifier() {
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      return this.base64UrlEncode(bytes);
    },

    isValidRedirectUri(value) {
      if (!value) return false;
      try {
        new URL(value, window.location.href);
        return true;
      } catch {
        return false;
      }
    },

    canStartLogin() {
      return Boolean(this.config.clientId && this.isValidRedirectUri(this.config.redirectUri));
    },

    async generateChallenge(verifier) {
      const data = new TextEncoder().encode(verifier);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      return this.base64UrlEncode(new Uint8Array(digest));
    },

    generateState() {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return this.base64UrlEncode(bytes);
    },

    base64UrlEncode(buffer) {
      let binary = "";
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
  };

  window.StreamSuitesAuth = Auth;
  document.addEventListener("DOMContentLoaded", () => Auth.init());
})();
