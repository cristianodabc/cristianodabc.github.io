(function () {
  const D = window.SITE_DATA;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Theme */
  const root = document.documentElement;
  const themeBtns = document.querySelectorAll('[data-theme-set]');
  const applyTheme = (mode, save) => {
    if (mode === 'light' || mode === 'dark') root.dataset.theme = mode; else delete root.dataset.theme;
    themeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === mode)));
    if (save) { try { localStorage.setItem('theme', mode); } catch (e) {} }
  };
  applyTheme(root.dataset.theme || 'auto', false);
  themeBtns.forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.themeSet, true)));

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
    const zones = [['Ponta Grossa', me, true], ['California', tzOffset('America/Los_Angeles', -8)], ['New York', tzOffset('America/New_York', -5)], ['London', tzOffset('Europe/London', 0)], ['Berlin', tzOffset('Europe/Berlin', 1)]];
    $('tz-rows').innerHTML = zones.map(([name, off, mine]) => {
      let cells = '';
      for (let h = 0; h < 24; h++) {
        const on = work(off, h);
        const cls = mine ? (on ? 'on' : '') : on ? (work(me, h) ? 'on' : 'theirs') : '';
        const local = (((h + (off - me)) % 24) + 24) % 24;
        cells += `<i${cls ? ` class="${cls}"` : ''} data-h="${h}" data-n="${name}" data-l="${local}" data-k="${cls || ''}"></i>`;
      }
      return `<div class="tz-row${mine ? ' me' : ''}"><span class="mono">${name}</span><span class="tz-cells">${cells}</span></div>`;
    }).join('');
    $('tz-now').style.left = (nowH / 24 * 100).toFixed(2) + '%';
    $('tz-now-text').textContent = 'now ' + nowText;
  }

  /* Hover details: what a cell's hour is in that city */
  (function () {
    const rows = $('tz-rows'), tip = $('tz-tip');
    if (!rows || !tip) return;
    const pad = (n) => String(n).padStart(2, '0');
    const show = (cell) => {
      const k = cell.dataset.k, name = cell.dataset.n, h = +cell.dataset.h, l = +cell.dataset.l;
      const tag = k === 'on' ? (name === 'Ponta Grossa' ? 'working hours' : 'overlap') : k === 'theirs' ? 'their working hours' : 'off hours';
      tip.textContent = name === 'Ponta Grossa' ? pad(h) + ':00 BRT · ' + tag : pad(h) + ':00 BRT = ' + pad(l) + ':00 in ' + name + ' · ' + tag;
      tip.hidden = false;
      const box = tip.parentElement.getBoundingClientRect(), c = cell.getBoundingClientRect();
      const half = tip.offsetWidth / 2;
      const x = Math.min(Math.max(c.left - box.left + c.width / 2, half), box.width - half);
      tip.style.left = x + 'px';
      tip.style.top = (c.top - box.top - 8) + 'px';
    };
    rows.addEventListener('pointerover', (e) => { const c = e.target.closest('i[data-h]'); if (c) show(c); });
    rows.addEventListener('pointerleave', () => { tip.hidden = true; });
    rows.addEventListener('click', (e) => { const c = e.target.closest('i[data-h]'); if (c) show(c); });
  })();

  render();
  renderTz();
  setInterval(renderTz, 60000);
})();

/* AI workflow: highlight the selected step (My review by default) */
(function () {
  const section = document.getElementById('ai');
  if (!section) return;
  const nodes = section.querySelectorAll('.aiflow-node');
  const cards = section.querySelectorAll('.aistep');
  const select = (i) => {
    nodes.forEach((n) => { const on = n.dataset.step === i; n.classList.toggle('active', on); n.setAttribute('aria-pressed', String(on)); });
    cards.forEach((c) => c.classList.toggle('active', c.dataset.step === i));
  };
  section.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const el = e.target.closest('[data-step]');
    if (el) select(el.dataset.step);
  });
})();

