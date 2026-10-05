(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pages = [['mandelbulb','曼德尔球'],['benford','班福德定律'],['kardashev','卡尔达肖夫指数'],['quantum-eraser','量子擦除'],['theseus','忒修斯之船'],['ooparts','时代错误遗物']];
  $('site-header').innerHTML = '<div class="topbar"><a class="brand" href="/diy/"><span>◈</span>有趣的东西 · 探索室</a><div class="top-actions"><a class="back" href="/diy/">← 返回作品集</a><button id="theme-toggle" class="theme-button" type="button" aria-label="切换深浅色主题">切换主题</button></div></div>';
  $('site-footer').innerHTML = '<div class="lab-footer"><nav class="lab-nav" aria-label="更多探索">' + pages.map(([slug,title]) => `<a href="/diy/${slug}/" ${location.pathname.includes('/'+slug+'/')?'aria-current="page"':''}>${title}</a>`).join('') + '</nav><span>韦建杰的个人站 · 把好奇心变成可以动手的实验</span></div>';
  SiteTheme.subscribe(mode => { $('theme-toggle').textContent = mode === 'dark' ? '浅色模式' : '深色模式'; $('theme-toggle').setAttribute('aria-pressed', String(mode === 'dark')); });
  $('theme-toggle').addEventListener('click', () => SiteTheme.setMode(SiteTheme.getMode() === 'dark' ? 'light' : 'dark'));
  window.Lab = { $, escape, num: n => n.toLocaleString('zh-CN'), set: (id,value) => { $(id).textContent = value; }, on: (id,event,fn) => $(id).addEventListener(event,fn), pressed: (container,button) => { $(container).querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed',String(el===button))); } };
})();
