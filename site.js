/* Daniel Cournane · portfolio
   Everything here is progressive: the page reads fine before any of it runs. */
(async function () {
  'use strict';
  // setup runs in three slices (hero, then the middle sections, then the rest) with a painted frame between,
  // so the phone never freezes on one long block of startup work
  const breathe = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const EMAIL = 'danielcournane@gmail.com';
  const WORKER = 'https://signal-proxy.danielcournane.workers.dev';

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  /* ───────────────── SOUND ─────────────────
     Every sound is synthesized on the fly with Web Audio. Off by default. */
  const Sound = (() => {
    let ctx = null, master = null, noiseBuf = null;
    let enabled = store.get('dc-sound') === 'on';
    let lastTick = 0;

    function init() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.32;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp).connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return true;
      } catch (e) { ctx = null; return false; }
    }
    function ready() {
      if (!enabled) return false;
      if (!init()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    function tone(f, dur, { type = 'sine', gain = 0.2, at = 0, to = null, attack = 0.004 } = {}) {
      const t0 = ctx.currentTime + at;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    }
    function noise(dur, { gain = 0.2, at = 0, freq = 3000, q = 1.2, type = 'bandpass' } = {}) {
      const t0 = ctx.currentTime + at;
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf;
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }
    const fx = {
      tick() { const n = performance.now(); if (n - lastTick < 55) return; lastTick = n; noise(0.016, { gain: 0.09, freq: 5200, q: 3 }); },
      click() { noise(0.03, { gain: 0.22, freq: 2600, q: 1.5 }); tone(1500, 0.05, { type: 'triangle', gain: 0.05 }); },
      flap() { noise(0.022, { gain: 0.16, freq: 1700 + Math.random() * 900, q: 4 }); },
      open() { tone(392, 0.22, { gain: 0.08 }); tone(587, 0.28, { gain: 0.07, at: 0.06 }); noise(0.2, { gain: 0.05, freq: 900, q: 0.7, type: 'lowpass' }); },
      close() { tone(587, 0.16, { gain: 0.07, to: 392 }); },
      go() { tone(1046, 0.07, { type: 'square', gain: 0.035 }); tone(1397, 0.11, { type: 'square', gain: 0.035, at: 0.075 }); },
      chime() { [1046, 1319, 1568].forEach((f, i) => tone(f, 0.5, { gain: 0.06, at: i * 0.07 })); },
      up() { tone(1760, 0.06, { gain: 0.04 }); tone(2349, 0.08, { gain: 0.035, at: 0.05 }); },
      down() { tone(1175, 0.06, { gain: 0.04 }); tone(880, 0.08, { gain: 0.035, at: 0.05 }); },
      slide() { noise(0.09, { gain: 0.1, freq: 1200, q: 0.8 }); },
      theme() { tone(140, 0.12, { gain: 0.16, to: 70 }); noise(0.04, { gain: 0.08, freq: 400, q: 1 }); }
    };
    function play(name) { if (ready() && fx[name]) { try { fx[name](); } catch (e) {} } }
    function setEnabled(v) {
      enabled = v;
      store.set('dc-sound', v ? 'on' : 'off');
      const b = $('#soundBtn');
      b.setAttribute('aria-pressed', String(v));
      // SVG paths have no .hidden property, so set the attribute itself
      b.querySelector('.snd-on').toggleAttribute('hidden', !v);
      b.querySelector('.snd-off').toggleAttribute('hidden', v);
      b.title = v ? 'Sound on' : 'Sound off';
    }
    return { play, setEnabled, get enabled() { return enabled; }, toggle() { setEnabled(!enabled); if (enabled) play('chime'); toast(enabled ? 'Sound on' : 'Sound off'); } };
  })();
  Sound.setEnabled(Sound.enabled);
  $('#soundBtn').addEventListener('click', () => Sound.toggle());

  // soft ticks on hover, clicks on press (only when sound is on)
  if (finePointer) {
    let lastEl = null;
    document.addEventListener('pointerover', e => {
      if (!Sound.enabled) return;
      const el = e.target.closest('a, button, summary, .entry, .tk');
      if (el && el !== lastEl) { lastEl = el; Sound.play('tick'); }
      if (!el) lastEl = null;
    });
  }
  document.addEventListener('pointerdown', e => {
    if (e.target.closest('a, button, summary') && !e.target.closest('#soundBtn')) Sound.play('click');
  });

  /* ───────────────── THEME ───────────────── */
  function effectiveTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    store.set('dc-theme', next);
    World.recolor();
    Sound.play('theme');
    $('#themeBtn').title = next === 'dark' ? 'Dark theme' : 'Light theme';
  }
  $('#themeBtn').addEventListener('click', toggleTheme);

  /* ───────────────── NAV ───────────────── */
  const menuBtn = $('#menuBtn'), drawer = $('#drawerNav');
  function setMenu(open) { drawer.dataset.open = String(open); menuBtn.setAttribute('aria-expanded', String(open)); }
  menuBtn.addEventListener('click', () => setMenu(drawer.dataset.open !== 'true'));
  drawer.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });

  const nav = $('#nav'), linkRow = $('#navLinks'), root = document.documentElement;
  const navLinks = $$('.nav-links a');
  const sections = $$('main section[id]');
  // keeps the highlighted link in view when the compact header turns into a scrolling row on phones
  function centerActive() {
    const a = $('.nav-links a.is-active');
    if (!a || linkRow.scrollWidth <= linkRow.clientWidth + 1) return;
    const r = a.getBoundingClientRect(), rr = linkRow.getBoundingClientRect();
    linkRow.scrollBy({ left: r.left - rr.left - rr.width / 2 + r.width / 2, behavior: reduced ? 'auto' : 'smooth' });
  }
  // a section becomes active once its heading has climbed into the top third of the screen,
  // i.e. when you're actually reading it, not when its first pixel peeks in at the bottom
  let activeId = null;
  function spy() {
    const line = Math.min(window.innerHeight * 0.33, 320);
    let id = null;
    for (const sec of sections) {
      const content = sec.firstElementChild || sec;
      if (content.getBoundingClientRect().top <= line) id = sec.id;
    }
    // the last section may never reach the line, so the bottom of the page counts as arriving there
    if (window.innerHeight + window.scrollY >= root.scrollHeight - 4) id = sections[sections.length - 1].id;
    if (id === activeId) return;
    activeId = id;
    navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    centerActive();
  }

  // past the hero the header drops the logo, clock and buttons and keeps only the section links
  const prog = $('#progress'), bg = $('.bg');
  let scrollQueued = false, compact = false;
  function onScroll() {
    scrollQueued = false;
    // read everything first (spy measures the sections), then write: reading after a write forces a full relayout
    spy();
    const y = window.scrollY;
    const h = root.scrollHeight - window.innerHeight;
    const p = h > 0 ? Math.min(1, y / h) : 0;
    prog.style.transform = `scaleX(${p})`;
    // the blobs' parallax lives on their own layer, so a scroll frame restyles three elements instead of the whole page
    bg.style.setProperty('--sp', p.toFixed(4));
    nav.classList.toggle('is-scrolled', y > 8);
    const c = compact ? y > 90 : y > 140;
    if (c !== compact) {
      compact = c;
      nav.classList.toggle('is-compact', c);
      if (c) { setMenu(false); requestAnimationFrame(centerActive); }
    }
  }
  window.addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  window.addEventListener('resize', () => { activeId = undefined; onScroll(); });

  /* ───────────────── NYSE CLOCK ─────────────────
     Regular session 9:30–16:00 ET, with 2026–27 exchange holidays and early closes. */
  const HOLIDAYS = new Set(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
    '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24']);
  const EARLY = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);
  const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  function market(now = new Date()) {
    const p = {};
    nyFmt.formatToParts(now).forEach(x => { p[x.type] = x.value; });
    const day = `${p.year}-${p.month}-${p.day}`;
    const mins = (+p.hour % 24) * 60 + (+p.minute);
    const weekend = p.weekday === 'Sat' || p.weekday === 'Sun';
    const close = EARLY.has(day) ? 13 * 60 : 16 * 60;
    const dur = m => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`);
    let state = 'closed', label = 'Closed', long = 'Market Closed';
    if (!weekend && !HOLIDAYS.has(day)) {
      if (mins >= 570 && mins < close) { state = 'open'; label = 'Open'; long = `Open · Closes in ${dur(close - mins)}`; }
      else if (mins >= 240 && mins < 570) { state = 'pre'; label = 'Pre-Market'; long = `Pre-Market · Opens in ${dur(570 - mins)}`; }
      else if (mins >= close && mins < 1200) { state = 'after'; label = 'After Hours'; long = 'After Hours'; }
    } else if (HOLIDAYS.has(day)) { label = 'Holiday'; long = 'Closed for Holiday'; }
    return { state, label, long };
  }
  function tickClock() {
    const m = market();
    $('#tapeDot').dataset.state = m.state;
    $('#tapeState').textContent = m.long;
  }
  tickClock();
  setInterval(tickClock, 15000);

  /* ───────────────── NAME BOARD ─────────────────
     A split-flap settle on the name. Each cell is locked to its final glyph width so nothing jitters. */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ$%0123456789';
  // every turn swings the letter on a hinge; .is-anim keeps a moving letter painted (see .name .ch in site.css)
  function hinge(el, land) {
    if (!el.animate) return;
    el._moving = (el._moving || 0) + 1;
    el.classList.add('is-anim');
    const a = el.animate(land
      ? [{ transform: 'perspective(600px) rotateX(-95deg)', filter: 'brightness(1.8)' }, { transform: 'perspective(600px) rotateX(12deg)', offset: 0.7 }, { transform: 'none', filter: 'none' }]
      : [{ transform: 'perspective(600px) rotateX(-80deg)', filter: 'brightness(1.4)' }, { transform: 'none', filter: 'none' }],
      { duration: land ? 420 : 90, easing: land ? 'cubic-bezier(.2,.9,.3,1.2)' : 'linear' });
    a.onfinish = a.oncancel = () => { if (--el._moving === 0) el.classList.remove('is-anim'); };
  }
  function sweepName() {
    const n = $('#name');
    n.classList.remove('is-sweeping'); void n.offsetWidth; n.classList.add('is-sweeping');
  }
  // printing mid-flip would put scrambled letters on paper, so beforeprint lands everything at once
  const STATS = $$('.keystats dd').map(dd => dd.textContent);
  let landed = false;
  window.addEventListener('beforeprint', () => {
    landed = true;
    $$('#name .name-line').forEach(line => $$('.ch', line).forEach((c, i) => { c.textContent = line.dataset.text.toUpperCase()[i]; }));
    $$('.keystats dd').forEach((dd, i) => { dd.textContent = STATS[i]; });
  });
  function flapName() {
    landed = false;
    const lines = $$('#name .name-line');
    let flapsQueued = 0, pending = 0;
    lines.forEach((line, li) => {
      const word = line.dataset.text.toUpperCase();
      line.innerHTML = word.split('').map(c => `<span class="ch">${c}</span>`).join('');
      const cells = $$('.ch', line);
      // locked in em, not px, so the cells rescale with the name's fluid font-size on resize or rotation
      const em = parseFloat(getComputedStyle(line).fontSize);
      cells.forEach(c => { c.style.width = c.getBoundingClientRect().width / em + 'em'; c.style.textAlign = 'center'; });
      if (reduced) return;
      cells.forEach((cell, i) => {
        const final = cell.textContent;
        const settle = 260 + i * 70 + li * 160 + Math.random() * 80;
        const start = performance.now();
        pending++;
        cell.classList.add('is-flipping');
        (function step(now) {
          if (landed || now - start >= settle) {
            cell.textContent = final;
            cell.classList.remove('is-flipping');
            hinge(cell, true);
            cell.classList.remove('is-landed'); void cell.offsetWidth; cell.classList.add('is-landed');
            if (flapsQueued++ % 2 === 0) Sound.play('flap');
            if (--pending === 0) sweepName();
            return;
          }
          cell.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          hinge(cell, false);
          setTimeout(() => requestAnimationFrame(step), 48);
        })(start);
      });
    });
  }
  // the six key stats flip into place left to right, the same way the name does
  function flipStats() {
    if (reduced) return;
    $$('.keystats dd').forEach((dd, r) => {
      const final = dd.textContent, start = performance.now(), settle = 500 + r * 110;
      (function step(now) {
        const p = (now - start) / settle;
        if (landed || p >= 1) { dd.textContent = final; return; }
        const keep = Math.floor(p * final.length);
        dd.textContent = final.split('').map((c, i) => i < keep || !/[a-z0-9]/i.test(c) ? c
          : /\d/.test(c) ? (Math.random() * 10) | 0 : GLYPHS[(Math.random() * 26) | 0].toLowerCase()).join('');
        setTimeout(() => requestAnimationFrame(step), 45);
      })(start);
    });
  }
  function startName() { flapName(); flipStats(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(startName); else startName();
  $('#name').addEventListener('click', flapName);

  /* ───────────────── HERO SPOTLIGHT ───────────────── */
  if (finePointer && !reduced) {
    const hero = $('#hero');
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
      hero.style.setProperty('--my', `${e.clientY - r.top}px`);
      hero.classList.add('is-lit');
    });
    hero.addEventListener('pointerleave', () => hero.classList.remove('is-lit'));
  }

  /* ───────────────── HOLO CARD: the ID card leans toward the pointer and catches the light ───────────────── */
  if (finePointer && !reduced) {
    const card = $('.id-card');
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${((px - 0.5) * 14).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${((0.5 - py) * 12).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      card.classList.add('is-tilting');
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
    });
  }

  /* ───────────────── WORLD ─────────────────
     A wireframe "market surface" rendered behind the whole page. It keeps rolling and reshapes for the section
     you're reading (the nav's activeId): a calm swell, the NBIS ridge, a flat ledger grid. Lines near the pointer
     light up gold. Pauses while the tab is hidden; one still frame under reduced motion. */
  const World = (() => {
    const cv = $('#world');
    if (!cv || !cv.getContext) return { recolor() {} };
    const ctx = cv.getContext('2d');
    // swell: rolling surface, ridge: the gold ridge climbing to the back, sharp: ridge width (smaller is spikier),
    // glow: line strength, mesh: strength of the cross lines that turn the surface into a grid
    const SHAPES = {
      hero:       { swell: 1,    ridge: 0.7,  sharp: 0.025, glow: 1,    mesh: 0.1 },
      path:       { swell: 0.8,  ridge: 0.35, sharp: 0.03,  glow: 0.55, mesh: 0.08 },
      projects:   { swell: 0.55, ridge: 0.2,  sharp: 0.03,  glow: 0.45, mesh: 0.07 },
      journal:    { swell: 0.5,  ridge: 0.25, sharp: 0.03,  glow: 0.45, mesh: 0.07 },
      research:   { swell: 0.35, ridge: 1.6,  sharp: 0.006, glow: 0.65, mesh: 0.08 },
      experience: { swell: 0.04, ridge: 0,    sharp: 0.03,  glow: 0.45, mesh: 0.24 },
      skills:     { swell: 0.35, ridge: 0.15, sharp: 0.03,  glow: 0.45, mesh: 0.1 },
      about:      { swell: 0.9,  ridge: 0.45, sharp: 0.025, glow: 0.6,  mesh: 0.08 }
    };
    const cur = Object.assign({}, SHAPES.hero);
    let W = 0, H = 0, cols = 70, rows = 30, near = [232, 191, 106], far = [91, 132, 255], alpha = 1;
    let mx = -9999, my = -9999, running = false, raf = 0;
    const hex = h => { h = h.trim().replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    function recolor() {
      const cs = getComputedStyle(root);
      near = hex(cs.getPropertyValue('--accent')); far = hex(cs.getPropertyValue('--blue'));
      alpha = parseFloat(cs.getPropertyValue('--world-alpha')) || 1;
      if (!running) draw(performance.now());
    }
    function size() {
      // 1x is plenty: the canvas sits under a CSS blur, and every extra pixel is redrawn 60 times a second
      const small = innerWidth < 700, dpr = Math.min(window.devicePixelRatio || 1, 1);
      cols = small ? 44 : 70; rows = small ? 22 : 30;
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const height = (x, z, t, s) => s.swell * (0.065 * Math.sin(3.1 * x + t * 0.5 + z * 3.7) + 0.04 * Math.sin(6.3 * x - t * 0.37 + z * 8.1) + 0.03 * Math.sin(9.7 * z + t * 0.42))
      + (0.1 + 0.16 * z) * s.ridge * Math.exp(-((x - 0.42 + z * 0.55) ** 2) / s.sharp) * (0.75 + 0.25 * Math.sin(t * 0.35));
    const proj = (x, y, z) => { const d = z * 3.1 + 0.85, k = Math.min(W, 1500) * 0.6 / d; return [W * 0.6 + x * k * 2.1, H * 0.36 + (0.5 - y) * k]; };
    function draw(now) {
      const t = now / 1000;
      const target = SHAPES[activeId] || SHAPES.hero;
      for (const k in cur) cur[k] += (target[k] - cur[k]) * (reduced ? 1 : 0.035);
      // past the hero the world drops further out of focus so the copy on top stays readable
      const reading = !!activeId;
      if (!reduced && reading !== cv.classList.contains('is-reading')) cv.classList.toggle('is-reading', reading);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      const pts = [];
      for (let r = 0; r < rows; r++) {
        const z = r / (rows - 1), row = [];
        for (let c = 0; c < cols; c++) { const x = -1 + 2 * c / (cols - 1); row.push(proj(x, height(x, z, t, cur), z)); }
        pts.push(row);
      }
      for (let r = rows - 1; r >= 0; r--) {            // back to front, blue far away to gold up close
        const z = r / (rows - 1), k = Math.pow(1 - z, 1.3);
        const col = near.map((v, i) => Math.round(far[i] + (v - far[i]) * k));
        ctx.strokeStyle = `rgba(${col},${((0.05 + 0.5 * Math.pow(1 - z, 1.8)) * cur.glow * alpha).toFixed(3)})`;
        ctx.beginPath(); pts[r].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${far},${(cur.mesh * alpha).toFixed(3)})`;
      for (let c = 0; c < cols; c += 3) {
        ctx.beginPath(); for (let r = 0; r < rows; r++) { const [x, y] = pts[r][c]; r ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      }
      if (mx > -999) {                                  // pointer light: brightens only the lines already drawn
        ctx.globalCompositeOperation = 'source-atop';
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
        g.addColorStop(0, `rgba(${near},0.95)`); g.addColorStop(1, `rgba(${near},0)`);
        ctx.fillStyle = g; ctx.fillRect(mx - 220, my - 220, 440, 440);   // only the light's own square, not the whole canvas
      }
    }
    function loop(now) { draw(now); if (running) raf = requestAnimationFrame(loop); }
    function start() { if (running || reduced || document.hidden) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    size(); recolor(); draw(performance.now());
    cv.classList.add('is-on');
    if (reduced) cv.classList.add('is-reading'); // one still frame, so keep it soft everywhere
    window.addEventListener('resize', () => { size(); if (!running) draw(performance.now()); });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', recolor);
    if (finePointer) {
      window.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
      document.addEventListener('pointerleave', () => { mx = my = -9999; });
    }
    start();
    return { recolor };
  })();

  await breathe();

  /* ───────────────── TIMELINE ─────────────────
     Arrows step through the cards; the bar underneath is a real scrollbar (drag the thumb, click the track, or use arrow keys). */
  (function timeline() {
    const track = $('#pathTrack'), prev = $('#pathPrev'), next = $('#pathNext'), bar = $('#pathScroll'), thumb = $('#pathBar');
    const first = $('.pnode', track);
    const stepW = () => (first ? first.getBoundingClientRect().width + 18 : 318);
    const maxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const geo = () => {
      const bw = bar.clientWidth;
      const tw = Math.max(48, bw * Math.min(1, track.clientWidth / track.scrollWidth));
      return { bw, tw, room: Math.max(1, bw - tw) };
    };
    function update() {
      const max = maxScroll(), x = track.scrollLeft, g = geo();
      thumb.style.width = `${g.tw}px`;
      thumb.style.transform = `translate(${max > 0 ? (x / max) * g.room : 0}px, -50%)`;
      prev.disabled = x <= 2;
      next.disabled = x >= max - 2;
      bar.setAttribute('aria-valuenow', String(Math.round(max > 0 ? (x / max) * 100 : 0)));
    }
    function go(d) {
      // scrolling is free (no snap); the arrows still land on a card edge
      const s = stepW(), n = Math.max(1, Math.floor(track.clientWidth / s) - 1);
      track.scrollTo({ left: (Math.round(track.scrollLeft / s) + d * n) * s, behavior: reduced ? 'auto' : 'smooth' });
      Sound.play('slide');
    }
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    let q = false;
    track.addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; update(); }); } }, { passive: true });
    new ResizeObserver(update).observe(track);
    update();

    // drag the thumb, or press anywhere on the track to jump there and keep dragging
    let hold = null;
    function toScroll(clientX, grabAt) {
      const r = bar.getBoundingClientRect(), g = geo();
      const pos = Math.min(g.room, Math.max(0, clientX - r.left - grabAt));
      track.scrollLeft = (pos / g.room) * maxScroll();
    }
    bar.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const tr = thumb.getBoundingClientRect();
      const onThumb = e.clientX >= tr.left && e.clientX <= tr.right;
      hold = { grabAt: onThumb ? e.clientX - tr.left : geo().tw / 2 };
      bar.setPointerCapture(e.pointerId);
      bar.classList.add('is-held');
      track.classList.add('is-dragging');
      toScroll(e.clientX, hold.grabAt);
    });
    bar.addEventListener('pointermove', e => { if (hold) toScroll(e.clientX, hold.grabAt); });
    const release = () => {
      if (!hold) return;
      hold = null;
      bar.classList.remove('is-held');
      track.classList.remove('is-dragging');
    };
    bar.addEventListener('pointerup', release);
    bar.addEventListener('pointercancel', release);
    bar.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { go(e.key === 'ArrowRight' ? 1 : -1); e.preventDefault(); }
      else if (e.key === 'Home' || e.key === 'End') { track.scrollTo({ left: e.key === 'Home' ? 0 : maxScroll(), behavior: reduced ? 'auto' : 'smooth' }); e.preventDefault(); }
    });
  })();

  /* ───────────────── FP&A TRAINING DESK ───────────────── */
  const TASKS = typeof FB_TASKS !== 'undefined' ? FB_TASKS : [];
  const PHASES = typeof FB_PHASES !== 'undefined' ? FB_PHASES : [];
  const COMPANY = typeof FB_COMPANY !== 'undefined' ? FB_COMPANY : {};
  const statusChip = active => active ? '<span class="chip chip-wip">In progress</span>' : '<span class="chip chip-live">Completed</span>';
  (function renderJournal() {
    // paused: reuse the Coming soon card look (blurred, inert, "In progress" overlay)
    if (COMPANY.status === 'paused') {
      $('#fbBody').classList.add('ws', 'is-soon');
      const inner = $('#fbInner');
      inner.classList.add('ws-blur');
      inner.inert = true;
      inner.setAttribute('aria-hidden', 'true');
      $('#fbSoon').hidden = false;
    }
    const done = TASKS.filter(t => t.status === 'done');
    const scored = done.filter(t => t.score != null);
    $('#fbStats').hidden = done.length === 0;
    $('#fbDone').textContent = done.length;
    $('#fbScore').textContent = scored.length ? (scored.reduce((a, t) => a + t.score, 0) / scored.length).toFixed(1) : '–';
    $('#fbDeliv').textContent = done.reduce((a, t) => a + (t.links || []).length, 0);
    if (COMPANY.booksClosed) $('#fbClosed').textContent = COMPANY.booksClosed;

    const current = (TASKS[0] || {}).phase;
    const seen = new Set(TASKS.map(t => t.phase));
    $('#fbCycle').innerHTML = PHASES.map(([k, label]) =>
      `<li class="${k === current ? 'is-now' : seen.has(k) ? 'is-done' : ''}"><span class="pip"></span>${esc(label)}</li>`).join('');

    $('#fbList').innerHTML = TASKS.map(t => {
      const active = t.status === 'active';
      const side = t.score != null
        ? `<span class="entry-score">${esc(t.score)}<small>/10</small></span><span>Review score</span>`
        : active ? '' : '<span>Submitted</span>';
      return `<button class="entry rise" type="button" data-case="${esc(t.id)}" id="${esc(t.id)}">
        <div class="entry-num"><small>Task</small>${esc(t.num)}</div>
        <div>
          <div class="entry-meta"><span class="chip">${esc(t.category)}</span>${statusChip(active)}</div>
          <h3 class="entry-title">${esc(t.title)}</h3>
          <p class="entry-blurb">${esc(t.blurb)}</p>
        </div>
        <div class="entry-side">${side}<span class="entry-open">Open entry →</span></div>
      </button>`;
    }).join('');
  })();

  function journalHTML(t) {
    const active = t.status === 'active';
    const block = (h, body) => body ? `<h4>${h}</h4><p>${esc(body)}</p>` : '';
    const review = t.feedback ? `<blockquote class="review"><p>“${esc(t.feedback)}”</p><cite>Review from my mock manager (AI-simulated VP of Finance)</cite></blockquote>` : '';
    const pending = active ? `<div class="pending"><span class="live-dot"></span><span>In progress. My approach, findings and the review post here once it's submitted.</span></div>` : '';
    const score = t.score != null ? `<div><h5>Review score</h5><div class="big-score">${esc(t.score)}<small>/10</small></div></div>` : '';
    const links = (t.links || []).length ? `<div><h5>Deliverables</h5><div class="links">${t.links.map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</div></div>` : '';
    return `<h2 id="readerTitle">${esc(t.title)}</h2>
      <p class="reader-kind">Quillmere Systems (fictional) · ${esc(t.category)}</p>
      <div class="case-meta">${statusChip(active)}<span class="chip">Mock assignment</span></div>
      ${block('The ask', t.ask)}${block('My approach', t.approach)}${block('Key finding', t.finding)}${review}${pending}
      <div class="reader-facts"><div><h5>Skills</h5><div class="pills">${(t.skills || []).map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>${score}${links}</div>`;
  }

  /* ───────────────── READER ───────────────── */
  const Reader = (() => {
    const el = $('#reader'), scrim = $('#scrim'), body = $('#readerBody');
    const proj = ['case-fpa', 'case-dcf', 'case-ma'];
    const jr = TASKS.map(t => t.id);
    let cur = null, lastFocus = null, closeT;
    function group(id) { return proj.includes(id) ? proj : jr.includes(id) ? jr : null; }
    function fill(id) {
      if (proj.includes(id)) {
        const tpl = document.getElementById(id);
        body.innerHTML = '';
        body.appendChild(tpl.content.cloneNode(true));
        $('#readerLabel').textContent = tpl.dataset.label;
      } else {
        const t = TASKS.find(x => x.id === id);
        body.innerHTML = journalHTML(t);
        $('#readerLabel').textContent = `FP&A Training Desk · Task ${t.num}`;
      }
      body.scrollTop = 0;
      const g = group(id), i = g.indexOf(id);
      $('#readerPrev').disabled = g.length < 2;
      $('#readerNext').disabled = g.length < 2;
      $('#readerPrev').dataset.to = g[(i - 1 + g.length) % g.length];
      $('#readerNext').dataset.to = g[(i + 1) % g.length];
    }
    function open(id) {
      if (!group(id)) return false;
      clearTimeout(closeT);
      if (!cur) lastFocus = document.activeElement;
      cur = id;
      fill(id);
      el.hidden = false;
      requestAnimationFrame(() => { el.classList.add('is-open'); scrim.classList.add('is-open'); });
      document.body.style.overflow = 'hidden';
      try { history.replaceState(null, '', '#' + id); } catch (e) {}
      Sound.play('open');
      setTimeout(() => $('#readerClose').focus({ preventScroll: true }), 60);
      return true;
    }
    function close() {
      if (!cur) return;
      const back = proj.includes(cur) ? 'projects' : 'journal';
      cur = null;
      el.classList.remove('is-open'); scrim.classList.remove('is-open');
      document.body.style.overflow = '';
      closeT = setTimeout(() => { el.hidden = true; }, 500);
      try { history.replaceState(null, '', '#' + back); } catch (e) {}
      Sound.play('close');
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    $('#readerClose').addEventListener('click', close);
    scrim.addEventListener('click', close);
    ['#readerPrev', '#readerNext'].forEach(sel => $(sel).addEventListener('click', e => {
      cur = e.currentTarget.dataset.to;
      fill(cur);
      try { history.replaceState(null, '', '#' + cur); } catch (err) {}
      Sound.play('slide');
    }));
    el.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const f = $$('a[href], button:not([disabled])', el).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
    });
    return { open, close, get isOpen() { return !!cur; } };
  })();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-case]');
    if (b) { e.preventDefault(); Reader.open(b.dataset.case); }
  });

  /* ───────────────── QUOTES (shared by the tape, the call record and the football field) ───────────────── */
  // NBIS (my call, read by the research section) and the S&P 500 (drives the tape's glow) are always on;
  // the rest rotate through a finance-desk pool, 13 at a time, so a refresh is 15 requests and every name gets a turn
  const PINNED = ['NBIS', '^GSPC'];
  const POOL = ['^IXIC', '^DJI', '^TNX', 'CL=F', 'GC=F', 'EURUSD=X', 'BTC-USD', 'IWM',
    'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOG', 'META', 'JPM', 'GS', 'BAC', 'MS', 'BRK-B', 'V', 'MA',
    'JNJ', 'UNH', 'LLY', 'XOM', 'CVX', 'CAT', 'WMT', 'COST', 'TSLA', 'AMD', 'PLTR', 'NFLX'];
  const WINDOW = 13;
  const LABELS = { '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq', '^DJI': 'Dow', '^TNX': '10Y Yield', 'CL=F': 'WTI Crude', 'GC=F': 'Gold',
    'EURUSD=X': 'EUR/USD', 'BTC-USD': 'Bitcoin', 'IWM': 'Russell 2000', 'BRK-B': 'BRK.B' };
  const Quotes = { data: {}, subs: [], on(f) { this.subs.push(f); }, emit() { this.subs.forEach(f => f(this.data)); } };
  const fmtPx = p => (p == null || isNaN(p)) ? '-' : p >= 1000 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(2);
  // the 10-year is a yield, not a price; currencies trade to four decimals
  const fmtTape = (sym, p) => (p == null || isNaN(p)) ? '-' : sym === '^TNX' ? p.toFixed(2) + '%' : sym.endsWith('=X') ? p.toFixed(4) : fmtPx(p);

  (function tape() {
    const track = $('#tapeTrack');
    // each visit starts one window further along, so returning visitors see different names
    let at = (parseInt(store.get('dc-tape-at'), 10) || 0) % POOL.length;
    store.set('dc-tape-at', String((at + WINDOW) % POOL.length));
    const windowAt = i => PINNED.concat(Array.from({ length: WINDOW }, (_, k) => POOL[(i + k) % POOL.length]));
    let syms = windowAt(at);
    const item = (sym, copy) => `<a class="tk${sym === 'NBIS' ? ' is-call' : ''}" data-sym="${sym}" href="https://finance.yahoo.com/quote/${encodeURIComponent(sym)}" target="_blank" rel="noopener"${copy ? ' aria-hidden="true" tabindex="-1"' : ''}>
      <span class="tk-sym">${LABELS[sym] || sym}</span><span class="tk-px">···</span><span class="tk-ch"></span></a>`;
    function sizeTape() { track.style.setProperty('--tape-dur', Math.max(40, (track.scrollWidth / 2) / 46) + 's'); }
    function build() {
      track.innerHTML = syms.map(s => item(s, false)).join('') + syms.map(s => item(s, true)).join('');
      syms.forEach(s => { if (Quotes.data[s]) paint(s, Quotes.data[s]); });
      requestAnimationFrame(sizeTape);   // measure once the frame has laid out, instead of forcing an early layout
    }
    window.addEventListener('resize', sizeTape);

    const pauseBtn = $('#tapePause');
    pauseBtn.addEventListener('click', () => {
      const p = track.dataset.paused !== 'true';
      track.dataset.paused = String(p);
      pauseBtn.setAttribute('aria-pressed', String(p));
      pauseBtn.textContent = p ? '▶' : '❚❚';
      pauseBtn.setAttribute('aria-label', p ? 'Resume ticker' : 'Pause ticker');
    });

    function paint(sym, q, flash) {
      $$(`.tk[data-sym="${sym}"]`, track).forEach(a => {
        const up = q.pct >= 0;
        a.querySelector('.tk-px').textContent = fmtTape(sym, q.price);
        const ch = a.querySelector('.tk-ch');
        ch.innerHTML = isNaN(q.pct) ? '' : `<span class="tk-arr ${up ? 'up' : 'down'}"></span>${up ? '+' : ''}${q.pct.toFixed(2)}%`;
        ch.className = 'tk-ch ' + (up ? 'up' : 'down');
        if (flash) { a.classList.remove('flash-up', 'flash-down'); void a.offsetWidth; a.classList.add(flash); }
      });
    }

    // the tape glows green or red with the S&P 500's day; no data, no glow
    Quotes.on(data => {
      const spx = data['^GSPC'], tape = $('#tape');
      if (!spx || isNaN(spx.pct)) { delete tape.dataset.mood; tape.removeAttribute('title'); return; }
      tape.dataset.mood = spx.pct >= 0 ? 'up' : 'down';
      tape.title = `S&P 500 ${spx.pct >= 0 ? 'up' : 'down'} ${Math.abs(spx.pct).toFixed(2)}% on the day${spx.stale ? ' (last known)' : ''}`;
    });

    // last good prices, so a slow or offline feed still shows something honest
    try {
      const cached = JSON.parse(store.get('dc-quotes') || 'null');
      if (cached && cached.data) {
        Object.entries(cached.data).forEach(([s, q]) => { Quotes.data[s] = Object.assign({}, q, { stale: true, asOf: cached.t }); });
      }
    } catch (e) {}
    build();
    if (Object.keys(Quotes.data).length) Quotes.emit();

    async function fetchOne(sym) {
      try {
        const res = await fetch(`${WORKER}/?ticker=${encodeURIComponent(sym)}&_=${Date.now()}`);
        const d = await res.json();
        if (!d || d.error || d.price == null) return null;
        return { price: Number(d.price), pct: Number(d.changePct) * 100 };
      } catch (e) { return null; }
    }
    let first = true;
    async function refresh() {
      // after the first load, move the window along and only swap the names in once their prices are back
      const next = first ? syms : windowAt(at = (at + WINDOW) % POOL.length);
      first = false;
      const res = await Promise.all(next.map(fetchOne));
      if (next !== syms) { syms = next; build(); }
      let ok = 0, moved = 0;
      res.forEach((q, i) => {
        const s = syms[i];
        if (!q) return;
        ok++;
        const prev = Quotes.data[s];
        let flash = null;
        if (prev && !prev.stale && prev.price !== q.price) { flash = q.price > prev.price ? 'flash-up' : 'flash-down'; moved += q.price > prev.price ? 1 : -1; }
        Quotes.data[s] = q;
        paint(s, q, flash);
      });
      if (ok) {
        // fresh prices overwrite their own entries; names outside this window keep their last good price,
        // so a name rotating in never starts blank
        let save = {};
        try { save = (JSON.parse(store.get('dc-quotes') || 'null') || {}).data || {}; } catch (e) {}
        Object.entries(Quotes.data).forEach(([s, q]) => { if (!q.stale) save[s] = { price: q.price, pct: q.pct }; });
        store.set('dc-quotes', JSON.stringify({ t: Date.now(), data: save }));
        if (moved) Sound.play(moved > 0 ? 'up' : 'down');
      } else {
        const anyCached = Object.keys(Quotes.data).length;
        $('#tapeState').textContent = anyCached ? 'Delayed · Feed Offline' : 'Feed Offline';
        // names with no known price say so instead of looking like they're still loading
        $$('.tk', track).forEach(a => { if (!Quotes.data[a.dataset.sym]) a.querySelector('.tk-px').textContent = '-'; });
      }
      Quotes.emit();
      sizeTape();
    }
    refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 5 * 60 * 1000);
  })();

  await breathe();

  /* ───────────────── NBIS: call record + football field ───────────────── */
  const CALL = { px: 51.97, target: 60, bear: 49, bull: 70 };
  const FF_ROWS = [
    ['DCF · Exit Multiple', '4.3–5.0x · WACC 9–12%', 56.85, 82.04],
    ['DCF · Perpetuity', 'g 2.8–3.5% · WACC 9–12%', 44.41, 87.26],
    ['P/E Comps', 'Selected range', 46.69, 58.79],
    ['EV/Sales Comps', 'Selected range', 44.35, 57.83],
    ['EV/EBITDA Comps', 'Selected range', 45.52, 56.33],
    ['52-Week Range', 'At the call date', 14.09, 55.75]
  ];
  let ffLive = null;
  function renderFF(live) {
    ffLive = live;
    const box = $('#ffChart');
    const cw = box.clientWidth || 660;
    const narrow = cw < 560;
    const W = narrow ? Math.max(280, Math.floor(cw - 12)) : 660;
    const L = narrow ? 6 : 204, R = W - (narrow ? 12 : 26);
    const top = 52, rowH = narrow ? 56 : 46, H = top + FF_ROWS.length * rowH + 34;
    const yEnd = top + FF_ROWS.length * rowH;
    let max = 110;
    if (live && live > 104) max = Math.ceil((live * 1.08) / 20) * 20;
    const step = max <= 120 ? (narrow ? 20 : 10) : max <= 240 ? (narrow ? 40 : 20) : (narrow ? 100 : 50);
    const X = v => L + (v / max) * (R - L);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" text-rendering="geometricPrecision" aria-label="Football field: implied NBIS value per share by method, with price at call $51.97, target $60${live ? ', and today ' + fmtPx(live) : ''}">`;
    s += `<defs><linearGradient id="ffBar" x1="0" x2="1" y1="0" y2="0"><stop offset="0" class="ffg0"/><stop offset="1" class="ffg1"/></linearGradient>`
      // sized to the whole chart: the vertical price lines have zero-width boxes, so a relative filter region would erase them
      + `<filter id="ffGlow" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    // zebra rows sit under everything so each method reads as one line
    FF_ROWS.forEach((r, i) => { if (i % 2 === 0) s += `<rect class="row-bg" x="0" y="${top + i * rowH + 3}" width="${W}" height="${rowH - 6}" rx="6"/>`; });
    for (let v = 0; v <= max; v += step) {
      s += `<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="${top - 6}" y2="${yEnd + 4}"/><text class="tick" x="${X(v)}" y="${H - 12}" text-anchor="${v === 0 && narrow ? 'start' : 'middle'}">$${v}</text>`;
    }
    s += `<rect class="band" x="${X(CALL.bear)}" y="${top - 6}" width="${X(CALL.bull) - X(CALL.bear)}" height="${yEnd + 10 - top}"/>`;
    s += `<line class="band-edge" x1="${X(CALL.bear)}" x2="${X(CALL.bear)}" y1="${top - 6}" y2="${yEnd + 4}"/><line class="band-edge" x1="${X(CALL.bull)}" x2="${X(CALL.bull)}" y1="${top - 6}" y2="${yEnd + 4}"/>`;
    // on phones the value ranges sit on the label line, so they're drawn last to stay above the price lines
    let narrowVals = '';
    FF_ROWS.forEach(([name, sub, lo, hi], i) => {
      if (narrow) {
        const y0 = top + i * rowH;
        s += `<g class="bar-row"><text class="lbl" x="${L + 4}" y="${y0 + 20}">${esc(name)}</text>
          <rect class="bar" style="--i:${i}" filter="url(#ffGlow)" x="${X(lo)}" y="${y0 + 28}" width="${X(hi) - X(lo)}" height="14" rx="3"/></g>`;
        narrowVals += `<text class="val val-n" x="${R}" y="${y0 + 20}" text-anchor="end">$${lo.toFixed(2)} – $${hi.toFixed(2)}</text>`;
        return;
      }
      const cy = top + i * rowH + rowH / 2;
      s += `<g class="bar-row"><text class="lbl" x="12" y="${cy - 2}">${esc(name)}</text><text class="lbl-sub" x="12" y="${cy + 13}">${esc(sub)}</text>
        <rect class="bar" style="--i:${i}" filter="url(#ffGlow)" x="${X(lo)}" y="${cy - 8}" width="${X(hi) - X(lo)}" height="16" rx="3"/>
        <text class="val" x="${X(lo) - 6}" y="${cy + 4}" text-anchor="end">$${lo.toFixed(2)}</text>
        <text class="val" x="${X(hi) + 6}" y="${cy + 4}">$${hi.toFixed(2)}</text></g>`;
    });
    // tags sit on one of two rows; each takes its preferred row unless that would overlap a tag already placed
    // (on a narrow chart the call and target prices are only a few pixels apart)
    const placed = [];
    const tag = (x, y, text, cls, tcls, anchor) => {
      const w = text.length * 6.9 + 12;
      let rx = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
      rx = Math.max(0, Math.min(W - w, rx));
      const clash = row => placed.some(p => p.y === row && rx < p.x + p.w + 4 && p.x < rx + w + 4);
      if (clash(y)) y = y === 0 ? 24 : 0;
      placed.push({ x: rx, y, w });
      return `<rect class="${cls}" x="${rx}" y="${y}" width="${w}" height="18" rx="3"/><text class="tag-t ${tcls}" x="${rx + w / 2}" y="${y + 13}" text-anchor="middle">${text}</text>`;
    };
    s += `<line class="ln-call" x1="${X(CALL.px)}" x2="${X(CALL.px)}" y1="${top - 26}" y2="${yEnd + 4}"/>`;
    s += tag(X(CALL.px) - 1, 0, 'CALL $51.97', 'tag-bg-call', 'tag-t-call', 'end');
    s += `<line class="ln-target" filter="url(#ffGlow)" x1="${X(CALL.target)}" x2="${X(CALL.target)}" y1="${top - 26}" y2="${yEnd + 4}"/>`;
    s += tag(X(CALL.target) + 1, 0, 'PT $60.00', 'tag-bg-target', '', 'start');
    if (live) {
      const dn = live < CALL.px ? ' is-down' : '';
      const lx = X(live);
      s += `<line class="ln-live${dn}" filter="url(#ffGlow)" x1="${lx}" x2="${lx}" y1="${top - 6}" y2="${yEnd + 4}"/>`;
      s += tag(lx, 24, 'NOW $' + fmtPx(live), 'tag-bg-live' + dn, '', 'middle');
    }
    s += narrowVals + '</svg>';
    box.innerHTML = s;
  }
  let ffW = 0;
  new ResizeObserver(() => { const w = $('#ffChart').clientWidth; if (Math.abs(w - ffW) > 4) { ffW = w; renderFF(ffLive); } }).observe($('#ffChart'));
  renderFF(null);
  // bars draw in with light the first time the chart is reached; re-renders after that stay put
  const ffBox = $('#ffChart');
  if (!reduced && 'IntersectionObserver' in window) {
    ffBox.classList.add('is-waiting');
    const ffIo = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      ffIo.disconnect();
      ffBox.classList.replace('is-waiting', 'is-intro');
      setTimeout(() => ffBox.classList.remove('is-intro'), 2000);
    }, { threshold: 0.35 });
    ffIo.observe(ffBox);
  }
  Quotes.on(data => {
    const q = data.NBIS;
    if (!q) {
      $('#nbisDelta').textContent = 'Feed offline';
      return;
    }
    const sinceCall = (q.price - CALL.px) / CALL.px * 100;
    const vsTgt = (q.price - CALL.target) / CALL.target * 100;
    const px = $('#nbisPx');
    px.textContent = '$' + fmtPx(q.price);
    px.className = q.pct >= 0 ? 'up' : 'down';
    $('#nbisDelta').innerHTML = q.stale
      ? `Delayed · ${sinceCall >= 0 ? '+' : ''}${sinceCall.toFixed(1)}% since call`
      : `<span class="${q.pct >= 0 ? 'up' : 'down'}">${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}% today</span> · ${sinceCall >= 0 ? '+' : ''}${sinceCall.toFixed(1)}% since call`;
    const cell = $('#nbisCell');
    cell.classList.remove('flash'); void cell.offsetWidth; cell.classList.add('flash');
    renderFF(q.price);
    if (!q.stale) { ffBox.classList.remove('is-pulse'); void ffBox.offsetWidth; ffBox.classList.add('is-pulse'); }
    $('#ffFoot').innerHTML = `Today <b>$${fmtPx(q.price)}</b> is <b>${vsTgt >= 0 ? '+' : ''}${vsTgt.toFixed(1)}%</b> vs. the $60 target and <b>${sinceCall >= 0 ? '+' : ''}${sinceCall.toFixed(1)}%</b> since the call${q.stale ? ' (last known price)' : ''}. Bars are implied value per share by method; the shaded band is my bear-to-bull range.`;
  });

  /* ───────────────── DECK VIEWER ───────────────── */
  const SLIDES = ['Cover: Is NBIS the next giant in AI infrastructure?', 'Table of contents', 'Section 1 · NBIS situation overview', 'Situation overview', 'Company profile', 'Product overview', 'History of Nebius Group', 'Financial performance', 'Annotated stock chart', 'Industry overview', 'NBIS competition', 'Risk factors to growth', 'Economic indicators', 'Most recent quarter: highlights and expectations', 'CEO-level operational understanding', 'Section 2 · Financial modeling', 'Income statement', 'Assumptions', 'Balance sheet', 'Cash flow statement', 'Section 3 · Valuation', 'Comparable company analysis', 'Comparable company analysis, continued', 'DCF analysis', 'Football field analysis', 'High/low range stock chart', 'Section 4 · Investment thesis', 'Investment thesis: Buy, $60 target'];
  const pad2 = n => String(n).padStart(2, '0');
  let slide = 1;
  const thumbs = $('#thumbs');
  thumbs.innerHTML = SLIDES.map((t, i) => `<button type="button" data-s="${i + 1}" aria-label="Slide ${i + 1}: ${esc(t)}"><img src="t-${pad2(i + 1)}.jpg" alt="" loading="lazy" width="200" height="113"></button>`).join('');
  const wrapSlide = k => ((k - 1 + SLIDES.length) % SLIDES.length) + 1;
  function showSlide(n, sound) {
    const dir = n === slide ? 0 : n > slide ? 1 : -1;   // which side the new slide turns in from
    slide = wrapSlide(n);
    const img = $('#slideImg');
    img.src = `s-${pad2(slide)}.jpg`;
    // the neighbours sit angled on either side (lazy, so nothing loads until the deck is near)
    $('#slideSidePrev').src = `s-${pad2(wrapSlide(slide - 1))}.jpg`;
    $('#slideSideNext').src = `s-${pad2(wrapSlide(slide + 1))}.jpg`;
    if (dir && !reduced && img.animate) {
      img.animate([{ transform: `translateX(${dir * 14}%) rotateY(${dir * -32}deg)`, opacity: 0.35 }, { transform: 'none', opacity: 1 }],
        { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    img.alt = `Slide ${slide}: ${SLIDES[slide - 1]}`;
    $('#slideCount').textContent = `${pad2(slide)} / ${SLIDES.length}`;
    $('#slideTitle').textContent = SLIDES[slide - 1];
    $$('button', thumbs).forEach(b => b.classList.toggle('is-on', +b.dataset.s === slide));
    const on = $(`button[data-s="${slide}"]`, thumbs);
    if (on) thumbs.scrollTo({ left: on.offsetLeft - thumbs.clientWidth / 2 + on.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
    const ch = [3, 16, 21, 27];
    $$('#chapters button').forEach((b, i) => b.classList.toggle('is-on', slide >= ch[i] && (i === ch.length - 1 || slide < ch[i + 1])));
    if (sound) Sound.play('slide');
  }
  requestAnimationFrame(() => showSlide(1));
  $('#slideSidePrev').addEventListener('click', () => showSlide(slide - 1, true));
  $('#slideSideNext').addEventListener('click', () => showSlide(slide + 1, true));
  $('#slidePrev').addEventListener('click', () => showSlide(slide - 1, true));
  $('#slideNext').addEventListener('click', () => showSlide(slide + 1, true));
  thumbs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) showSlide(+b.dataset.s, true); });
  $('#chapters').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showSlide(+b.dataset.to, true); });
  (function swipe() {
    let x0 = null;
    const st = $('#stage');
    st.addEventListener('pointerdown', e => { if (!e.target.closest('button')) x0 = e.clientX; });
    st.addEventListener('pointerup', e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) showSlide(slide + (dx < 0 ? 1 : -1), true); });
  })();
  let deckVisible = false;
  new IntersectionObserver(es => es.forEach(e => { deckVisible = e.intersectionRatio > 0.4; }), { threshold: [0, 0.4, 0.8] }).observe($('#deck'));

  /* ───────────────── PROJECTS ─────────────────
     Screens float in 3D and turn with the scroll, the tool nearest the middle of the screen takes the stage,
     each one carries a mini render of its real numbers, and "Under the hood" opens the formulas behind it. */
  (function projects() {
    const wrap = $('.cases');
    if (!wrap) return;
    const cases = $$('.case', wrap);
    const head = (t, s) => `<p class="mini-h"><b>${t}</b><span>${s}</span></p>`;
    const svg = body => `<svg viewBox="0 0 260 112">${body}</svg>`;
    // FP&A dashboard built-in demo, full year by department; costs are sign-flipped so + is favorable (dashboard's own rule)
    const VAR = [['Revenue', 4.8], ['COGS', -0.6], ['R&D', -8.8], ['S&M', -3.1], ['G&A', -1.0], ['CapEx', -1.9]];
    // Valence's own assumption sliders at their defaults (dcf-calculator.html): [label, min, max, default %]
    const SLIDERS = [['Rev Growth, Yr 1–5', 0, 60, 12], ['EBIT Margin', 1, 50, 18], ['D&A, % of Revenue', 0, 20, 4],
      ['CapEx, % of Revenue', 0, 30, 5], ['Terminal Growth', 0, 5, 2.5], ['WACC', 4, 25, 9]];
    // Lucite's engine on its default sample deal (accretion-dilution.html, $M): buyer 220M sh at $84 earning $760M, target 95M sh
    // at $41 earning $180M; 30% premium, 70% stock, a third of the cash borrowed at 6.5%, 4% given up on cash, $60M synergies, 25% tax
    const EPS = (() => {
      const eq = 41 * 1.3 * 95, sh = 220, newSh = eq * 0.7 / 84, eps0 = 760 / sh;
      const fund = (eq * 0.3 * 0.33 * 0.065 + eq * 0.3 * 0.67 * 0.04) * 0.75, syn = 60 * 0.75;
      const ni = 760 + 180 - fund + syn, eps1 = ni / (sh + newSh);
      return { eps0, eps1, steps: [['Buyer', eps0, 1], ['Target', 180 / sh], ['Funding', -fund / sh], ['Synergy', syn / sh], ['Shares', eps1 - ni / sh], ['Combined', eps1, 1]] };
    })();
    const build = {
      fpa() {
        const cx = 150, k = 9;
        let b = `<line class="axis" x1="${cx}" x2="${cx}" y1="0" y2="110"/>`;
        VAR.forEach(([d, v], i) => {
          const y = 4 + i * 18, w = Math.abs(v) * k, pos = v >= 0;
          b += `<text x="0" y="${y + 9}">${esc(d)}</text>`
            + `<rect class="bar ${pos ? 'pos' : 'neg'}" style="--i:${i}" x="${pos ? cx : cx - w}" y="${y}" width="${w}" height="11" rx="2"/>`
            + `<text class="num ${pos ? 'pos' : 'neg'}" x="258" y="${y + 9}" text-anchor="end">${pos ? '+' : '−'}${Math.abs(v).toFixed(1)}%</text>`;
        });
        return head('Variance vs. Plan', 'Dashboard Demo, FY') + svg(b);
      },
      dcf() {
        // a 2 × 3 panel of sliders, laid out like the tool's: label and value on top, track underneath
        const cw = 120, b = SLIDERS.map(([label, lo, hi, v], i) => {
          const x = (i % 2) * 140, y = Math.floor(i / 2) * 38, t = (v - lo) / (hi - lo) * cw;
          return `<text x="${x}" y="${y + 9}">${esc(label)}</text><text class="val" x="${x + cw}" y="${y + 9}" text-anchor="end">${v}%</text>`
            + `<rect class="track" x="${x}" y="${y + 19}" width="${cw}" height="3" rx="1.5"/>`
            + `<rect class="fill" style="--i:${i}" x="${x}" y="${y + 19}" width="${t.toFixed(1)}" height="3" rx="1.5"/>`
            + `<circle class="knob" style="--i:${i};--d:${(-t).toFixed(1)}px" cx="${(x + t).toFixed(1)}" cy="${y + 20.5}" r="4.5"/>`;
        }).join('');
        return head('Assumptions', 'Valence Defaults') + svg(b);
      },
      ma() {
        // EPS bridge: buyer's EPS, what each piece of the deal adds or takes away, and the combined EPS
        const cw = 260 / 6, bw = 24, Y = v => 94 - (v - 3) / 1.5 * 80;
        let r = 0, b = '<line class="axis" x1="0" x2="260" y1="94" y2="94"/>';
        EPS.steps.forEach(([label, v, base], i) => {
          const a = base ? 3 : r, z = base ? v : r + v, x = i * cw + (cw - bw) / 2, top = Y(Math.max(a, z));
          const kind = base ? 'base' : v >= 0 ? 'pos' : 'neg';
          b += `<rect class="wf ${kind}" style="--i:${i}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw}" height="${Math.abs(Y(a) - Y(z)).toFixed(1)}" rx="2"/>`
            + `<text class="wv ${kind === 'base' ? '' : 'num ' + kind}" style="--i:${i}" x="${(x + bw / 2).toFixed(1)}" y="${(top - 4).toFixed(1)}" text-anchor="middle">${base ? '$' + v.toFixed(2) : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2)}</text>`
            + `<text class="hd" x="${(i * cw + cw / 2).toFixed(1)}" y="107" text-anchor="middle">${label}</text>`;
          r = z;
          if (i < 5) b += `<line class="grid wv" style="--i:${i}" x1="${(x + bw).toFixed(1)}" x2="${((i + 1) * cw + (cw - bw) / 2).toFixed(1)}" y1="${Y(r).toFixed(1)}" y2="${Y(r).toFixed(1)}"/>`;
        });
        return head('EPS Bridge', `Sample Deal, +${((EPS.eps1 / EPS.eps0 - 1) * 100).toFixed(1)}%`) + svg(b);
      }
    };
    $$('.mini', wrap).forEach(m => { if (build[m.dataset.mini]) m.innerHTML = build[m.dataset.mini](); });
    wrap.classList.add('js-mini');

    // stage lighting + scroll-turned screens
    let staged = null, queued = false;
    function stage() {
      queued = false;
      const mid = window.innerHeight / 2;
      let best = null, bestD = Infinity;
      cases.forEach(c => {
        const r = c.getBoundingClientRect(), center = r.top + r.height / 2;
        if (!reduced) c.style.setProperty('--t', Math.max(-1, Math.min(1, (center - mid) / window.innerHeight)).toFixed(3));
        const d = Math.abs(center - mid);
        if (r.bottom > window.innerHeight * 0.2 && r.top < window.innerHeight * 0.8 && d < bestD) { bestD = d; best = c; }
      });
      if (best === staged) return;
      if (staged) staged.classList.remove('is-stage');
      staged = best;
      wrap.classList.toggle('has-stage', !!best);
      if (best) { best.classList.add('is-stage'); best.classList.remove('is-played'); void best.offsetWidth; best.classList.add('is-played'); }
    }
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(stage); } }, { passive: true });
    window.addEventListener('resize', stage);
    requestAnimationFrame(stage);

    // under the hood: the screen swings open like a door
    $$('[data-peel]').forEach(btn => {
      const hood = document.getElementById(btn.dataset.peel), box = hood.closest('.case-stage');
      btn.addEventListener('click', () => {
        const open = !box.classList.contains('is-peeled');
        box.classList.toggle('is-peeled', open);
        hood.toggleAttribute('inert', !open);
        btn.setAttribute('aria-expanded', String(open));
        btn.textContent = open ? 'Back to the Tool' : 'Under the Hood';
        Sound.play(open ? 'open' : 'close');
      });
    });
  })();

  /* ───────────────── SKILL CARDS: a soft light that follows the pointer ───────────────── */
  if (finePointer && !reduced) {
    $$('.skill-card').forEach(card => card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--cx', `${e.clientX - r.left}px`);
      card.style.setProperty('--cy', `${e.clientY - r.top}px`);
    }));
  }

  /* ───────────────── COPY EMAIL ───────────────── */
  function copyEmail() {
    const done = () => { toast('Copied ' + EMAIL); Sound.play('chime'); };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = EMAIL; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      ok ? done() : toast(EMAIL);
    };
    try { navigator.clipboard.writeText(EMAIL).then(done, fallback); } catch (e) { fallback(); }
  }
  $$('[data-copy-email]').forEach(b => b.addEventListener('click', copyEmail));

  /* ───────────────── KEYBOARD ───────────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (Reader.isOpen) Reader.close(); else setMenu(false); return; }
    if (Reader.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    // arrows page through the deck while it's on screen; elsewhere they keep their normal job
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && deckVisible) {
      showSlide(slide + (e.key === 'ArrowRight' ? 1 : -1), true);
      e.preventDefault();
    }
  });

  /* ───────────────── ENTRANCES ─────────────────
     Only things below the fold at load animate in; everything starts readable. */
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('.rise').forEach(el => {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('pre'); io.observe(el); }
    });
  }

  /* deep links: #case-dcf, #fb-01 open the reader */
  const h = location.hash.slice(1);
  if (h && (h.startsWith('case-') || TASKS.some(t => t.id === h))) setTimeout(() => Reader.open(h), 400);

  /* coursework: a link to #coursework opens the library first, so the jump lands on an open list */
  const courses = $('#coursework');
  document.addEventListener('click', e => { if (e.target.closest('a[href="#coursework"]')) courses.open = true; });
  if (location.hash === '#coursework') courses.open = true;
  courses.addEventListener('toggle', () => Sound.play(courses.open ? 'open' : 'close'));

  /* print: open every role and the coursework so the printout is complete */
  window.addEventListener('beforeprint', () => $$('details.xp, details.courses').forEach(d => { d.dataset.wasOpen = d.open; d.open = true; }));
  window.addEventListener('afterprint', () => $$('details.xp, details.courses').forEach(d => { d.open = d.dataset.wasOpen === 'true'; }));
  $$('details.xp').forEach(d => d.addEventListener('toggle', () => Sound.play(d.open ? 'open' : 'close')));

  console.log('%cDC%c  Thanks for reading the source. Hiring for FP&A or corporate finance? ' + EMAIL,
    'background:#e8bf6a;color:#1a1203;font-weight:700;padding:2px 6px;border-radius:3px', 'color:inherit');
})();
