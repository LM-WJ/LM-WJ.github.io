(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const data = window.MathAtlasData;
  if (!data || !window.AtlasGraph) {
    $('graph-error').hidden = false;
    return;
  }
  const TOPIC_PREVIEW_DURATION = 720;
  const CLASSIC_TEXT_ID = 'p-jiuzhang';

  const categories = {
    mentor: '师承与提携', collaboration: '合作与通信', debate: '争论与竞争',
    influence: '影响与发展', history: '译注与历史',
  };
  const knownNames = {
    newton: ['牛顿', 'Isaac Newton'], leibniz: ['莱布尼茨', '莱布尼兹', 'Gottfried Leibniz'],
    euler: ['欧拉', 'Leonhard Euler'], gauss: ['高斯', 'Carl Friedrich Gauss'],
    einstein: ['爱因斯坦', 'Albert Einstein'], riemann: ['黎曼', 'Bernhard Riemann'],
    fermat: ['费马', 'Pierre de Fermat'], godel: ['哥德尔', 'Kurt Gödel', 'Godel'],
    fourier: ['傅里叶', 'Joseph Fourier'], lagrange: ['拉格朗日', 'Joseph-Louis Lagrange'],
    'de-lhopital': ['洛必达', "L'Hôpital"], yang: ['杨振宁', 'Chen-Ning Yang', 'Yang Zhenning'],
    chern: ['陈省身', 'Shiing-Shen Chern', 'Chen Shengshen'],
    yau: ['丘成桐', 'Shing-Tung Yau', 'Qiu Chengtong'],
    'hua-luogeng': ['华罗庚', 'Hua Luogeng', 'Hua Loo-Keng'],
    'xu-guangqi': ['徐光启', 'Xu Guangqi'], ricci: ['利玛窦', 'Matteo Ricci'],
    feynman: ['费曼', 'Richard Feynman'], bohr: ['玻尔', 'Niels Bohr'], hilbert: ['希尔伯特', 'David Hilbert'],
    'noether-emmy': ['诺特', 'Emmy Noether'], kovalevskaya: ['柯瓦列夫斯卡娅', 'Sofia Kovalevskaya'],
    turing: ['图灵', 'Alan Turing'], shannon: ['香农', 'Claude Shannon'],
    'von-neumann': ['冯·诺伊曼', 'John von Neumann'], lovelace: ['洛夫莱斯', 'Ada Lovelace'],
    schwarzschild: ['史瓦西', '施瓦西', 'Karl Schwarzschild'], maxwell: ['麦克斯韦', 'James Clerk Maxwell'],
    wallis: ['沃利斯', '华里士', 'John Wallis'], abel: ['阿贝尔', 'Niels Henrik Abel'],
  };
  const routeDefinitions = [
    { title: '《几何原本》如何来到中国', summary: '欧几里得到徐光启', path: ['euclid', 'clavius', 'ricci', 'xu-guangqi'] },
    { title: '微积分的两条起跑线', summary: '牛顿、莱布尼茨与伯努利', path: ['barrow', 'newton', 'leibniz', 'bernoulli-johann', 'euler'] },
    { title: '从黎曼几何到引力', summary: '曲率与张量如何进入相对论', path: ['riemann', 'christoffel', 'ricci-curbastro', 'grossmann', 'einstein'] },
  ];
  const topicById = new Map(data.topics.map(topic => [topic.id, {
    ...topic, people: [], count: 0, books: 0, within: 0, cross: 0,
  }]));
  const people = new Map(data.people.map(person => {
    const names = knownNames[person.id.slice(2)] || [];
    const topic = topicById.get(person.topic);
    return [person.id, { ...person, shortName: names[0], aliases: names, topicTitle: topic.title }];
  }));
  const edges = new Map(data.relations.map(edge => [edge.id, edge]));
  const neighbors = new Map([...people.keys()].map(id => [id, []]));
  for (const person of people.values()) {
    const topic = topicById.get(person.topic);
    topic.people.push(person);
    if (person.id === CLASSIC_TEXT_ID) topic.books++;
    else topic.count++;
  }
  for (const edge of edges.values()) {
    neighbors.get(edge.from).push(edge);
    neighbors.get(edge.to).push(edge);
    const from = topicById.get(people.get(edge.from).topic);
    const to = topicById.get(people.get(edge.to).topic);
    if (from === to) from.within++;
    else { from.cross++; to.cross++; }
  }

  function otherEnd(edge, id) {
    return edge.from === id ? edge.to : edge.from;
  }

  const routes = routeDefinitions.map(route => {
    const path = route.path.map(slug => people.get(`p-${slug}`));
    if (path.some(person => !person)) return null;
    const segments = path.slice(1).map((person, i) => neighbors.get(person.id).find(edge => otherEnd(edge, person.id) === path[i].id));
    return segments.every(Boolean) ? { ...route, path, segments } : null;
  }).filter(Boolean);

  const filter = new Set(Object.keys(categories));
  let currentTopic = null;
  let currentPerson = null;
  let currentEdge = null;
  let routeState = null;
  let playback = null;
  let topicFocusTimer = null;
  let results = [];
  let activeResult = -1;

  const graph = new window.AtlasGraph({
    stage: $('map-stage'), canvas: $('map-lines'), nodes: $('map-nodes'),
    onTopic: id => openTopic(id, { moveFocus: true, autoFocus: true }), onPerson: openPerson, onEdge: openEdge,
  });
  const mobile = window.matchMedia('(max-width: 780px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function button(text, className, handler) {
    const node = element('button', text, className);
    node.type = 'button';
    if (handler) node.addEventListener('click', handler);
    return node;
  }

  function sourceLinks(references, className) {
    const group = element('div', '', className);
    for (const source of references) {
      const link = element('a', `${source.label} ↗`);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      group.append(link);
    }
    return group;
  }

  function filteredEdges() {
    return data.relations.filter(edge => filter.has(edge.category));
  }

  function topicConnections(relations) {
    const pairs = new Map();
    for (const edge of relations) {
      const a = people.get(edge.from).topic;
      const b = people.get(edge.to).topic;
      if (a === b) continue;
      const [from, to] = [a, b].sort();
      const key = `${from}/${to}`;
      if (!pairs.has(key)) pairs.set(key, { from, to, count: 0 });
      pairs.get(key).count++;
    }
    return [...pairs.values()];
  }

  function drawGraph({ preserveCamera = false, animateFocus = false } = {}) {
    const visible = filteredEdges();
    if (!currentTopic) {
      graph.overview([...topicById.values()], topicConnections(visible));
      return;
    }
    const topic = topicById.get(currentTopic);
    const selection = currentPerson ? new Set([currentPerson]) : new Set();
    const chosenEdge = edges.get(currentEdge);
    if (chosenEdge && filter.has(chosenEdge.category)) {
      selection.add(chosenEdge.from);
      selection.add(chosenEdge.to);
    }
    const related = new Set();
    for (const edge of visible) {
      if (currentPerson && (edge.from === currentPerson || edge.to === currentPerson)) related.add(otherEnd(edge, currentPerson));
    }
    for (const id of selection) related.add(id);
    const external = [...related].map(id => people.get(id)).filter(person => person.topic !== topic.id);
    const topicPeople = new Set(topic.people.map(person => person.id));
    const ids = new Set([...topicPeople, ...external.map(person => person.id)]);
    const displayed = visible.filter(edge => ids.has(edge.from) && ids.has(edge.to) &&
      ((topicPeople.has(edge.from) && topicPeople.has(edge.to)) || edge.id === currentEdge ||
        (currentPerson && [edge.from, edge.to].includes(currentPerson))));
    graph.detail({
      main: topic.people, external, edges: displayed, selected: currentPerson, activeEdge: currentEdge,
      related, preserveCamera, animateFocus,
    });
  }

  function updateMapHeading() {
    const topic = topicById.get(currentTopic);
    $('map-title').textContent = topic ? topic.title : '主题总览';
    $('map-description').textContent = topic ? `${topic.description} · ${topic.count} 位人物` : '选择主题，展开其中的人物与关系。';
    $('map-tools').hidden = !topic;
    $('topic-select').value = currentTopic || '';
    $('overview-button').setAttribute('aria-pressed', String(!topic));
    $('clear-person').hidden = !currentPerson && !currentEdge;
  }

  function relatedButton(person) {
    const item = element('li');
    const action = button('', 'person-option', () => openPerson(person.id));
    action.append(element('strong', person.name), element('small', person.description));
    item.append(action);
    return item;
  }

  function relationshipEvidence(edge, withNavigation) {
    const block = element('div', '', 'relationship-evidence');
    block.append(element('p', edge.detail || edge.label));
    block.append(sourceLinks(edge.sources));
    if (withNavigation) {
      const destination = people.get(otherEnd(edge, currentPerson));
      const label = destination.topic === currentTopic ? '查看人物' : '前往关联主题';
      const jump = button(`${label} · ${destination.shortName || destination.name} ↗`, 'plain-link', () => openPerson(destination.id));
      block.append(jump);
    }
    return block;
  }

  function edgeEntry(edge, person) {
    const target = people.get(otherEnd(edge, person.id));
    const active = currentEdge === edge.id;
    const item = element('li');
    const action = button('', 'relation-entry', () => {
      currentEdge = active ? null : edge.id;
      drawGraph({ preserveCamera: true });
      renderPanel();
    });
    action.dataset.keepFocus = `edge-${edge.id}`;
    action.setAttribute('aria-expanded', String(active));
    action.style.setProperty('--relation-color', `var(--${edge.category})`);
    const text = element('span');
    text.append(element('strong', target.name), element('small', edge.label));
    action.append(text, element('span', target.topic === currentTopic ? (active ? '−' : '+') : '↗', 'route-arrow'));
    item.append(action);
    if (active) item.append(relationshipEvidence(edge, true));
    return item;
  }

  function renderRoutes() {
    const list = element('ul', '', 'route-list');
    routes.forEach(route => {
      const item = element('li');
      const action = button('', 'route-option', () => startRoute(route));
      const text = element('span');
      text.append(element('strong', route.title), element('small', route.summary));
      action.append(text, element('span', '→', 'route-arrow'));
      item.append(action);
      list.append(item);
    });
    return [element('h2', '从一条线索开始'), element('p', '逐步查看人物、事件和原始出处。', 'panel-description'), list];
  }

  function renderRoute() {
    const { route, step } = routeState;
    const controls = element('div', '', 'panel-actions');
    const previous = button('上一步', 'control-button', () => goToStep(step - 1));
    previous.disabled = step === 0;
    previous.dataset.keepFocus = 'route-previous';
    const next = button('下一步', 'control-button', () => goToStep(step + 1));
    next.disabled = step === route.path.length - 1;
    next.dataset.keepFocus = 'route-next';
    const play = button(playback ? '暂停' : '播放', 'control-button', togglePlayback);
    play.dataset.keepFocus = 'route-play';
    const end = button('结束路线', 'control-button', () => openTopic(null));
    controls.append(previous, next, play, end);
    const steps = element('ol', '', 'route-steps');
    route.path.forEach((person, index) => {
      const item = element('li');
      const action = button(person.shortName || person.name, 'plain-link', () => goToStep(index));
      action.dataset.keepFocus = `route-step-${index}`;
      if (index === step) action.setAttribute('aria-current', 'step');
      item.append(action);
      steps.append(item);
    });
    return [element('p', `第 ${step + 1} 步 / 共 ${route.path.length} 步`, 'panel-kicker'),
      element('h2', route.title), controls, steps];
  }

  function renderPerson(person) {
    const items = routeState ? renderRoute() : [];
    const title = element(routeState ? 'h3' : 'h2', person.name);
    const about = element('p', `${person.dates} · ${person.description}`, 'panel-description');
    items.push(element('p', person.topicTitle, 'panel-kicker'), title, about, sourceLinks(person.sources, 'panel-links'));
    const connections = neighbors.get(person.id).filter(edge => filter.has(edge.category));
    const label = `直接关系 · ${connections.length} 条`;
    const list = element('ul', '', 'relation-list');
    for (const edge of connections) list.append(edgeEntry(edge, person));
    items.push(element('h3', label, 'list-heading'), connections.length ? list : element('p', '当前筛选没有匹配的关系。', 'panel-description'));
    return items;
  }

  function renderTopic(topic) {
    const list = element('ul', '', 'person-list');
    topic.people.forEach(person => list.append(relatedButton(person)));
    return [element('h2', '主题索引'), element('p', `${topic.within} 条区内关系 · ${topic.cross} 条跨区关系`, 'panel-description'), list];
  }

  function renderEdge(edge) {
    const endpoints = element('p', '', 'panel-description');
    [edge.from, edge.to].forEach((id, index) => {
      const person = people.get(id);
      if (index) endpoints.append(edge.directed ? ' → ' : ' — ');
      endpoints.append(button(person.name, 'plain-link', () => openPerson(id)));
    });
    return [element('p', categories[edge.category], 'panel-kicker'), element('h2', edge.label), endpoints, relationshipEvidence(edge, false)];
  }

  function renderPanel(reset = false) {
    const inspector = $('inspector');
    const focus = inspector.contains(document.activeElement) ? document.activeElement.dataset.keepFocus : null;
    const scrollTop = reset ? 0 : inspector.scrollTop;
    const person = people.get(currentPerson);
    const topic = topicById.get(currentTopic);
    const edge = edges.get(currentEdge);
    inspector.replaceChildren(...(person ? renderPerson(person) : edge ? renderEdge(edge) : topic ? renderTopic(topic) : renderRoutes()));
    inspector.scrollTop = scrollTop;
    if (focus) [...inspector.querySelectorAll('[data-keep-focus]')].find(node => node.dataset.keepFocus === focus)?.focus({ preventScroll: true });
  }

  function writeLocation() {
    const fragment = currentPerson || (currentTopic ? `theme-${currentTopic}` : '');
    const url = new URL(location.href);
    url.hash = fragment;
    if (url.href === location.href) return;
    try { history.replaceState(null, '', url); } catch { /* Direct file preview still supports every interaction. */ }
  }

  function updateView({ preserveCamera = false, animateFocus = false, resetPanel = true, locationChange = true } = {}) {
    updateMapHeading();
    drawGraph({ preserveCamera, animateFocus });
    renderPanel(resetPanel);
    if (locationChange) writeLocation();
  }

  function mostConnectedPerson(topic) {
    const ids = new Set(topic.people.map(person => person.id));
    ids.delete(CLASSIC_TEXT_ID);
    let best = null;
    let largest = 0;
    for (const id of ids) {
      const connected = new Set(neighbors.get(id)
        .filter(edge => filter.has(edge.category))
        .map(edge => otherEnd(edge, id))
        .filter(neighbor => ids.has(neighbor)));
      if (connected.size > largest) {
        best = id;
        largest = connected.size;
      }
    }
    return best;
  }

  function cancelTopicFocus() {
    clearTimeout(topicFocusTimer);
    topicFocusTimer = null;
  }

  function openTopic(id, { moveFocus = false, record = true, autoFocus = false } = {}) {
    cancelTopicFocus();
    closeResults();
    $('person-search').value = '';
    stopPlayback();
    routeState = null;
    currentTopic = id || null;
    currentPerson = null;
    currentEdge = null;
    updateView({ locationChange: record });
    if (moveFocus) $('map-title').focus({ preventScroll: true });
    if (autoFocus && currentTopic) {
      const person = mostConnectedPerson(topicById.get(currentTopic));
      if (person) topicFocusTimer = setTimeout(() => openPerson(person, { revealMap: false }), TOPIC_PREVIEW_DURATION);
    }
  }

  function openPerson(id, { animate = true, record = true, revealMap = true } = {}) {
    const person = people.get(id);
    if (!person) return;
    cancelTopicFocus();
    const sameTopic = currentTopic === person.topic;
    closeResults();
    $('person-search').value = '';
    stopPlayback();
    routeState = null;
    currentTopic = person.topic;
    currentPerson = id;
    currentEdge = null;
    updateView({ preserveCamera: sameTopic && animate, animateFocus: animate, locationChange: record });
    if (animate && revealMap && mobile.matches) {
      $('map-stage').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
    }
  }

  function scrollToDetails() {
    $('inspector').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
  }

  function openEdge(id) {
    const edge = edges.get(id);
    if (!edge) return;
    cancelTopicFocus();
    if (currentPerson && ![edge.from, edge.to].includes(currentPerson)) currentPerson = null;
    currentEdge = id;
    updateView({ preserveCamera: true, resetPanel: true });
    const expanded = $('inspector').querySelector('[aria-expanded="true"]');
    if (expanded) expanded.scrollIntoView({ block: 'nearest' });
    else if (mobile.matches) scrollToDetails();
  }

  function startRoute(route) {
    cancelTopicFocus();
    closeResults();
    stopPlayback();
    routeState = { route, step: 0 };
    goToStep(0);
  }

  function goToStep(index) {
    const { route, step } = routeState;
    if (!route.path[index]) return;
    routeState.step = index;
    const person = route.path[index];
    const sameTopic = currentTopic === person.topic;
    currentTopic = person.topic;
    currentPerson = person.id;
    currentEdge = index ? route.segments[index - 1].id : null;
    if (index === route.path.length - 1) stopPlayback();
    updateView({ preserveCamera: sameTopic, animateFocus: true, resetPanel: index === step });
  }

  function stopPlayback() {
    if (playback) clearInterval(playback);
    playback = null;
  }

  function togglePlayback() {
    if (playback) {
      stopPlayback();
    } else {
      if (routeState.step === routeState.route.path.length - 1) goToStep(0);
      playback = setInterval(() => goToStep(routeState.step + 1), 3800);
    }
    renderPanel();
  }

  const normalized = text => text.normalize('NFKD').toLowerCase().replace(/[\p{M}\s\p{P}]/gu, '');
  function search(query) {
    const key = normalized(query);
    if (!key) return [];
    return [...people.values()].flatMap(person => {
      const terms = [person.name, person.id.slice(2), ...person.aliases].map(normalized);
      const rank = terms.includes(key) ? 0 : terms.some(term => term.startsWith(key)) ? 1 : terms.some(term => term.includes(key)) ? 2 : null;
      return rank === null ? [] : [{ person, rank }];
    }).sort((a, b) => a.rank - b.rank || a.person.name.length - b.person.name.length).slice(0, 8).map(result => result.person);
  }

  function closeResults() {
    $('search-results').hidden = true;
    $('person-search').setAttribute('aria-expanded', 'false');
    $('person-search').removeAttribute('aria-activedescendant');
    activeResult = -1;
  }

  function paintSelection() {
    const items = $('search-results').querySelectorAll('[role="option"]');
    items.forEach((item, index) => item.setAttribute('aria-selected', String(index === activeResult)));
    const id = items[activeResult]?.id;
    if (id) $('person-search').setAttribute('aria-activedescendant', id);
    else $('person-search').removeAttribute('aria-activedescendant');
  }

  function pickResult(person) {
    openPerson(person.id);
    $('person-search').value = person.name;
  }

  function updateResults() {
    const input = $('person-search');
    const list = $('search-results');
    const query = input.value.trim();
    if (!query) {
      closeResults();
      $('search-status').textContent = '';
      return;
    }
    results = search(query);
    activeResult = -1;
    const items = results.map((person, index) => {
      const item = element('li');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.id = `search-result-${index}`;
      item.append(element('span', person.name), element('small', person.topicTitle));
      item.addEventListener('pointerdown', event => event.preventDefault());
      item.addEventListener('click', () => pickResult(person));
      return item;
    });
    if (!items.length) {
      const empty = element('li', '没有匹配的人物', 'no-result');
      empty.setAttribute('role', 'presentation');
      items.push(empty);
    }
    list.replaceChildren(...items);
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    $('search-status').textContent = results.length ? `显示 ${results.length} 条搜索结果` : '没有匹配的人物';
    paintSelection();
  }

  function readLocation() {
    const hash = location.hash.slice(1);
    const topic = hash.slice(6);
    if (people.has(hash)) openPerson(hash, { animate: false, record: false });
    else openTopic(hash.startsWith('theme-') && topicById.has(topic) ? topic : null, { record: false });
  }

  $('person-count').textContent = people.size - [...topicById.values()].reduce((total, topic) => total + topic.books, 0);
  $('topic-count').textContent = topicById.size;
  $('relation-count').textContent = edges.size;
  for (const topic of topicById.values()) {
    const option = element('option', topic.title);
    option.value = topic.id;
    $('topic-select').append(option);
  }
  for (const [key, label] of Object.entries(categories)) {
    const toggle = button(label, 'filter-button', () => {
      cancelTopicFocus();
      if (filter.has(key)) filter.delete(key);
      else filter.add(key);
      toggle.setAttribute('aria-pressed', String(filter.has(key)));
      if (edges.get(currentEdge)?.category === key && !filter.has(key)) currentEdge = null;
      updateView({ preserveCamera: true, resetPanel: false });
    });
    toggle.style.setProperty('--relation-color', `var(--${key})`);
    toggle.setAttribute('aria-pressed', 'true');
    $('relation-filters').append(toggle);
  }

  $('overview-button').addEventListener('click', () => openTopic(null));
  $('topic-select').addEventListener('change', event => openTopic(event.target.value, { autoFocus: true }));
  $('clear-person').addEventListener('click', () => openTopic(currentTopic));
  const stage = $('map-stage');
  stage.addEventListener('pointerdown', cancelTopicFocus);
  stage.addEventListener('focusin', cancelTopicFocus);
  stage.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) cancelTopicFocus();
  }, { passive: true });
  $('map-tools').addEventListener('click', cancelTopicFocus);
  $('zoom-in').addEventListener('click', () => graph.zoom(1.28));
  $('zoom-out').addEventListener('click', () => graph.zoom(1 / 1.28));
  $('fit-view').addEventListener('click', () => graph.fit());
  const searchInput = $('person-search');
  searchInput.addEventListener('input', () => {
    cancelTopicFocus();
    updateResults();
  });
  searchInput.addEventListener('focus', updateResults);
  searchInput.addEventListener('blur', closeResults);
  searchInput.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      closeResults();
      return;
    }
    if ($('search-results').hidden || !results.length) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      pickResult(results[Math.max(activeResult, 0)]);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      activeResult = Math.min(results.length - 1, Math.max(0, activeResult + step));
      paintSelection();
    }
  });
  window.SiteTheme?.subscribe(mode => {
    $('theme-toggle').textContent = mode === 'dark' ? '浅色模式' : '深色模式';
    $('theme-toggle').setAttribute('aria-pressed', String(mode === 'dark'));
  });
  $('theme-toggle').addEventListener('click', () => window.SiteTheme?.setMode(window.SiteTheme.getMode() === 'dark' ? 'light' : 'dark'));
  window.addEventListener('hashchange', readLocation);
  readLocation();
})();
