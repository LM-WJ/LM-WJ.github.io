/* Shared by Keep and the experiments. Load before styles to avoid a theme flash. */
(() => {
  'use strict';
  if (window.SiteTheme) return;
  const key = 'KEEP-THEME-STATUS', listeners = new Set();
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let preference = 'system', mode = 'light';
  function read() {
    try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch { return {}; }
  }
  function savedPreference(value) {
    if (['light', 'dark', 'system'].includes(value.themePreference)) return value.themePreference;
    return typeof value.isDark === 'boolean' ? (value.isDark ? 'dark' : 'light') : 'system';
  }
  function apply(next) {
    preference = next;
    mode = next === 'system' ? (media && media.matches ? 'dark' : 'light') : next;
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.classList.toggle('dark-mode', mode === 'dark');
    root.classList.toggle('light-mode', mode === 'light');
    root.style.colorScheme = mode;
    if (window.KEEP && KEEP.themeInfo) {
      KEEP.themeInfo.styleStatus.isDark = mode === 'dark';
      KEEP.themeInfo.styleStatus.themePreference = preference;
    }
    listeners.forEach(listener => listener(mode));
    window.dispatchEvent(new CustomEvent('site-theme-change', { detail: { mode, preference } }));
  }
  function setMode(next) {
    if (!['light', 'dark', 'system'].includes(next)) return;
    const value = { ...(window.KEEP && KEEP.themeInfo ? KEEP.themeInfo.styleStatus : {}), ...read(), isDark: next === 'dark' || (next === 'system' && !!(media && media.matches)), themePreference: next };
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The page can still switch without storage. */ }
    apply(next);
  }
  const refresh = () => apply(savedPreference(read()));
  window.SiteTheme = {
    getMode: () => mode, getPreference: () => preference, setMode, refresh,
    subscribe(listener) { listeners.add(listener); listener(mode); return () => listeners.delete(listener); }
  };
  // Existing blog choices take precedence over the former independent lab preference.
  const existing = read(); let legacy;
  try { legacy = localStorage.getItem('diy-lab-theme'); } catch {}
  if (savedPreference(existing) === 'system' && !existing.themePreference && ['light', 'dark'].includes(legacy)) setMode(legacy);
  else apply(savedPreference(existing));
  try { localStorage.removeItem('diy-lab-theme'); } catch {}
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) refresh(); });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
  if (media) media.addEventListener('change', () => { if (preference === 'system') apply('system'); });
})();
