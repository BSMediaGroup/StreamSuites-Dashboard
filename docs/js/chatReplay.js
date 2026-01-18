// Lightweight wiring for the Chat Replay preview surface.
// The dashboard remains read-only; this module only swaps local preview targets.

const BASE_ORIGIN = `${window.location.origin}${window.ADMIN_BASE_PATH}`;

const buildPreviewUrl = (page, theme, mode) => {
  const url = new URL(page, BASE_ORIGIN);
  url.searchParams.set('theme', theme || 'default');
  url.searchParams.set('mode', mode || 'replay');
  return url.toString();
};

const formatReplayTimestamp = (value) => {
  return window.StreamSuitesState?.formatTimestamp?.(value) || value || '—';
};

async function loadReplayState() {
  const snapshot = await window.ConfigState?.loadRuntimeSnapshot?.();
  const replay = snapshot?.replay;

  if (!snapshot || !replay) {
    return {
      available: false,
      overlaySafe: null,
      eventCount: null,
      lastEventAt: null,
      platforms: [],
      source: snapshot?.source || null
    };
  }

  const overlaySafe = replay.overlay_safe === true || replay.overlaySafe === true;
  const eventCount =
    Number.isInteger(replay.event_count) || Number.isInteger(replay.eventCount)
      ? replay.event_count ?? replay.eventCount
      : null;
  const lastEventAt = replay.last_event_at || replay.lastEventAt || null;
  const platforms = Array.isArray(replay.platforms) ? replay.platforms : [];
  const mode = replay.mode || null;
  const available = replay.available === true;

  return {
    available,
    overlaySafe,
    eventCount,
    lastEventAt: formatReplayTimestamp(lastEventAt),
    platforms,
    source: snapshot.source || null,
    mode
  };
}

const setActiveModeButton = (buttons, activeButton) => {
  buttons.forEach((button) => button.classList.toggle('active', button === activeButton));
};

const setActiveThemeElement = (themeCard, activeElement) => {
  themeCard?.querySelectorAll('.element').forEach((el) => el.classList.remove('active'));
  activeElement?.classList.add('active');
};

function initChatReplayPreview() {
  const themeCard = document.getElementById('theme-card');
  const modeButtons = Array.from(document.querySelectorAll('.ss-mode-button'));
  const popoutButton = document.getElementById('popout-button');
  const frames = {
    window: {
      el: document.getElementById('window-preview'),
      pages: {
        replay: `${window.ADMIN_BASE_PATH}/views/chat_replay_window.html`,
        live: `${window.ADMIN_BASE_PATH}/views/chat_window.html`,
      }
    },
    overlay: {
      el: document.getElementById('overlay-preview'),
      page: `${window.ADMIN_BASE_PATH}/views/chat_overlay_obs.html`
    },
  };

  const activeTheme = themeCard?.querySelector('.element.active')?.dataset.theme || 'default';
  const activeModeButton = modeButtons.find((button) => button.classList.contains('active'));
  const activeMode = activeModeButton?.dataset.mode || activeModeButton?.getAttribute('data-mode') || 'replay';

  const state = { theme: activeTheme, mode: activeMode };

  const reloadPreviews = () => {
    Object.values(frames).forEach((frame) => {
      if (!frame.el) return;
      const page = frame.pages?.[state.mode] || frame.pages?.replay || frame.page;
      frame.el.src = buildPreviewUrl(page, state.theme, state.mode);
    });
  };

  themeCard?.addEventListener('click', (event) => {
    const target = event.target.closest('.element');
    if (!target || !themeCard.contains(target)) return;
    const nextTheme = target.getAttribute('data-theme');
    if (!nextTheme) return;
    state.theme = nextTheme;
    setActiveThemeElement(themeCard, target);
    reloadPreviews();
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.getAttribute('data-mode') || button.dataset.mode;
      if (!nextMode) return;
      state.mode = nextMode;
      setActiveModeButton(modeButtons, button);
      reloadPreviews();
    });
  });

  popoutButton?.addEventListener('click', () => {
    const targetPage = state.mode === 'live' ? 'chat_window.html' : 'chat_replay_window.html';
    const url = buildPreviewUrl(`${window.ADMIN_BASE_PATH}/views/${targetPage}`, state.theme, state.mode);
    window.open(url, '_blank', 'noopener');
  });

  reloadPreviews();
}

window.ChatReplayPreview = {
  initChatReplayPreview,
  loadReplayState
};