/* Terminal easter egg: a fixed command table, never evaluated */
(function () {
  const dlg = document.getElementById('iex');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const out = document.getElementById('iex-out'), input = document.getElementById('iex-in');
  const prompt = document.getElementById('iex-prompt'), form = document.getElementById('iex-form');
  const LINKS = { github: 'https://github.com/cristianodabc', linkedin: 'https://www.linkedin.com/in/ccarvalho-dev/', resume: 'assets/cristiano-carvalho-resume.pdf', email: 'mailto:pegasustec.dev@pm.me' };
  const SECTIONS = ['services', 'technologies', 'approach', 'ai', 'contact'];
  const THEMES = ['auto', 'light', 'dark'];
  const ZONES = [['Ponta Grossa', 'America/Sao_Paulo'], ['California', 'America/Los_Angeles'], ['New York', 'America/New_York'], ['London', 'Europe/London'], ['Berlin', 'Europe/Berlin']];
  const offset = (zone) => {
    try {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName');
      const m = p && /GMT([+−-])(\d{2}):?(\d{2})?/.exec(p.value);
      if (m) return (m[1] === '+' ? 1 : -1) * (parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 60 : 0));
    } catch (e) {}
    return 0;
  };
  const clock = (zone) => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); } catch (e) { return '--:--'; } };
  const overlap = (zone) => {
    const me = offset('America/Sao_Paulo'), them = offset(zone); let n = 0;
    for (let h = 9; h < 18; h++) { const l = (((h + (them - me)) % 24) + 24) % 24; if (l >= 9 && l < 18) n++; }
    return n;
  };
  const COMMANDS = {
    crash: { d: 'crash a process in the Elixir demo', run: () => {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => {
        if (!document.querySelector('.proc')) { const e = document.querySelector('.step[data-v="0"]'); if (e) e.click(); }
        const procs = document.querySelectorAll('.proc'); if (!procs.length) return;
        dlg.close();
        const target = procs[Math.floor(Math.random() * procs.length)];
        target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        setTimeout(() => target.click(), reduce ? 50 : 700);
      }, 500);
      return ['** (EXIT) killing a random process...', 'Its supervisor restarts it. Watch the Technologies section.'];
    } },
    sudo: { d: 'try it', run: (args) => {
      if (args.join(' ') !== 'hire me') return ['visitor is not in the sudoers file. This incident will be reported.', 'Try: sudo hire me'];
      setTimeout(() => {
        dlg.close();
        const box = document.getElementById('c-body'), form = document.getElementById('compose');
        if (form) form.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        if (box) box.focus({ preventScroll: true });
      }, 900);
      return ['[sudo] password for visitor: ********', 'Access granted. Opening the composer...'];
    } },
    fortune: { d: 'a principle, at random', run: () => [FORTUNES[Math.floor(Math.random() * FORTUNES.length)]] },
    logo: { d: 'show the logo', run: () => { out.appendChild(logoNode()); out.scrollTop = out.scrollHeight; } },
    help: { d: 'list commands', run: () => Object.keys(COMMANDS).map((k) => k.padEnd(10) + COMMANDS[k].d).concat(['', 'Tab completes, up/down recalls, and Pegasustec.services() or whoami |> upcase work too.']) },
    whoami: { d: 'who runs this', run: () => ['{:ok, "Cristiano Carvalho"}', 'Independent software engineer, Ponta Grossa, Brazil (UTC-03:00).', '9+ years in backend engineering, 8+ in Elixir/OTP.'] },
    services: { d: 'line of work', run: () => ['1. Software development', '2. Financial & event-driven systems', '3. Cloud & infrastructure'] },
    stack: { d: 'main tools', run: () => ['[:elixir, :phoenix_liveview, :postgresql, :docker, :terraform, :google_cloud]', 'Ruby and Python too, but only where I can review the code well.'] },
    approach: { d: 'how the work is done', run: () => ['[:simple, :reliable, :transparent, :built_to_last, :async_by_default]'] },
    ai: { d: 'how AI is used', run: () => ['AI writes much of the code. I own every line that ships.', 'plan -> build -> verify -> my review -> gate -> ship -> learn'] },
    time: { d: 'local times and overlap', run: () => ZONES.map(([n, z], i) => n.padEnd(13) + clock(z) + (i ? '  ' + overlap(z) + ' h overlap with my 09-18' : '  working 09-18')) },
    contact: { d: 'how to reach me', run: () => ['pegasustec.dev@pm.me', 'github.com/cristianodabc', 'linkedin.com/in/ccarvalho-dev'] },
    goto: { d: 'jump to a section', args: SECTIONS, run: ([a]) => {
      const el = SECTIONS.includes(a) && document.getElementById(a);
      if (!el) return ['usage: goto ' + SECTIONS.join('|')];
      dlg.close();
      el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } },
    open: { d: 'open github, linkedin, resume or email', args: Object.keys(LINKS), run: ([a]) => {
      if (!LINKS[a]) return ['usage: open ' + Object.keys(LINKS).join('|')];
      if (a === 'email') location.href = LINKS[a]; else window.open(LINKS[a], '_blank', 'noopener');
      return ['opening ' + a + '...'];
    } },
    theme: { d: 'switch the site theme', args: THEMES, run: ([a]) => {
      const b = THEMES.includes(a) && document.querySelector('[data-theme-set="' + a + '"]');
      if (!b) return ['usage: theme ' + THEMES.join('|')];
      b.click(); return ['theme set to ' + a];
    } },
    keys: { d: 'vim keys for the whole page', run: () => ['j / k      scroll down / up', 'd / u      half page down / up', 'gg / G     top / bottom', '} / {      next / previous section', 'h / l      previous / next step in the AI workflow', ': or `     open this terminal', '?          show these keys'] },
    history: { d: 'commands so far', run: () => hist.map((h, i) => (i + 1) + '  ' + h) },
    clear: { d: 'clear the screen', run: () => { banner(); } },
    exit: { d: 'close', run: () => { dlg.close(); } }
  };
  const FILTERS = {
    upcase: (l) => l.map((x) => x.toUpperCase()),
    downcase: (l) => l.map((x) => x.toLowerCase()),
    count: (l) => [String(l.length)],
    reverse: (l) => l.slice().reverse(),
    sort: (l) => l.slice().sort()
  };
  const LOGO = ["       ..                             .-", "      .:%#:                          =@-", "       %@@@%#+-.                  :+@@#", "      +@@@@@@@@@#=             .=#@@@#.", "    .#@@@@@@@@@@@@%-        -+%@@@@@*", "   =@@@@@@@@@@@@@@@@*   :=#@@@@@@@#-", "  *@@@@@@@@@#@@@@@@%#+*%@@@@@@@@*-.", ".%@@@@#+++=.*@@@%+*#@@@@@@@@@#=-+#@.", ":#%%%-     -@@#+*@@@@@@@@%*==*%@@@+", "          =@@+#@@@@@@@#++*%@@@@@@+", "        .*@%=%@@@@@#**%@@@@@@@@*.", "       .%@@=@@@@@@#%@@@@@@@%+-::", "       #@@%%@@@@@@@@@@@#+++*#@@-", "      .@@@@@@@@@@@@@#**#@@@@@*:", "       @@@@@@@@@@@@%@@@@@#+-", "       +@@@@@@@@@@@@@#+++*%#", "        *@@@@@@@@@@%#%@@@%=", "         +@@@@@@@@@@@%#+:", "          -%@@@@@@@=.", "           +@@@@@@%", "          +********+.", "       -#%%%%%%%%%%%%%#:", "       :+*************+.", "       +%%%%%%%%%%%%%%%=", "      #@@@@@@@@@@@@@@@@@*", "     +@@@@@@@@@@@@@@@@@@@-"];
  const INFO = ['pegasustec.dev', 'Independent software and infrastructure engineering, built on Elixir.', '', 'help   list commands', 'keys   vim keys for the page'];
  const FORTUNES = ['Anything not needed is removed. Fewer moving parts means fewer things that can break.', 'Tested, monitored and documented, so your systems keep working when it matters.', 'Clear scope, honest timelines and regular updates from first call to launch.', 'Foundations designed to grow with your business instead of being rebuilt every year.', 'AI writes much of the code. I own every line that ships.', 'Time zones matter mostly for meetings. The work can be done from anywhere.'];
  const hist = [];
  let n = 1, pos = 0;
  const add = (t, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = t; out.appendChild(d); };
  const setPrompt = () => { prompt.textContent = 'iex(' + n + ')>'; };
  const banner = () => { out.textContent = ''; add('Pegasustec. Type help for commands, or keys for the vim shortcuts.', 'dim'); };
  const logoNode = () => {
    const wrap = document.createElement('div'); wrap.className = 'iex-banner';
    const pre = document.createElement('pre'); pre.className = 'iex-logo'; pre.setAttribute('aria-hidden', 'true'); pre.textContent = LOGO.join('\n');
    const info = document.createElement('div'); info.className = 'iex-info';
    INFO.forEach((t, i) => { const d = document.createElement('div'); d.textContent = t || ' '; if (i === 0) d.className = 'iex-title'; else if (t.indexOf('   ') > 0) d.className = 'dim'; info.appendChild(d); });
    wrap.append(pre, info);
    return wrap;
  };
  const intro = () => { out.textContent = ''; out.appendChild(logoNode()); };
  const parse = (seg) => {
    let s = seg.trim().replace(/^(?:[A-Z]\w*\.)+/, '');
    const m = /^(\w+)\s*\((.*)\)$/.exec(s);
    if (m) s = m[1] + ' ' + m[2].replace(/["',]/g, ' ');
    const [name, ...args] = s.trim().split(/\s+/);
    return [(name || '').toLowerCase(), args.map((a) => a.toLowerCase())];
  };
  const undef = (mod, name, arity) => add('** (UndefinedFunctionError) function ' + mod + '.' + name.slice(0, 40) + '/' + arity + ' is undefined. Try help.', 'err');
  const run = (raw) => {
    add('iex(' + n + ')> ' + raw, 'cmd');
    n++; setPrompt();
    if (!raw.trim()) return;
    const segs = raw.split('|>');
    const [name, args] = parse(segs[0]);
    const cmd = COMMANDS[name];
    if (!cmd) { undef('Pegasustec', name, 0); return; }
    let lines = cmd.run(args);
    if (!lines) return;
    for (const seg of segs.slice(1)) {
      const [fname] = parse(seg);
      if (!FILTERS[fname]) { undef('Enum', fname, 1); return; }
      lines = FILTERS[fname](lines);
    }
    lines.forEach((l) => add(l));
    out.scrollTop = out.scrollHeight;
  };
  const complete = () => {
    const parts = input.value.split(/\s+/), last = parts[parts.length - 1].toLowerCase();
    const pool = parts.length === 1 ? Object.keys(COMMANDS) : ((COMMANDS[parts[0].toLowerCase()] || {}).args || []);
    const hits = pool.filter((k) => k.startsWith(last));
    if (!hits.length) return;
    if (hits.length === 1) { parts[parts.length - 1] = hits[0]; input.value = parts.join(' ') + ' '; return; }
    add(hits.join('  '), 'dim');
    let common = hits[0];
    hits.forEach((h) => { while (!h.startsWith(common)) common = common.slice(0, -1); });
    parts[parts.length - 1] = common; input.value = parts.join(' ');
    out.scrollTop = out.scrollHeight;
  };
  const open = () => { if (dlg.open) return; if (!out.childNodes.length) intro(); setPrompt(); dlg.showModal(); input.focus(); };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    if (v.trim() && hist[hist.length - 1] !== v) hist.push(v);
    pos = hist.length; input.value = ''; run(v);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && pos > 0) { e.preventDefault(); pos--; input.value = hist[pos]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); pos = Math.min(pos + 1, hist.length); input.value = hist[pos] || ''; }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); banner(); }
  });
  document.addEventListener('iex-open', (e) => { open(); if (e.detail) run(e.detail); });
  document.getElementById('iex-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== '`' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault(); open();
  });
})();

/* Vim-style keys for the whole page; ? lists them in the terminal */
(function () {
  const ids = ['top', 'services', 'technologies', 'approach', 'ai', 'contact'];
  const sections = () => ids.map((id) => document.getElementById(id)).filter(Boolean);
  const NAV = 72;
  const startOf = (el) => el.getBoundingClientRect().top - NAV + scrollY;
  const current = () => { const s = sections(); let k = 0; s.forEach((el, i) => { if (el.getBoundingClientRect().top <= NAV + 8) k = i; }); return k; };
  const jump = (d) => {
    const s = sections(), k = current();
    let i = k + d;
    if (d < 0 && s[k].getBoundingClientRect().top < NAV - 8) i = k;
    i = Math.min(Math.max(i, 0), s.length - 1);
    scrollTo({ top: i === 0 ? 0 : startOf(s[i]) + 1 });
  };
  const step = (d) => {
    const ai = document.getElementById('ai'); if (!ai) return false;
    const r = ai.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return false;
    const nodes = Array.from(ai.querySelectorAll('.aiflow-node')), i = nodes.findIndex((n) => n.classList.contains('active'));
    const j = Math.min(Math.max(i + d, 0), nodes.length - 1);
    if (nodes[j]) nodes[j].click();
    return true;
  };
  const hint = document.getElementById('keyhint');
  if (hint) hint.addEventListener('click', () => document.dispatchEvent(new CustomEvent('iex-open', { detail: 'keys' })));
  let pending = '', timer;
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    const dlg = document.getElementById('iex'); if (dlg && dlg.open) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const k = e.key;
    if (pending === 'g') { pending = ''; clearTimeout(timer); if (k === 'g') { e.preventDefault(); scrollTo({ top: 0 }); return; } }
    let handled = true;
    if (k === 'j') scrollBy({ top: 90, behavior: 'instant' });
    else if (k === 'k') scrollBy({ top: -90, behavior: 'instant' });
    else if (k === 'd') scrollBy({ top: innerHeight / 2 });
    else if (k === 'u') scrollBy({ top: -innerHeight / 2 });
    else if (k === 'G') scrollTo({ top: document.documentElement.scrollHeight });
    else if (k === '}') jump(1);
    else if (k === '{') jump(-1);
    else if (k === 'h') handled = step(-1);
    else if (k === 'l') handled = step(1);
    else if (k === ':') document.dispatchEvent(new CustomEvent('iex-open'));
    else if (k === '?') document.dispatchEvent(new CustomEvent('iex-open', { detail: 'keys' }));
    else if (k === 'g') { pending = 'g'; timer = setTimeout(() => { pending = ''; }, 800); }
    else handled = false;
    if (handled) e.preventDefault();
  });
})();

/* Contact composer: builds a mailto: link, nothing is sent from the page */
(function () {
  const form = document.getElementById('compose');
  if (!form) return;
  const TO = 'pegasustec.dev@pm.me', MAX_URL = 1900;
  const subject = document.getElementById('c-subject'), name = document.getElementById('c-name');
  const body = document.getElementById('c-body'), status = document.getElementById('c-status');
  const DEFAULT_SUBJECT = 'Project inquiry';
  let topic = '', autoSubject = subject.value;
  const chips = Array.from(form.querySelectorAll('.chip'));
  chips.forEach((chip) => chip.addEventListener('click', () => {
    const on = chip.getAttribute('aria-pressed') !== 'true';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip && on)));
    topic = on ? chip.dataset.topic : '';
    const next = topic ? DEFAULT_SUBJECT + ': ' + topic : DEFAULT_SUBJECT;
    if (!subject.value.trim() || subject.value === autoSubject) subject.value = next;
    autoSubject = next;
  }));
  const text = () => {
    const msg = body.value.trim();
    const who = name.value.trim();
    return (topic ? 'Looking for: ' + topic + '\n\n' : '') + msg + (who ? '\n\n' + who : '');
  };
  const say = (t, err) => { status.textContent = t; status.classList.toggle('err', !!err); };
  const url = () => 'mailto:' + TO + '?subject=' + encodeURIComponent(subject.value.trim() || 'Project inquiry') + '&body=' + encodeURIComponent(text().replace(/\r?\n/g, '\r\n'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!body.value.trim()) { say('Write a message first.', true); body.focus(); return; }
    const href = url();
    if (href.length > MAX_URL) { say('Too long for a mail link. Use Copy message and paste it into your mail app.', true); return; }
    const a = document.createElement('a'); a.href = href; document.body.appendChild(a); a.click(); a.remove();
    say('Opening your mail app. If nothing opens, use Copy message.');
  });
  document.getElementById('c-copy').addEventListener('click', async () => {
    if (!body.value.trim()) { say('Write a message first.', true); body.focus(); return; }
    const out = 'To: ' + TO + '\nSubject: ' + (subject.value.trim() || 'Project inquiry') + '\n\n' + text();
    try { await navigator.clipboard.writeText(out); say('Copied. Paste it into any mail app and send it to ' + TO + '.'); }
    catch (e) { say('Could not copy. Select the message and copy it by hand.', true); }
  });
  body.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') form.requestSubmit(); });
})();
