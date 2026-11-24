(() => {
  'use strict';

  const CARD_WIDTH = 158;
  const CARD_HEIGHT = 54;
  const COLUMN_STEP = 184;
  const ROW_STEP = 83;
  const FLOAT_HEIGHT = 3;
  const FOCUS_DURATION = 480;

  function nodeBox(x, y, width, height) {
    return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
  }

  function edgePath(from, to, horizontal) {
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    if (horizontal) {
      const side = Math.sign(dx);
      const x1 = from.cx + side * from.width / 2;
      const x2 = to.cx - side * to.width / 2;
      const bend = Math.max(16, Math.min(100, Math.abs(x2 - x1) * .42));
      return [[x1, from.cy], [x1 + bend * side, from.cy], [x2 - bend * side, to.cy], [x2, to.cy]];
    }
    const side = Math.sign(dy);
    const y1 = from.cy + side * from.height / 2;
    const y2 = to.cy - side * to.height / 2;
    const bend = Math.max(14, Math.min(100, Math.abs(y2 - y1) * .42));
    return [[from.cx, y1], [from.cx, y1 + bend * side], [to.cx, y2 - bend * side], [to.cx, y2]];
  }

  function pointOnCurve(points, t) {
    const k = 1 - t;
    return [0, 1].map(i => k ** 3 * points[0][i] + 3 * k ** 2 * t * points[1][i] +
      3 * k * t ** 2 * points[2][i] + t ** 3 * points[3][i]);
  }

  function distanceToSegment(x, y, [ax, ay], [bx, by]) {
    const dx = bx - ax;
    const dy = by - ay;
    const span = dx ** 2 + dy ** 2;
    const offset = span ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / span)) : 0;
    return Math.hypot(x - ax - offset * dx, y - ay - offset * dy);
  }

  function compactLayout(main, external) {
    const columns = [...new Set(main.map(person => person.x))].sort((a, b) => a - b);
    const ranks = columns.map(x => main.filter(person => person.x === x).sort((a, b) => a.y - b.y));
    if (external.length) ranks.push(external);
    const rowCount = Math.max(...ranks.map(rank => rank.length), 1);
    const boxes = new Map();

    ranks.forEach((rank, column) => {
      const heights = rank.map(person => person.y);
      const distinct = Math.max(...heights) !== Math.min(...heights);
      const gap = rank.length > 1 && distinct ? Math.min(1.22, rowCount / rank.length) : 1;
      const top = 34 + (rowCount - 1 - gap * (rank.length - 1)) * ROW_STEP / 2;
      rank.forEach((person, row) => {
        boxes.set(person.id, nodeBox(28 + column * COLUMN_STEP, top + row * ROW_STEP * gap, CARD_WIDTH, CARD_HEIGHT));
      });
    });
    return { boxes, width: 38 + ranks.length * COLUMN_STEP, height: 72 + (rowCount - 1) * ROW_STEP + CARD_HEIGHT };
  }

  function titleNode(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }

  window.AtlasGraph = class AtlasGraph {
    constructor({ stage, canvas, nodes, onTopic, onPerson, onEdge }) {
      Object.assign(this, { stage, canvas, nodes, onTopic, onPerson, onEdge });
      this.ctx = canvas.getContext('2d');
      this.camera = { x: 0, y: 0, scale: 1 };
      this.edgeHits = [];
      this.pointers = new Map();
      this.frame = null;
      this.stageVisible = true;
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion.addEventListener('change', () => this.schedule());
      this.stage.addEventListener('pointerdown', event => this.startPan(event));
      this.stage.addEventListener('pointermove', event => this.move(event));
      this.stage.addEventListener('pointerup', event => this.finishPan(event));
      this.stage.addEventListener('pointercancel', event => this.finishPan(event));
      this.stage.addEventListener('pointerleave', () => this.hover(null));
      this.stage.addEventListener('wheel', event => {
        if (!this.focused || (!event.ctrlKey && !event.metaKey)) return;
        event.preventDefault();
        const [x, y] = this.stagePoint(event);
        this.zoom(Math.exp(-event.deltaY / 320), x, y);
      }, { passive: false });
      this.resizeObserver = new ResizeObserver(entries => {
        this.overviewBoxes = null;
        if (!entries.some(entry => entry.target === stage)) this.schedule();
        else if (this.focused && this.selected) this.centerPerson(this.selected, Boolean(this.cameraMotion));
        else this.fit();
      });
      this.resizeObserver.observe(stage);
      new IntersectionObserver(([entry]) => {
        this.stageVisible = entry.isIntersecting;
        this.schedule();
      }).observe(stage);
      window.addEventListener('site-theme-change', () => {
        this.palette = null;
        this.schedule();
      });
    }

    overview(topics, connections) {
      this.releaseOverviewMeasurements();
      this.focused = false;
      this.cameraMotion = null;
      this.stage.classList.remove('is-focused');
      this.stage.classList.remove('is-over-edge');
      this.nodes.className = 'map-nodes is-overview';
      this.nodes.style.transform = '';
      this.hovered = null;
      this.connections = connections;
      this.buttons = new Map(topics.map(topic => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'topic-node';
        button.dataset.topicId = topic.id;
        button.style.setProperty('--node-accent', `var(--theme-${topic.color})`);
        button.append(titleNode('strong', topic.title), titleNode('small', `${topic.count} 位人物${topic.books ? ' · 含典籍' : ''}`));
        button.addEventListener('click', () => this.onTopic(topic.id));
        return [topic.id, button];
      }));
      this.nodes.replaceChildren(...this.buttons.values());
      for (const button of this.buttons.values()) this.resizeObserver.observe(button);
      this.schedule();
    }

    detail({ main, external, edges, selected, activeEdge, related, preserveCamera, animateFocus }) {
      const focusedNode = this.nodes.contains(document.activeElement) ? document.activeElement.dataset.personId : null;
      const keepView = this.focused && preserveCamera;
      const continueFocus = keepView && Boolean(this.cameraMotion);
      const oldAnchor = keepView && this.layout.boxes.get(selected);
      this.releaseOverviewMeasurements();
      this.focused = true;
      this.stage.classList.add('is-focused');
      this.nodes.className = 'map-nodes';
      this.layout = compactLayout(main, external);
      this.connections = edges;
      this.selected = selected;
      this.activeEdge = activeEdge;
      this.hovered = null;
      this.stage.classList.remove('is-over-edge');
      this.buttons = new Map([...main, ...external].map(person => {
        const button = document.createElement('button');
        const box = this.layout.boxes.get(person.id);
        const isExternal = external.includes(person);
        button.type = 'button';
        button.className = 'person-node';
        button.dataset.personId = person.id;
        button.classList.toggle('is-external', isExternal);
        button.classList.toggle('is-related', related.has(person.id));
        button.classList.toggle('is-dim', Boolean(selected && person.id !== selected && !related.has(person.id)));
        button.setAttribute('aria-pressed', String(person.id === selected));
        button.title = `${person.name} · ${person.dates}`;
        Object.assign(button.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` });
        button.append(titleNode('strong', person.shortName || person.name), titleNode('small', isExternal ? `↗ ${person.topicTitle}` : person.dates));
        button.addEventListener('click', () => this.onPerson(person.id));
        button.addEventListener('focus', () => this.reveal(person.id));
        return [person.id, button];
      }));
      this.nodes.replaceChildren(...this.buttons.values());
      if (!keepView) this.fit();
      const newAnchor = this.layout.boxes.get(selected);
      if (oldAnchor && newAnchor) {
        this.camera.x += (oldAnchor.cx - newAnchor.cx) * this.camera.scale;
        this.camera.y += (oldAnchor.cy - newAnchor.cy) * this.camera.scale;
      }
      if (selected && (animateFocus || continueFocus || !keepView)) {
        this.centerPerson(selected, animateFocus || continueFocus);
      } else if (!selected) this.cameraMotion = null;
      this.schedule();
      if (focusedNode) this.buttons.get(focusedNode)?.focus({ preventScroll: true });
    }

    releaseOverviewMeasurements() {
      if (this.focused || !this.buttons) return;
      for (const button of this.buttons.values()) this.resizeObserver.unobserve(button);
      this.overviewBoxes = null;
    }

    fittedCamera() {
      const width = this.stage.clientWidth;
      const height = this.stage.clientHeight;
      const { width: graphWidth, height: graphHeight } = this.layout;
      const scale = Math.max(.12, Math.min(1.12, (width - 22) / graphWidth, (height - 22) / graphHeight));
      return { scale, x: (width - graphWidth * scale) / 2, y: (height - graphHeight * scale) / 2 };
    }

    fit() {
      this.cameraMotion = null;
      if (this.focused) this.camera = this.fittedCamera();
      this.schedule();
    }

    centerPerson(id, animate) {
      const box = this.layout.boxes.get(id);
      if (!box) return;
      const width = this.stage.clientWidth;
      const readableScale = width < 440 ? .76 : .88;
      const scale = Math.max(this.camera.scale, readableScale, Math.min(1.38, this.fittedCamera().scale * 1.24));
      const to = { x: width / 2 - box.cx * scale, y: this.stage.clientHeight / 2 - box.cy * scale, scale };
      if (animate && !this.reducedMotion.matches) {
        this.cameraMotion = { from: { ...this.camera }, to, startedAt: null };
      } else {
        this.cameraMotion = null;
        this.camera = to;
      }
      this.schedule();
    }

    advanceCamera(time) {
      const motion = this.cameraMotion;
      if (!motion) return;
      motion.startedAt ??= time;
      const progress = this.reducedMotion.matches ? 1 : Math.min(1, (time - motion.startedAt) / FOCUS_DURATION);
      const eased = progress * progress * (3 - 2 * progress);
      const { from, to } = motion;
      this.camera = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        scale: from.scale + (to.scale - from.scale) * eased,
      };
      if (progress === 1) this.cameraMotion = null;
    }

    reveal(id) {
      const box = this.layout?.boxes.get(id);
      if (!box || !this.focused || (this.cameraMotion && id === this.selected)) return;
      const { x, y, scale } = this.camera;
      if (box.x * scale + x >= 0 && (box.x + box.width) * scale + x <= this.stage.clientWidth &&
          box.y * scale + y >= 0 && (box.y + box.height) * scale + y <= this.stage.clientHeight) return;
      this.cameraMotion = null;
      this.camera.x = this.stage.clientWidth / 2 - box.cx * scale;
      this.camera.y = this.stage.clientHeight / 2 - box.cy * scale;
      this.schedule();
    }

    stagePoint(event) {
      const rect = this.stage.getBoundingClientRect();
      return [event.clientX - rect.left - this.stage.clientLeft, event.clientY - rect.top - this.stage.clientTop];
    }

    zoom(factor, x = this.stage.clientWidth / 2, y = this.stage.clientHeight / 2) {
      if (!this.focused) return;
      this.cameraMotion = null;
      const oldScale = this.camera.scale;
      const scale = Math.min(2.8, Math.max(.12, oldScale * factor));
      this.camera.x = x - (x - this.camera.x) * scale / oldScale;
      this.camera.y = y - (y - this.camera.y) * scale / oldScale;
      this.camera.scale = scale;
      this.schedule();
    }

    startPan(event) {
      if (!this.focused || event.target.closest('button') || event.button !== 0) return;
      this.cameraMotion = null;
      const point = this.stagePoint(event);
      this.pointers.set(event.pointerId, point);
      this.dragStart = point;
      this.didPan = this.pointers.size > 1;
      this.stage.setPointerCapture(event.pointerId);
    }

    move(event) {
      if (!this.focused) return;
      const [x, y] = this.stagePoint(event);
      if (!this.pointers.has(event.pointerId)) {
        this.hover(event.target.closest('button') ? null : this.edgeNear(x, y));
        return;
      }
      const [px, py] = this.pointers.get(event.pointerId);
      const other = [...this.pointers].find(([id]) => id !== event.pointerId)?.[1];
      this.pointers.set(event.pointerId, [x, y]);
      if (!this.didPan && Math.hypot(x - this.dragStart[0], y - this.dragStart[1]) < 5) return;
      this.didPan = true;
      this.stage.classList.add('is-panning');
      this.camera.x += (x - px) / (other ? 2 : 1);
      this.camera.y += (y - py) / (other ? 2 : 1);
      if (other) {
        const distance = Math.hypot(other[0] - px, other[1] - py);
        if (distance > 8) this.zoom(Math.hypot(other[0] - x, other[1] - y) / distance, (x + other[0]) / 2, (y + other[1]) / 2);
      }
      this.schedule();
    }

    finishPan(event) {
      if (!this.pointers.delete(event.pointerId)) return;
      if (this.pointers.size) return;
      this.stage.classList.remove('is-panning');
      if (!this.didPan && event.type === 'pointerup') {
        const edge = this.edgeNear(...this.stagePoint(event));
        if (edge) this.onEdge(edge.id);
      }
    }

    hover(edge) {
      const id = edge?.id ?? null;
      if (id === this.hovered) return;
      this.hovered = id;
      this.stage.classList.toggle('is-over-edge', Boolean(id));
      this.schedule();
    }

    edgeNear(x, y) {
      x = (x - this.camera.x) / this.camera.scale;
      y = (y - this.camera.y) / this.camera.scale;
      let distance = 9 / this.camera.scale;
      let nearest = null;
      for (const { edge, samples } of this.edgeHits) {
        for (let i = 1; i < samples.length; i++) {
          const current = distanceToSegment(x, y, samples[i - 1], samples[i]);
          if (current >= distance) continue;
          distance = current;
          nearest = edge;
        }
      }
      return nearest;
    }

    schedule() {
      if (this.frame !== null) return;
      this.frame = requestAnimationFrame(time => {
        this.frame = null;
        this.advanceCamera(time);
        const floating = this.ctx && this.stageVisible && !this.reducedMotion.matches;
        this.draw(time, floating);
        if (this.cameraMotion || (floating && this.buttons?.size)) this.schedule();
      });
    }

    baseBoxes() {
      if (this.focused) return this.layout.boxes;
      if (!this.overviewBoxes) {
        const left = this.nodes.offsetLeft;
        const top = this.nodes.offsetTop;
        this.overviewBoxes = new Map([...this.buttons].map(([id, button]) => [id,
          nodeBox(left + button.offsetLeft, top + button.offsetTop, button.offsetWidth, button.offsetHeight),
        ]));
      }
      return this.overviewBoxes;
    }

    floatBoxes(base, time, amplitude) {
      const boxes = new Map();
      let index = 0;
      for (const [id, button] of this.buttons) {
        const box = base.get(id);
        const period = 6700 + (index % 5) * 430;
        const lift = amplitude * Math.sin(time * 2 * Math.PI / period + index * 2.4);
        button.style.transform = amplitude ? `translateY(${lift}px)` : '';
        boxes.set(id, nodeBox(box.x, box.y + lift, box.width, box.height));
        index++;
      }
      return boxes;
    }

    draw(time, floating) {
      const ctx = this.ctx;
      if (!ctx || !this.buttons) return;
      const width = this.stage.clientWidth;
      const height = this.stage.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!this.palette) {
        const style = getComputedStyle(this.stage);
        this.palette = Object.fromEntries(['thread', 'mentor', 'collaboration', 'debate', 'influence', 'history', 'paper', 'ink'].map(key => [key, style.getPropertyValue(`--${key}`).trim()]));
      }
      const palette = this.palette;
      const scale = this.focused ? this.camera.scale : 1;
      const base = this.baseBoxes();
      const boxes = this.floatBoxes(base, time, floating ? Math.min(4, FLOAT_HEIGHT / scale) : 0);
      if (this.focused) {
        const { x, y } = this.camera;
        this.nodes.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        ctx.translate(x, y);
        ctx.scale(scale, scale);
      }
      const edges = this.connections.map(edge => ({
        edge,
        strength: this.focused ? (edge.id === this.hovered || edge.id === this.activeEdge ? 3 : !this.selected || [edge.from, edge.to].includes(this.selected) ? 2 : 0) : 1,
      })).sort((a, b) => a.strength - b.strength);
      this.edgeHits = [];
      const labels = [];

      for (const { edge, strength } of edges) {
        const from = boxes.get(edge.from);
        const to = boxes.get(edge.to);
        if (!from || !to) continue;
        const baseFrom = base.get(edge.from);
        const baseTo = base.get(edge.to);
        const horizontal = Math.abs(baseTo.cx - baseFrom.cx) > Math.abs(baseTo.cy - baseFrom.cy) * .75;
        const points = edgePath(from, to, horizontal);
        const color = palette[edge.category] || palette.thread;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = this.focused ? [0.17, 0.5, this.selected ? .85 : .5, 1][strength] : Math.min(.62, .22 + edge.count * .055);
        ctx.lineWidth = (strength === 3 ? 2.5 : this.focused ? 1.45 : Math.min(2.5, 1 + edge.count * .12)) / scale;
        ctx.beginPath();
        ctx.moveTo(...points[0]);
        ctx.bezierCurveTo(...points[1], ...points[2], ...points[3]);
        ctx.stroke();
        if (this.focused) {
          const samples = Array.from({ length: 13 }, (_, i) => pointOnCurve(points, i / 12));
          this.edgeHits.push({ edge, samples });
          if (edge.directed) this.arrow(points, scale);
          if (strength === 3 || (scale >= 1.18 && strength === 2)) labels.push({ label: edge.label, points });
        }
      }
      ctx.globalAlpha = 1;
      for (const { label, points } of labels) {
        const [x, y] = pointOnCurve(points, .5);
        ctx.font = `${12 / scale}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const span = ctx.measureText(label).width + 12 / scale;
        ctx.fillStyle = palette.paper;
        ctx.fillRect(x - span / 2, y - 10 / scale, span, 20 / scale);
        ctx.fillStyle = palette.ink;
        ctx.fillText(label, x, y);
      }
    }

    arrow(points, scale) {
      const [x, y] = points[3];
      const angle = Math.atan2(y - points[2][1], x - points[2][0]);
      const size = 6.5 / scale;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x - size * Math.cos(angle - .47), y - size * Math.sin(angle - .47));
      this.ctx.lineTo(x - size * Math.cos(angle + .47), y - size * Math.sin(angle + .47));
      this.ctx.fill();
    }
  };
})();
