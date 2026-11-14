(function () {
  const D = window.SITE_DATA;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Theme */
  const root = document.documentElement;
  const themeBtns = document.querySelectorAll('[data-theme-set]');
  const applyTheme = (mode) => {
    if (mode === 'light' || mode === 'dark') root.dataset.theme = mode; else delete root.dataset.theme;
    themeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === mode)));
    try { mode === 'auto' ? localStorage.removeItem('theme') : localStorage.setItem('theme', mode); } catch (e) {}
  };
  applyTheme(root.dataset.theme || 'auto');
  themeBtns.forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.themeSet)));

  /* Mobile menu */
  const navBar = document.querySelector('.nav');
  const burger = navBar.querySelector('.burger');
  const setMenu = (open) => {
    navBar.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger.addEventListener('click', () => setMenu(!navBar.classList.contains('open')));
  navBar.querySelectorAll('#menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && navBar.classList.contains('open')) { setMenu(false); burger.focus(); } });
  document.addEventListener('click', (e) => { if (navBar.classList.contains('open') && !navBar.contains(e.target)) setMenu(false); });
  window.matchMedia('(max-width: 900px)').addEventListener('change', (e) => { if (!e.matches) setMenu(false); });

  /* Technologies state */
  const state = { step: 0, crashed: -1, lastCrash: '', eIdx: 0, traffic: 'Low', trace: -1, approved: false, sel: null, gFail: false, eco: 0 };
  const timers = {};
  const set = (patch) => { Object.assign(state, patch); render(); };

  const codeBlock = (lang, code) => `<div class="code"><p class="mono">${esc(lang)}</p><pre class="mono"><code>${esc(code)}</code></pre></div>`;
  const arrow = (cls, place) => `<div class="arrow ${cls || ''}"${place ? ` style="${place}"` : ''}><span></span><span></span></div>`;
  // Flow diagrams run left to right on wide screens and top to bottom on phones.
  const narrow = window.matchMedia('(max-width: 640px)');
  narrow.addEventListener('change', () => render());

  function renderSteps() {
    return D.steps.map((d, i) => `
      <button type="button" class="step" data-act="step" data-v="${i}" aria-pressed="${i === state.step}">
        <span class="mono">0${i + 1}</span><span class="step-name">${esc(d.name)}</span><span class="mono cat">${esc(d.category)}</span>
      </button>`).join('');
  }

  function renderElixir() {
    let flat = 0;
    const groups = D.groups.map((g) => `
      <div class="zone"><span class="zone-label">${esc(g.name)} supervisor</span><div class="procs">${g.children.map((c) => {
        const i = flat++;
        const down = state.crashed === i;
        return `<button type="button" class="proc${down ? ' down' : ''}" data-act="crash" data-v="${i}" data-group="${esc(g.name)}">
          <b>${esc(c.name)}</b><span>${down ? 'crashed, restarting…' : esc(c.sub)}</span></button>`;
      }).join('')}</div></div>`).join('');
    const note = state.crashed >= 0 ? 'Only the crashed process restarts. Its siblings keep running.'
      : state.lastCrash ? state.lastCrash + ' was restarted. Nothing else was affected.'
      : 'Select a process to crash it. Its supervisor restarts it.';
    return `<div class="scroll-x"><div class="tree">
        <div class="root-node"><b>Application</b><span class="mono">root supervisor</span></div>
        ${arrow()}<div class="groups">${groups}</div>
      </div></div>
      <p class="note mono">${esc(note)}</p>
      ${codeBlock('elixir', D.elixirCode[state.eIdx])}`;
  }

  function renderFlow(key) {
    const dg = D.diagrams(state)[key];
    const { trace, approved, gFail: fail } = state;
    const path = dg.path;
    const gateIdx = dg.gate ? path.indexOf(dg.gate) : -1;
    const waiting = gateIdx >= 0 && trace === gateIdx && !approved;
    const byId = {};
    dg.nodes.forEach((n, k) => { n.c = 2 * k + 1; byId[n.id] = n; });
    const sel = state.sel && byId[state.sel] ? state.sel : dg.nodes[0].id;
    const hotNodes = fail ? ({ gcp: ['lb', 'svc'], eventsourcing: ['store', 'proj', 'read'] }[key] || []) : [];
    const hotEdges = fail ? ({ gcp: ['lb-svc'], eventsourcing: ['store-proj', 'proj-read'] }[key] || []) : [];
    const hotText = { lb: 'unhealthy instance found', svc: 'replacing instance', store: 'streaming every event', proj: 'rebuilding', read: 'rebuilt from events' };
    const items = [];
    const vert = narrow.matches;
    const at = (span) => vert ? `grid-row:${span};grid-column:1` : `grid-column:${span};grid-row:1`;

    (dg.zones || []).forEach((z) => items.push(`<div class="zone" style="${at(z.c)}"><span class="zone-label">${esc(z.label)}</span></div>`));
    dg.nodes.slice(0, -1).forEach((n, k) => {
      const next = dg.nodes[k + 1];
      const pi = path.indexOf(n.id), pj = path.indexOf(next.id);
      const onPath = pi >= 0 && pj === pi + 1;
      const flowing = (onPath && trace === pj && !waiting) || hotEdges.includes(n.id + '-' + next.id);
      const done = onPath && trace >= pj && !flowing;
      items.push(arrow((flowing ? 'flow' : done ? 'done' : '') + (vert ? ' v' : ''), at(String(n.c + 1))));
    });
    dg.nodes.forEach((n) => {
      const i = path.indexOf(n.id);
      const current = trace >= 0 && trace < path.length && path[trace] === n.id;
      const hot = hotNodes.includes(n.id);
      const filled = i >= 0 && i < trace && !(waiting && n.id === dg.gate);
      const sub = trace === path.length && n.doneSub ? n.doneSub : n.sub;
      const status = current ? (waiting ? 'awaiting approval' : 'processing…') : hot ? hotText[n.id] : '';
      const cls = ['node', filled && 'filled', (current || hot) ? 'ring' : sel === n.id && 'sel', current && !waiting && 'pulse'].filter(Boolean).join(' ');
      let bars = '';
      if (n.bars) { for (let q = 0; q < n.bars; q++) bars += `<span${fail && q === 0 ? ' class="off"' : ''}></span>`; }
      items.push(`<button type="button" class="${cls}" data-act="node" data-v="${n.id}" aria-pressed="${sel === n.id}" style="${at(String(n.c))}">
        <b>${esc(n.name)}</b><span class="sub">${esc(sub)}</span>
        ${status ? `<span class="status">${esc(status)}</span>` : ''}
        ${n.chips ? `<span class="chips">${n.chips.map((c) => `<span>${esc(c)}</span>`).join('')}</span>` : ''}
        ${bars ? `<span class="bars">${bars}</span>` : ''}
      </button>`);
    });

    const running = trace >= 0 && trace < path.length && !waiting;
    const label = waiting ? 'Approve and apply' : running ? 'Running…' : trace === path.length ? 'Run again' : dg.traceLabel;
    let extra = '';
    if (key === 'gcp') {
      extra = `<span class="ctl-label mono">Traffic</span>` +
        ['Low', 'High'].map((v) => `<button type="button" class="ctl" data-act="traffic" data-v="${v}" aria-pressed="${state.traffic === v}">${v}</button>`).join('') +
        `<button type="button" class="ctl" data-act="fail">Fail an instance</button>`;
    } else if (key === 'eventsourcing') {
      extra = `<button type="button" class="ctl" data-act="fail">Replay events</button>`;
    }
    const cd = D.code[key + ':' + sel];
    const tracks = dg.nodes.map(() => vert ? 'auto' : 'minmax(0, 1fr)').join(vert ? ' 34px ' : ' 28px ');
    return `<div class="scroll-x"><div class="flow-grid${vert ? ' vert' : ''}" style="grid-template-${vert ? 'rows' : 'columns'}:${tracks}">${items.join('')}</div></div>
      <div class="controls"><button type="button" class="run" data-act="trace"${running ? ' disabled' : ''}>${label}</button>${extra}</div>
      <div class="detail"><p class="mono">${esc(byId[sel].name)}</p><p>${esc(byId[sel].desc)}</p>${cd ? codeBlock(cd[0], cd[1]) : ''}</div>`;
  }

  function renderPanel() {
    const c = D.steps[state.step];
    return `<div><h3>${esc(c.title)}</h3><p class="muted" style="max-width:620px">${esc(c.desc)}</p>
        <ul class="points">${c.points.map((p) => `<li class="mono">${esc(p)}</li>`).join('')}</ul></div>
      <div class="diagram"><p class="diagram-label mono">${esc(c.diagramLabel)}</p>${c.key === 'elixir' ? renderElixir() : renderFlow(c.key)}</div>`;
  }

  function renderEco() {
    $('eco-tabs').innerHTML = D.eco.map((d, i) => `<button type="button" role="tab" class="tab" data-act="eco" data-v="${i}" aria-selected="${i === state.eco}">${esc(d.label)}</button>`).join('');
    $('eco-tools').innerHTML = D.eco[state.eco].tools.map((t) => `<div class="tool cell rise"><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p></div>`).join('');
  }

  let renderedEco = -1;
  // Re-rendering replaces buttons, so put keyboard focus back on the equivalent one.
  function render() {
    const a = document.activeElement;
    const fk = a && a.dataset && a.dataset.act ? a.dataset.act + ':' + a.dataset.v : null;
    $('steps').innerHTML = renderSteps();
    $('panel').innerHTML = renderPanel();
    if (renderedEco !== state.eco) { renderedEco = state.eco; renderEco(); }
    if (fk) {
      const [act, v] = fk.split(':');
      const el = document.querySelector(`[data-act="${act}"][data-v="${v}"]`);
      if (el) el.focus({ preventScroll: true });
    }
  }

  /* Trace runner */
  function currentDiagram() { return D.diagrams(state)[D.steps[state.step].key]; }
  function schedule() {
    timers.trace = setTimeout(() => {
      const dg = currentDiagram();
      const n = state.trace + 1;
      set({ trace: n });
      if (n < dg.path.length && !(dg.gate && dg.path[n] === dg.gate && !state.approved)) schedule();
    }, 650);
  }

  const actions = {
    step: (v) => { clearTimeout(timers.trace); clearTimeout(timers.fail); set({ step: +v, trace: -1, approved: false, sel: null, gFail: false }); },
    crash: (v, el) => {
      const i = +v;
      set({ crashed: i, eIdx: i, lastCrash: el.querySelector('b').textContent + ' under the ' + el.dataset.group + ' supervisor' });
      clearTimeout(timers.crash);
      timers.crash = setTimeout(() => set({ crashed: -1 }), 1400);
    },
    node: (v) => set({ sel: v }),
    traffic: (v) => set({ traffic: v }),
    eco: (v) => set({ eco: +v }),
    fail: () => { set({ gFail: true }); clearTimeout(timers.fail); timers.fail = setTimeout(() => set({ gFail: false }), 2200); },
    trace: () => {
      const dg = currentDiagram();
      const gateIdx = dg.gate ? dg.path.indexOf(dg.gate) : -1;
      clearTimeout(timers.trace);
      if (gateIdx >= 0 && state.trace === gateIdx && !state.approved) { set({ approved: true }); schedule(); return; }
      set({ trace: 0, approved: false });
      schedule();
    }
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && actions[el.dataset.act]) actions[el.dataset.act](el.dataset.v, el);
  });

  /* Availability strip */
  function tzOffset(zone, fallback) {
    try {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName');
      const m = p && /GMT([+−-])(\d{2}):?(\d{2})?/.exec(p.value);
      if (m) return (m[1] === '+' ? 1 : -1) * (parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 60 : 0));
    } catch (e) {}
    return fallback;
  }
  function renderTz() {
    const me = -3;
    let nowH = 14.5, nowText = '14:30 BRT';
    try {
      const pp = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      const hh = parseInt(pp.find((x) => x.type === 'hour').value, 10) % 24;
      const mm = parseInt(pp.find((x) => x.type === 'minute').value, 10);
      nowH = hh + mm / 60;
      nowText = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ' BRT';
    } catch (e) {}
    const work = (off, h) => { const l = (((h + (off - me)) % 24) + 24) % 24; return l >= 9 && l < 18; };
    const zones = [['Ponta Grossa', me, true], ['New York', tzOffset('America/New_York', -5)], ['London', tzOffset('Europe/London', 0)], ['Berlin', tzOffset('Europe/Berlin', 1)]];
    $('tz-rows').innerHTML = zones.map(([name, off, mine]) => {
      let cells = '';
      for (let h = 0; h < 24; h++) {
        const on = work(off, h);
        const cls = mine ? (on ? 'on' : '') : on ? (work(me, h) ? 'on' : 'theirs') : '';
        cells += `<i${cls ? ` class="${cls}"` : ''}></i>`;
      }
      return `<div class="tz-row${mine ? ' me' : ''}"><span class="mono">${name}</span><span class="tz-cells">${cells}</span></div>`;
    }).join('');
    $('tz-now').style.left = (nowH / 24 * 100).toFixed(2) + '%';
    $('tz-now-text').textContent = 'now ' + nowText;
  }

  render();
  renderTz();
  setInterval(renderTz, 60000);
})();
