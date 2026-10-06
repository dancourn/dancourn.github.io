/* Daniel Cournane · portfolio
   Everything here is progressive: the page reads fine before any of it runs. */
(function () {
  'use strict';

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
      b.querySelector('.snd-on').hidden = !v;
      b.querySelector('.snd-off').hidden = v;
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
  const prog = $('#progress');
  let scrollQueued = false, compact = false;
  function onScroll() {
    scrollQueued = false;
    const y = window.scrollY;
    const h = root.scrollHeight - window.innerHeight;
    const p = h > 0 ? Math.min(1, y / h) : 0;
    prog.style.transform = `scaleX(${p})`;
    root.style.setProperty('--sp', p.toFixed(4));
    nav.classList.toggle('is-scrolled', y > 8);
    spy();
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
    let state = 'closed', label = 'Closed', long = 'Market closed';
    if (!weekend && !HOLIDAYS.has(day)) {
      if (mins >= 570 && mins < close) { state = 'open'; label = 'Open'; long = `Open · closes in ${dur(close - mins)}`; }
      else if (mins >= 240 && mins < 570) { state = 'pre'; label = 'Pre-market'; long = `Pre-market · opens in ${dur(570 - mins)}`; }
      else if (mins >= close && mins < 1200) { state = 'after'; label = 'After hours'; long = 'After hours'; }
    } else if (HOLIDAYS.has(day)) { label = 'Holiday'; long = 'Closed for holiday'; }
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
  function flapName() {
    const lines = $$('#name .name-line');
    let flapsQueued = 0;
    lines.forEach((line, li) => {
      const word = line.dataset.text.toUpperCase();
      line.innerHTML = word.split('').map(c => `<span class="ch">${c}</span>`).join('');
      const cells = $$('.ch', line);
      cells.forEach(c => { c.style.width = c.getBoundingClientRect().width + 'px'; c.style.textAlign = 'center'; });
      if (reduced) return;
      cells.forEach((cell, i) => {
        const final = cell.textContent;
        const settle = 260 + i * 70 + li * 160 + Math.random() * 80;
        const start = performance.now();
        cell.classList.add('is-flipping');
        (function step(now) {
          if (now - start >= settle) {
            cell.textContent = final;
            cell.classList.remove('is-flipping');
            if (flapsQueued++ % 2 === 0) Sound.play('flap');
            return;
          }
          cell.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          setTimeout(() => requestAnimationFrame(step), 48);
        })(start);
      });
    });
  }
  function startName() { flapName(); }
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
      const n = Math.max(1, Math.floor(track.clientWidth / stepW()) - 1);
      track.scrollBy({ left: d * n * stepW(), behavior: reduced ? 'auto' : 'smooth' });
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
      // let snapping settle from wherever the thumb was let go
      const left = track.scrollLeft;
      track.classList.remove('is-dragging');
      track.scrollLeft = left;
    };
    bar.addEventListener('pointerup', release);
    bar.addEventListener('pointercancel', release);
    bar.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { go(e.key === 'ArrowRight' ? 1 : -1); e.preventDefault(); }
      else if (e.key === 'Home' || e.key === 'End') { track.scrollTo({ left: e.key === 'Home' ? 0 : maxScroll(), behavior: reduced ? 'auto' : 'smooth' }); e.preventDefault(); }
    });
  })();

  /* ───────────────── WORK JOURNAL ───────────────── */
  const TASKS = typeof FB_TASKS !== 'undefined' ? FB_TASKS : [];
  const PHASES = typeof FB_PHASES !== 'undefined' ? FB_PHASES : [];
  const COMPANY = typeof FB_COMPANY !== 'undefined' ? FB_COMPANY : {};
  (function renderJournal() {
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
          <div class="entry-meta"><span class="chip">${esc(t.category)}</span>${active ? '<span class="chip chip-wip">In progress</span>' : '<span class="chip chip-live">Completed</span>'}</div>
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
      <p class="reader-kind">Corvane Systems (fictional) · ${esc(t.category)}</p>
      <div class="case-meta">${active ? '<span class="chip chip-wip">In progress</span>' : '<span class="chip chip-live">Completed</span>'}<span class="chip">Mock assignment</span></div>
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
        $('#readerLabel').textContent = `Mock work journal · Task ${t.num}`;
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
  const SYMS = ['NBIS', 'SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOG', 'AMZN', 'NFLX', 'JPM', 'GS', 'AMD', 'PLTR', 'COIN', 'BTC-USD'];
  const LABELS = { 'BTC-USD': 'BTC' };
  const Quotes = { data: {}, subs: [], on(f) { this.subs.push(f); }, emit() { this.subs.forEach(f => f(this.data)); } };
  const fmtPx = p => (p == null || isNaN(p)) ? '—' : p >= 1000 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(2);

  (function tape() {
    const track = $('#tapeTrack');
    const item = (sym, copy) => `<a class="tk${sym === 'NBIS' ? ' is-call' : ''}" data-sym="${sym}" href="https://finance.yahoo.com/quote/${encodeURIComponent(sym)}" target="_blank" rel="noopener"${copy ? ' aria-hidden="true" tabindex="-1"' : ''}>
      <span class="tk-sym">${LABELS[sym] || sym}</span><span class="tk-px">···</span><span class="tk-ch"></span></a>`;
    track.innerHTML = SYMS.map(s => item(s, false)).join('') + SYMS.map(s => item(s, true)).join('');
    function sizeTape() { track.style.setProperty('--tape-dur', Math.max(40, (track.scrollWidth / 2) / 46) + 's'); }
    sizeTape();
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
        a.querySelector('.tk-px').textContent = fmtPx(q.price);
        const ch = a.querySelector('.tk-ch');
        ch.textContent = isNaN(q.pct) ? '' : `${up ? '▲' : '▼'} ${up ? '+' : ''}${q.pct.toFixed(2)}%`;
        ch.className = 'tk-ch ' + (up ? 'up' : 'down');
        if (flash) { a.classList.remove('flash-up', 'flash-down'); void a.offsetWidth; a.classList.add(flash); }
      });
    }

    // last good prices, so a slow or offline feed still shows something honest
    try {
      const cached = JSON.parse(store.get('dc-quotes') || 'null');
      if (cached && cached.data) {
        Object.entries(cached.data).forEach(([s, q]) => { Quotes.data[s] = Object.assign({}, q, { stale: true, asOf: cached.t }); paint(s, q); });
        Quotes.emit();
      }
    } catch (e) {}

    async function fetchOne(sym) {
      try {
        const res = await fetch(`${WORKER}/?ticker=${encodeURIComponent(sym)}&_=${Date.now()}`);
        const d = await res.json();
        if (!d || d.error || d.price == null) return null;
        return { price: Number(d.price), pct: Number(d.changePct) * 100 };
      } catch (e) { return null; }
    }
    async function refresh() {
      const res = await Promise.all(SYMS.map(fetchOne));
      let ok = 0, moved = 0;
      res.forEach((q, i) => {
        const s = SYMS[i];
        if (!q) return;
        ok++;
        const prev = Quotes.data[s];
        let flash = null;
        if (prev && !prev.stale && prev.price !== q.price) { flash = q.price > prev.price ? 'flash-up' : 'flash-down'; moved += q.price > prev.price ? 1 : -1; }
        Quotes.data[s] = q;
        paint(s, q, flash);
      });
      if (ok) {
        const save = {}; SYMS.forEach(s => { if (Quotes.data[s] && !Quotes.data[s].stale) save[s] = { price: Quotes.data[s].price, pct: Quotes.data[s].pct }; });
        store.set('dc-quotes', JSON.stringify({ t: Date.now(), data: save }));
        if (moved) Sound.play(moved > 0 ? 'up' : 'down');
      } else {
        const anyCached = Object.keys(Quotes.data).length;
        $('#tapeState').textContent = anyCached ? 'Delayed · feed offline' : 'Feed offline';
        if (!anyCached) $$('.tk-px', track).forEach(x => { x.textContent = '—'; });
      }
      Quotes.emit();
      sizeTape();
    }
    refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 5 * 60 * 1000);
  })();

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
    s += `<defs><linearGradient id="ffBar" x1="0" x2="1" y1="0" y2="0"><stop offset="0" class="ffg0"/><stop offset="1" class="ffg1"/></linearGradient></defs>`;
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
          <rect class="bar" x="${X(lo)}" y="${y0 + 28}" width="${X(hi) - X(lo)}" height="14" rx="3"/></g>`;
        narrowVals += `<text class="val val-n" x="${R}" y="${y0 + 20}" text-anchor="end">$${lo.toFixed(2)} – $${hi.toFixed(2)}</text>`;
        return;
      }
      const cy = top + i * rowH + rowH / 2;
      s += `<g class="bar-row"><text class="lbl" x="12" y="${cy - 2}">${esc(name)}</text><text class="lbl-sub" x="12" y="${cy + 13}">${esc(sub)}</text>
        <rect class="bar" x="${X(lo)}" y="${cy - 8}" width="${X(hi) - X(lo)}" height="16" rx="3"/>
        <text class="val" x="${X(lo) - 6}" y="${cy + 4}" text-anchor="end">$${lo.toFixed(2)}</text>
        <text class="val" x="${X(hi) + 6}" y="${cy + 4}">$${hi.toFixed(2)}</text></g>`;
    });
    const tag = (x, y, text, cls, tcls, anchor) => {
      const w = text.length * 6.9 + 12;
      let rx = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
      rx = Math.max(0, Math.min(W - w, rx));
      return `<rect class="${cls}" x="${rx}" y="${y}" width="${w}" height="18" rx="3"/><text class="tag-t ${tcls}" x="${rx + w / 2}" y="${y + 13}" text-anchor="middle">${text}</text>`;
    };
    s += `<line class="ln-call" x1="${X(CALL.px)}" x2="${X(CALL.px)}" y1="${top - 26}" y2="${yEnd + 4}"/>`;
    s += tag(X(CALL.px) - 1, 0, 'CALL $51.97', 'tag-bg-call', 'tag-t-call', 'end');
    s += `<line class="ln-target" x1="${X(CALL.target)}" x2="${X(CALL.target)}" y1="${top - 26}" y2="${yEnd + 4}"/>`;
    s += tag(X(CALL.target) + 1, 0, 'PT $60.00', 'tag-bg-target', '', 'start');
    if (live) {
      const dn = live < CALL.px ? ' is-down' : '';
      const lx = X(live);
      s += `<line class="ln-live${dn}" x1="${lx}" x2="${lx}" y1="${top - 6}" y2="${yEnd + 4}"/>`;
      s += tag(lx, 24, 'NOW $' + fmtPx(live), 'tag-bg-live' + dn, '', 'middle');
    }
    s += narrowVals + '</svg>';
    box.innerHTML = s;
  }
  let ffW = 0;
  new ResizeObserver(() => { const w = $('#ffChart').clientWidth; if (Math.abs(w - ffW) > 4) { ffW = w; renderFF(ffLive); } }).observe($('#ffChart'));
  renderFF(null);
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
    $('#ffFoot').innerHTML = `Today <b>$${fmtPx(q.price)}</b> is <b>${vsTgt >= 0 ? '+' : ''}${vsTgt.toFixed(1)}%</b> vs. the $60 target and <b>${sinceCall >= 0 ? '+' : ''}${sinceCall.toFixed(1)}%</b> since the call${q.stale ? ' (last known price)' : ''}. Bars are implied value per share by method; the shaded band is my bear-to-bull range.`;
  });

  /* ───────────────── DECK VIEWER ───────────────── */
  const SLIDES = ['Cover: Is NBIS the next giant in AI infrastructure?', 'Table of contents', 'Section 1 · NBIS situation overview', 'Situation overview', 'Company profile', 'Product overview', 'History of Nebius Group', 'Financial performance', 'Annotated stock chart', 'Industry overview', 'NBIS competition', 'Risk factors to growth', 'Economic indicators', 'Most recent quarter: highlights and expectations', 'CEO-level operational understanding', 'Section 2 · Financial modeling', 'Income statement', 'Assumptions', 'Balance sheet', 'Cash flow statement', 'Section 3 · Valuation', 'Comparable company analysis', 'Comparable company analysis, continued', 'DCF analysis', 'Football field analysis', 'High/low range stock chart', 'Section 4 · Investment thesis', 'Investment thesis: Buy, $60 target'];
  const pad2 = n => String(n).padStart(2, '0');
  let slide = 1;
  const thumbs = $('#thumbs');
  thumbs.innerHTML = SLIDES.map((t, i) => `<button type="button" data-s="${i + 1}" aria-label="Slide ${i + 1}: ${esc(t)}"><img src="assets/img/nbis/t-${pad2(i + 1)}.jpg" alt="" width="200" height="113"></button>`).join('');
  function showSlide(n, sound) {
    slide = ((n - 1 + SLIDES.length) % SLIDES.length) + 1;
    const img = $('#slideImg');
    img.src = `assets/img/nbis/s-${pad2(slide)}.jpg`;
    img.alt = `Slide ${slide}: ${SLIDES[slide - 1]}`;
    $('#slideCount').textContent = `${pad2(slide)} / ${SLIDES.length}`;
    $('#slideTitle').textContent = SLIDES[slide - 1];
    $$('button', thumbs).forEach(b => b.classList.toggle('is-on', +b.dataset.s === slide));
    const on = $(`button[data-s="${slide}"]`, thumbs);
    if (on) thumbs.scrollTo({ left: on.offsetLeft - thumbs.clientWidth / 2 + on.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
    const ch = [3, 16, 21, 27];
    $$('#chapters button').forEach((b, i) => b.classList.toggle('is-on', slide >= ch[i] && (i === ch.length - 1 || slide < ch[i + 1])));
    [slide + 1, slide - 1].forEach(k => { if (k >= 1 && k <= SLIDES.length) { const p = new Image(); p.src = `assets/img/nbis/s-${pad2(k)}.jpg`; } });
    if (sound) Sound.play('slide');
  }
  showSlide(1);
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

  /* print: open every role so the printout is complete */
  window.addEventListener('beforeprint', () => $$('details.xp').forEach(d => { d.dataset.wasOpen = d.open; d.open = true; }));
  window.addEventListener('afterprint', () => $$('details.xp').forEach(d => { d.open = d.dataset.wasOpen === 'true'; }));
  $$('details.xp').forEach(d => d.addEventListener('toggle', () => Sound.play(d.open ? 'open' : 'close')));

  console.log('%cDC%c  Thanks for reading the source. Hiring for FP&A or corporate finance? ' + EMAIL,
    'background:#e8bf6a;color:#1a1203;font-weight:700;padding:2px 6px;border-radius:3px', 'color:inherit');
})();
