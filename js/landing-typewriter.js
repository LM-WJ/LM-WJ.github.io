(() => {
  'use strict';
  const container = document.querySelector('[data-landing-typewriter]');
  if (!container || container.dataset.initialized) return;
  container.dataset.initialized = 'true';
  const output = container.querySelector('.landing-typing-text');
  const phrases = [...container.querySelectorAll('.landing-typing-phrases > span')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer;
  let phraseIndex = 0;
  let length = 0;
  let deleting = false;

  function tick() {
    if (!container.isConnected) return;
    const characters = Array.from(phrases[phraseIndex].textContent);
    length += deleting ? -1 : 1;
    output.textContent = characters.slice(0, length).join('');
    let delay = deleting ? 65 : 140;
    if (!deleting && length === characters.length) {
      deleting = true;
      delay = 2000;
    } else if (deleting && length === 0) {
      deleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      delay = 400;
    }
    timer = window.setTimeout(tick, delay);
  }

  function restart() {
    window.clearTimeout(timer);
    phraseIndex = 0;
    length = 0;
    deleting = false;
    output.textContent = reducedMotion.matches ? phrases[0].textContent : '';
    if (!reducedMotion.matches) timer = window.setTimeout(tick, 350);
  }

  document.addEventListener('site:language', restart);
  reducedMotion.addEventListener('change', restart);
  restart();
})();
