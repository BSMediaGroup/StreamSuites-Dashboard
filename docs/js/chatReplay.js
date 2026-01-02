// Lightweight wiring for the Chat Replay preview surface.
// The dashboard remains read-only; this module only swaps local preview targets.

const buildPreviewUrl = (page, theme, mode) => {
  const url = new URL(page, window.location.href);
  url.searchParams.set('theme', theme || 'default');
  url.searchParams.set('mode', mode || 'replay');
  return url.toString();
};

const formatReplayTimestamp = (value) => {
  return window.StreamSuitesState?.formatTimestamp?.(value) || value || '—';
};

async function loadReplayState() {
  const snapshot = await window.ConfigState?.loadRuntimeSnapshot?.();
  if (!snapshot || !snapshot.replay) {
    return {
      available: false,
      overlaySafe: null,
      eventCount: null,
      lastEventAt: null,
      platforms: [],
      source: snapshot?.source || null
    };
  }

  const replay = snapshot.replay;

  return {
    available: replay.available === true,
    overlaySafe: replay.overlaySafe === true,
    eventCount: Number.isInteger(replay.eventCount) ? replay.eventCount : null,
    lastEventAt: formatReplayTimestamp(replay.lastEventAt),
    platforms: Array.isArray(replay.platforms) ? replay.platforms : [],
    source: snapshot.source || null,
    mode: replay.mode || null
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
  const basePath = window.location.pathname.includes('/views/') ? '../' : './';
  const frames = {
    window: {
      el: document.getElementById('window-preview'),
      pages: {
        replay: `${basePath}views/chat_replay_window.html`,
        live: `${basePath}views/chat_window.html`,
      }
    },
    overlay: { el: document.getElementById('overlay-preview'), page: `${basePath}views/chat_overlay_obs.html` },
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
    const url = buildPreviewUrl(`${basePath}views/${targetPage}`, state.theme, state.mode);
    window.open(url, '_blank', 'noopener');
  });

  reloadPreviews();
}

window.ChatReplayPreview = {
  initChatReplayPreview,
  loadReplayState
};
