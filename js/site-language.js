(() => {
  'use strict';
  if (window.SiteLanguage) return;
  const script = document.querySelector('script[data-site-language]');
  const storageKey = 'site-language';
  const languages = ['zh-CN', 'zh-Hant', 'en'];
  const excluded = 'script,style,svg,canvas,img,picture,video,audio,pre,code,noscript,textarea,[contenteditable],[translate="no"],.site-language';
  const attributes = ['title', 'aria-label', 'placeholder'];
  const texts = new WeakMap();
  const attrs = new WeakMap();
  const normalize = text => text.trim().replace(/\s+/g, ' ');
  let language = 'zh-CN';
  let desired = language;
  let catalog;
  let reverse;
  let catalogPromise;
  let converter;
  let converterPromise;
  let request = 0;
  let patterns = [];
  let pending = false;
  const controls = new Set();
  let observer;
  let themeButton;

  function updateThemeButton() {
    if (!themeButton) return;
    const dark = window.SiteTheme?.getMode() === 'dark';
    const label = translate(dark ? '切换到浅色模式' : '切换到深色模式');
    themeButton.setAttribute('aria-label', label);
    themeButton.setAttribute('title', label);
    themeButton.setAttribute('aria-pressed', String(dark));
  }

  function getSaved() {
    try { const value = localStorage.getItem(storageKey); return languages.includes(value) ? value : 'zh-CN'; }
    catch { return 'zh-CN'; }
  }
  function loadCatalog() {
    if (!catalogPromise) catalogPromise = fetch(script.dataset.catalog).then(response => {
      if (!response.ok) throw new Error('Language file unavailable');
      return response.json();
    }).then(data => {
      catalog = data.english;
      reverse = new Map(Object.entries(catalog).map(([source, translated]) => [normalize(translated), source]));
      patterns = data.patterns.map(([from, to]) => {
        const escaped = from.split(/(\{\d+\})/).map(part => /^\{\d+\}$/.test(part) ? '(.+?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
        return [new RegExp('^' + escaped + '$'), to];
      });
    }).catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  function loadConverter() {
    if (window.OpenCC && !converter) converter = window.OpenCC.Converter({ from: 'cn', to: 'tw' });
    if (converter) return Promise.resolve();
    if (!converterPromise) converterPromise = new Promise((resolve, reject) => {
      const vendor = document.createElement('script');
      vendor.src = '/js/vendor/opencc-cn2t.js';
      vendor.onload = () => { converter = window.OpenCC.Converter({ from: 'cn', to: 'tw' }); resolve(); };
      vendor.onerror = () => { vendor.remove(); converterPromise = null; reject(new Error('Language file unavailable')); };
      document.head.appendChild(vendor);
    });
    return converterPromise;
  }
  function translate(source) {
    if (language === 'zh-CN' || !/[\u3400-\u9fff]/.test(source)) return source;
    const key = normalize(source);
    let output;
    if (language === 'zh-Hant') output = converter(key);
    else {
      output = catalog[key];
      if (output === undefined) {
        for (const [pattern, replacement] of patterns) {
          const match = key.match(pattern);
          if (match) { output = replacement.replace(/\{(\d+)\}/g, (_, i) => match[Number(i) + 1]); break; }
        }
      }
    }
    if (output === undefined) return source;
    return source.slice(0, source.length - source.trimStart().length) + output + source.slice(source.trimEnd().length);
  }
  function updateText(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const value = node.nodeValue;
    const previous = texts.get(node);
    const source = previous && value === previous.output ? previous.source : (reverse?.get(normalize(value)) || value);
    const output = translate(source);
    if (output !== value) node.nodeValue = output;
    texts.set(node, { source, output });
  }
  function updateAttributes(element) {
    if (element.closest(excluded)) return;
    const saved = attrs.get(element) || {};
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      const value = element.getAttribute(name);
      const previous = saved[name];
      const source = previous && value === previous.output ? previous.source : value;
      const output = translate(source);
      if (value !== output) element.setAttribute(name, output);
      saved[name] = { source, output };
    }
    attrs.set(element, saved);
  }
  function scan(root) {
    if (root.nodeType === Node.TEXT_NODE) { updateText(root); return; }
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.closest(excluded)) return;
      updateAttributes(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.nodeType === Node.ELEMENT_NODE && node.matches(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) updateText(node);
      else updateAttributes(node);
    }
  }
  function watch() {
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attributes });
  }
  function apply() {
    if (!window.document?.documentElement) return;
    // Drain pending application writes before taking our own observer offline.
    observer.takeRecords();
    observer.disconnect();
    scan(document.documentElement);
    document.documentElement.lang = language;
    for (const select of controls) { select.value = language; select.disabled = false; }
    updateThemeButton();
    watch();
  }
  async function setLanguage(value) {
    if (!languages.includes(value)) return;
    const id = ++request;
    desired = value;
    document.querySelectorAll('.site-language-error').forEach(element => element.remove());
    try {
      if (value === 'en') await loadCatalog();
      if (value === 'zh-Hant') await loadConverter();
      if (id !== request) return;
      language = value;
      try { localStorage.setItem(storageKey, value); } catch { /* Storage may be disabled. */ }
      apply();
      document.dispatchEvent(new CustomEvent('site:language', { detail: { language } }));
    } catch {
      if (id !== request) return;
      desired = language;
      for (const select of controls) {
        select.value = language;
        const error = document.createElement('span');
        error.className = 'site-language-error';
        error.role = 'status';
        error.textContent = '语言文件加载失败，请重试 / Please try again';
        select.parentElement.appendChild(error);
      }
    }
  }
  function mount() {
    if (document.querySelector('.site-language')) return;
    const host = document.querySelector('.landing-brand-header') || document.querySelector('.header-content > .right') || document.querySelector('.topbar');
    const group = document.createElement('div');
    group.className = 'site-preferences' + (host ? '' : ' site-language-fallback');
    themeButton = document.createElement('button');
    themeButton.type = 'button';
    themeButton.className = 'header-theme-toggle';
    themeButton.setAttribute('translate', 'no');
    themeButton.innerHTML = '<svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 13.5A9 9 0 0 1 10.5 3a9 9 0 1 0 10 10.5Z"/></svg>';
    themeButton.addEventListener('click', () => window.SiteTheme?.setMode(window.SiteTheme.getMode() === 'dark' ? 'light' : 'dark'));
    const wrapper = document.createElement('label');
    wrapper.className = 'site-language';
    wrapper.setAttribute('translate', 'no');
    wrapper.innerHTML = '<span class="site-language-symbol" aria-hidden="true">文/A</span><select aria-label="语言 / Language"><option value="zh-CN" lang="zh-CN">简中</option><option value="zh-Hant" lang="zh-Hant">繁中</option><option value="en" lang="en">English</option></select>';
    const select = wrapper.querySelector('select');
    select.value = desired;
    select.addEventListener('change', () => setLanguage(select.value));
    controls.add(select);
    group.append(themeButton, wrapper);
    (host || document.body).appendChild(group);
    updateThemeButton();
  }
  function start() {
    observer = new MutationObserver(records => {
      if (pending) return;
      const relevant = records.some(record => !(record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement)?.closest(excluded));
      if (!relevant) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        if (!window.document?.documentElement) return;
        mount();
        // Scanning the page also restores text copied by widgets into new nodes.
        // Never touch image, SVG, canvas, source code, or input values.
        apply();
      });
    });
    mount();
    watch();
    setLanguage(getSaved());
    window.addEventListener('site-theme-change', updateThemeButton);
    window.addEventListener('storage', event => { if (event.key === storageKey) setLanguage(getSaved()); });
  }
  window.SiteLanguage = { setLanguage, getLanguage: () => language, t: translate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
