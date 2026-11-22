(() => {
  'use strict';

  const { $, set, on } = Lab;
  const cosmos = $('cosmos');
  const sceneLabel = $('cosmos-label');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const tau = 2 * Math.PI;
  const galaxyFlattening = 0.43;
  const maxDelta = 0.05;
  const response = 9;
  const initialExponent = Math.log10(2e13);
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

  function smoothstep(start, end, value) {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  }

  function add(parent, tag, attributes) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    parent.appendChild(element);
    return element;
  }

  // Keep the original artwork and the background in the SVG for the lifetime of the view.
  const stars = Array.from({ length: 90 }, (_, i) => (
    `<circle cx="${(i * 193 + 31) % 680}" cy="${(i * 107 + 17) % 330}" r="${i % 7 === 0 ? 1.5 : 0.7}" fill="#b1d0dc" opacity="${0.2 + i % 5 * 0.13}"/>`
  )).join('');
  const galaxyStars = Array.from({ length: 400 }, (_, i) => {
    const radius = 8 + Math.sqrt(i / 400) * 240;
    const angle = i % 3 * tau / 3 + radius * 0.019;
    return `<circle cx="${Math.cos(angle) * radius}" cy="${Math.sin(angle) * radius * galaxyFlattening}" r="${i % 11 === 0 ? 2 : 1}" fill="${i % 4 === 0 ? '#e6c78e' : '#99bfdf'}" opacity="${0.2 + i % 7 * 0.1}"/>`;
  }).join('');

  cosmos.innerHTML = `
    <title></title>
    <defs>
      <radialGradient id="planet"><stop stop-color="#5bc2b8" offset="0"/><stop stop-color="#235870" offset=".55"/><stop stop-color="#102c42" offset="1"/></radialGradient>
      <radialGradient id="sun"><stop stop-color="#ffefd1"/><stop offset=".7" stop-color="#efbc62"/><stop offset="1" stop-color="#cc7540"/></radialGradient>
      <radialGradient id="glow"><stop stop-color="#e4b968" stop-opacity=".3"/><stop offset="1" stop-color="#e4b968" stop-opacity="0"/></radialGradient>
      <clipPath id="planet-disc"><circle r="88"/></clipPath>
    </defs>
    <g data-stars>${stars}</g>
    <g data-scene="planet" opacity="0">
      <g data-tracks></g><g data-back></g>
      <circle r="88" fill="url(#planet)"/>
      <g clip-path="url(#planet-disc)"><g data-land>
        <path d="M-45 -62 Q12 -54 -10 -17 T15 43 L43 51 Q34 7 62 -20 L26 -68Z" fill="#73b691" opacity=".45"/>
        <path d="M-68 -2 Q-29 1 -40 42L-19 75 Q-64 63 -79 20Z" fill="#79a995" opacity=".4"/>
      </g></g>
      <g data-front></g>
    </g>
    <g data-scene="star" opacity="0">
      <circle data-glow r="155" fill="url(#glow)"/>
      <g data-tracks></g><g data-back></g>
      <circle r="59" fill="url(#sun)"/>
      <g data-front></g>
    </g>
    <g data-scene="galaxy" opacity="0">
      <ellipse rx="245" ry="88" fill="#7f91a4" opacity=".07" transform="rotate(-15)"/>
      <circle r="72" fill="url(#glow)"/>
      <g data-galaxy-disc>${galaxyStars}</g>
    </g>`;

  const title = cosmos.querySelector('title');
  const planet = cosmos.querySelector('[data-scene="planet"]');
  const land = planet.querySelector('[data-land]');
  const star = cosmos.querySelector('[data-scene="star"]');
  const glow = star.querySelector('[data-glow]');
  const galaxy = cosmos.querySelector('[data-scene="galaxy"]');
  const galaxyDisc = galaxy.querySelector('[data-galaxy-disc]');
  const twinklingStars = [...cosmos.querySelectorAll('[data-stars] circle:nth-child(6n + 1)')].map((node, i) => ({
    node, base: Number(node.getAttribute('opacity')), phase: i * 1.7, speed: 0.7 + i % 4 * 0.27
  }));

  function createOrbit(scene, { radius, flat, tilt, count, fill, stroke, width, speed }) {
    const track = add(scene.querySelector('[data-tracks]'), 'ellipse', {
      rx: radius, ry: radius * flat, fill: 'none', stroke, 'stroke-opacity': 0.42
    });
    const back = add(scene.querySelector('[data-back]'), 'g', { transform: `rotate(${tilt})` });
    const front = add(scene.querySelector('[data-front]'), 'g', { transform: `rotate(${tilt})` });
    const attributes = { x: -width / 2, y: -3, width, height: 6, fill, opacity: 0 };
    const collectors = Array.from({ length: count }, (_, i) => ({
      front: add(front, 'rect', attributes),
      back: add(back, 'rect', attributes),
      offset: i * tau / count,
      priority: i * 7 % count,
      visible: null
    }));
    return { track, tilt, radius, flat, depthFactor: Math.sqrt(1 - flat * flat), speed, phase: 0, collectors };
  }

  const planetOrbit = createOrbit(planet, {
    radius: 206, flat: 69 / 206, tilt: -22, count: 24, fill: '#89ddd1', stroke: '#7fc3c5', width: 8, speed: 0.17
  });
  const starOrbits = [100, 130, 160].map((radius, i) => createOrbit(star, {
    radius: radius * 1.5, flat: 0.55 / 1.5, tilt: i * 55 - 55, count: 12,
    fill: '#dcb565', stroke: '#90794c', width: 10, speed: 0.23 - i * 0.035
  }));

  function paintOrbit(orbit, size, count) {
    const radius = orbit.radius * size;
    orbit.track.setAttribute('transform', `rotate(${orbit.tilt}) scale(${size})`);
    for (const collector of orbit.collectors) {
      const occupancy = clamp(count - collector.priority);
      if (occupancy === 0) {
        collector.visible?.setAttribute('opacity', 0);
        collector.visible = null;
        continue;
      }
      const angle = orbit.phase + collector.offset;
      const sine = Math.sin(angle);
      const depth = sine * orbit.depthFactor;
      const proximity = (depth + 1) / 2;
      const sizeAtDepth = 0.72 + proximity * 0.55;
      // Copies on opposite sides of the opaque body avoid reordering SVG nodes mid-frame.
      const visible = depth < 0 ? collector.back : collector.front;
      if (collector.visible !== visible) {
        collector.visible?.setAttribute('opacity', 0);
        collector.visible = visible;
      }
      visible.setAttribute('transform', `translate(${radius * Math.cos(angle)} ${radius * orbit.flat * sine}) scale(${sizeAtDepth})`);
      visible.setAttribute('opacity', occupancy * (0.25 + 0.75 * proximity));
    }
  }

  let current = (initialExponent - 6) / 10;
  let target = current;
  let elapsed = 0;
  let spin = 0;
  let rotation = 0;
  let previousTime = null;
  let frame = null;
  let inView = true;
  let lastScene = null;
  let lastTitle = null;
  let lastLabelOpacity = null;

  function placeScene(scene, opacity, scale) {
    scene.setAttribute('opacity', opacity);
    if (opacity > 0) scene.setAttribute('transform', `translate(340 173) scale(${scale})`);
  }

  function paint(dt) {
    elapsed += dt;
    const planetProgress = smoothstep(0, 1.35, current);
    const stellar = smoothstep(1.5, 2, current);
    const galactic = smoothstep(2.5, 3, current);
    spin = (spin + dt * (0.07 + 0.05 * planetProgress)) % tau;
    rotation = (rotation + dt * (0.014 + 0.012 * galactic)) % tau;
    planetOrbit.phase = (planetOrbit.phase + dt * planetOrbit.speed * (0.7 + planetProgress * 0.5)) % tau;
    for (const orbit of starOrbits) orbit.phase = (orbit.phase + dt * orbit.speed * (0.65 + stellar * 0.55)) % tau;

    const planetOpacity = 1 - stellar;
    const starOpacity = stellar * (1 - galactic);
    placeScene(planet, planetOpacity, 0.97 + planetProgress * 0.04 + stellar * 0.11);
    placeScene(star, starOpacity, 0.88 + stellar * 0.12 + galactic * 0.13);
    placeScene(galaxy, galactic, 0.85 + galactic * 0.15);

    if (planetOpacity > 0) {
      land.setAttribute('transform', `rotate(${spin * 360 / tau})`);
      paintOrbit(planetOrbit, 0.91 + planetProgress * 0.1, 5 + 19 * smoothstep(0, 1.05, current));
    }
    if (starOpacity > 0) {
      glow.setAttribute('opacity', 0.54 + stellar * 0.37 + 0.07 * Math.sin(elapsed * 1.25));
      glow.setAttribute('transform', `scale(${0.91 + 0.09 * stellar})`);
      for (const [i, orbit] of starOrbits.entries()) {
        paintOrbit(orbit, 0.84 + stellar * 0.16, 2 + 10 * smoothstep(1.54 + i * 0.08, 2.18 + i * 0.1, current));
      }
    }
    if (galactic > 0) {
      // Rotate in the galaxy's plane before applying the fixed viewing angle.
      galaxyDisc.setAttribute('transform', `scale(1 ${galaxyFlattening}) rotate(${rotation * 360 / tau}) scale(1 ${1 / galaxyFlattening})`);
    }
    for (const { node, base, phase, speed } of twinklingStars) {
      node.setAttribute('opacity', base * (0.84 + 0.16 * Math.sin(elapsed * speed + phase)));
    }

    const scene = galactic >= 0.5 ? 'galaxy' : stellar >= 0.5 ? 'star' : 'planet';
    const labelOpacity = Math.abs(2 * (stellar < 1 ? stellar : galactic) - 1);
    if (labelOpacity !== lastLabelOpacity) {
      sceneLabel.style.opacity = labelOpacity;
      lastLabelOpacity = labelOpacity;
    }
    if (scene !== lastScene) {
      sceneLabel.textContent = { planet: 'PLANETARY HORIZON', star: 'STELLAR COLLECTORS', galaxy: 'GALACTIC NETWORK' }[scene];
      lastScene = scene;
    }
    let caption;
    if (scene === 'planet') caption = current < 1 ? '尚未达到 I 型 · 行星尺度' : 'I 型以上 · 行星尺度';
    else if (scene === 'star') caption = 'II 型尺度 · 收集恒星能源';
    else caption = current >= 3 ? 'III 型 · 星系尺度' : '迈向 III 型 · 星系尺度';
    if (caption !== lastTitle) {
      title.textContent = caption;
      set('scene-title', caption);
      lastTitle = caption;
    }
  }

  function stopFrames() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previousTime = null;
  }

  function animate(time) {
    frame = null;
    const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, maxDelta);
    previousTime = time;
    current += (target - current) * -Math.expm1(-response * dt);
    if (Math.abs(target - current) < 0.0001) current = target;
    paint(dt);
    scheduleFrame();
  }

  function scheduleFrame() {
    if (frame === null && inView && !document.hidden && !reduceMotion?.matches) {
      frame = requestAnimationFrame(animate);
    }
  }

  function refreshPlayback() {
    if (document.hidden || !inView || reduceMotion?.matches) stopFrames();
    if (reduceMotion?.matches) {
      current = target;
      paint(0);
    } else {
      scheduleFrame();
    }
  }

  const powerValue = $('power');
  const powerExponent = document.createElement('sup');
  powerValue.replaceChildren('10', powerExponent);
  const scale = $('civilization-scale');
  const powerSlider = $('exponent');
  const presets = [...$('presets').querySelectorAll('button')];

  function update(exponent, syncCustomPower = true) {
    const k = (exponent - 6) / 10;
    const watts = 10 ** exponent;
    const next = k < 1 ? 1 : k < 2 ? 2 : 3;
    const ratio = 10 ** (next * 10 + 6 - exponent);
    set('level', k.toFixed(2));
    powerExponent.textContent = exponent.toFixed(2);
    set('exponent-label', '10^' + exponent.toFixed(2) + ' W');
    set('gap', ratio < 10000 ? ratio.toLocaleString('zh-CN', { maximumFractionDigits: 1 }) : '10^' + Math.log10(ratio).toFixed(1));
    set('gap-label', k >= 3 ? '已达到 III 型参照' : `到 ${['', 'I', 'II', 'III'][next]} 型的功率倍数`);
    set('level-statement', `K = (log₁₀ P − 6) / 10。当前功率约为 ${watts.toExponential(2)} W；功率指数每增加 1，功率增大 10 倍。`);
    scale.value = k;
    powerSlider.value = exponent;
    if (syncCustomPower) $('custom-power').value = watts.toExponential(3);
    set('power-error', '');
    target = k;
    if (reduceMotion?.matches) {
      current = target;
      paint(0);
    } else {
      scheduleFrame();
    }
    for (const button of presets) button.setAttribute('aria-pressed', String(Math.abs(Number(button.dataset.p) - exponent) < 0.01));
  }

  powerSlider.addEventListener('input', () => update(powerSlider.valueAsNumber));
  scale.addEventListener('input', () => update(6 + scale.valueAsNumber * 10));
  for (const tick of document.querySelectorAll('.scale-ticks button')) {
    tick.addEventListener('click', () => update(6 + Number(tick.dataset.level) * 10));
  }
  for (const button of presets) button.addEventListener('click', () => update(Number(button.dataset.p)));
  on('power-form', 'submit', event => {
    event.preventDefault();
    const raw = $('custom-power').value.trim();
    const watts = Number(raw);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(watts) || watts < 1e6 || watts > 1e36) {
      set('power-error', '请输入 10⁶ 到 10³⁶ 之间的正功率，例如 2e13。');
      return;
    }
    update(Math.log10(watts), false);
  });

  reduceMotion?.addEventListener?.('change', refreshPlayback);
  document.addEventListener('visibilitychange', refreshPlayback);
  window.addEventListener('pagehide', stopFrames);
  window.addEventListener('pageshow', refreshPlayback);
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      refreshPlayback();
    });
    observer.observe(cosmos);
  }
  paint(0);
  update(initialExponent);
})();
