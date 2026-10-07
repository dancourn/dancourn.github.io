/* Training Desk page: the portfolio's 3D world, hero light, entrances, number flips, driver filter.
   Progressive like site.js: the page reads fine before any of this runs. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  /* which section is on screen: drives the world's shape (null = the hero) */
  let activeId = null;
  const spots = $$('[data-world]');
  function spy() {
    const line = innerHeight * 0.4; let id = null;
    for (const s of spots) if (s.getBoundingClientRect().top < line) id = s.dataset.world;
    activeId = id;
  }

  /* ───── WORLD ─────
     ponytail: copy of site.js WORLD with this page's shapes; extract a shared world.js if a third page needs it */
  const World = (() => {
    const cv = $('#world');
    if (!cv || !cv.getContext) return { recolor() {} };
    const ctx = cv.getContext('2d');
    const SHAPES = {
      hero:    { swell: 1,    ridge: 0.7,  sharp: 0.025, glow: 1,    mesh: 0.1 },
      how:     { swell: 0.7,  ridge: 0.3,  sharp: 0.03,  glow: 0.5,  mesh: 0.08 },
      company: { swell: 0.04, ridge: 0,    sharp: 0.03,  glow: 0.45, mesh: 0.24 },   // flat ledger grid behind the books
      tasks:   { swell: 0.35, ridge: 1.3,  sharp: 0.008, glow: 0.6,  mesh: 0.08 }
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
      const small = innerWidth < 700;
      cols = small ? 44 : 70; rows = small ? 22 : 30;
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W; cv.height = H;
    }
    const height = (x, z, t, s) => s.swell * (0.065 * Math.sin(3.1 * x + t * 0.5 + z * 3.7) + 0.04 * Math.sin(6.3 * x - t * 0.37 + z * 8.1) + 0.03 * Math.sin(9.7 * z + t * 0.42))
      + (0.1 + 0.16 * z) * s.ridge * Math.exp(-((x - 0.42 + z * 0.55) ** 2) / s.sharp) * (0.75 + 0.25 * Math.sin(t * 0.35));
    const proj = (x, y, z) => { const d = z * 3.1 + 0.85, k = Math.min(W, 1500) * 0.6 / d; return [W * 0.6 + x * k * 2.1, H * 0.36 + (0.5 - y) * k]; };
    function draw(now) {
      const t = now / 1000, target = SHAPES[activeId] || SHAPES.hero;
      for (const k in cur) cur[k] += (target[k] - cur[k]) * (reduced ? 1 : 0.035);
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
      for (let r = rows - 1; r >= 0; r--) {
        const z = r / (rows - 1), k = Math.pow(1 - z, 1.3);
        const col = near.map((v, i) => Math.round(far[i] + (v - far[i]) * k));
        ctx.strokeStyle = `rgba(${col},${((0.05 + 0.5 * Math.pow(1 - z, 1.8)) * cur.glow * alpha).toFixed(3)})`;
        ctx.beginPath(); pts[r].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${far},${(cur.mesh * alpha).toFixed(3)})`;
      for (let c = 0; c < cols; c += 3) {
        ctx.beginPath(); for (let r = 0; r < rows; r++) { const [x, y] = pts[r][c]; r ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      }
      if (mx > -999) {
        ctx.globalCompositeOperation = 'source-atop';
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
        g.addColorStop(0, `rgba(${near},0.95)`); g.addColorStop(1, `rgba(${near},0)`);
        ctx.fillStyle = g; ctx.fillRect(mx - 220, my - 220, 440, 440);
      }
    }
    function loop(now) { draw(now); if (running) raf = requestAnimationFrame(loop); }
    function start() { if (running || reduced || document.hidden) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    size(); recolor();
    cv.classList.add('is-on');
    if (reduced) cv.classList.add('is-reading');
    addEventListener('resize', () => { size(); if (!running) draw(performance.now()); });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', recolor);
    if (finePointer) {
      addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
      document.addEventListener('pointerleave', () => { mx = my = -9999; });
    }
    start();
    return { recolor };
  })();

  /* ───── THEME + SOUND: shared with every page (common.js); the world just recolors on a switch ───── */
  document.addEventListener('dc-theme', () => World.recolor());
  const Sound = (window.DC && window.DC.Sound) || { play() {} };

  /* ───── NAV: glass once scrolled, gold progress line ───── */
  const nav = $('.nav'), bar = $('#progress'), bg = $('.bg');
  function onScroll() {
    spy();
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    nav.classList.toggle('is-scrolled', y > 8);
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    bg.style.setProperty('--sp', Math.min(1, y / Math.max(1, max)).toFixed(3));
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ───── HERO SPOTLIGHT ───── */
  if (finePointer && !reduced) {
    const hero = $('.hero');
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${e.clientX - r.left}px`); hero.style.setProperty('--my', `${e.clientY - r.top}px`);
      hero.classList.add('is-lit');
    });
    hero.addEventListener('pointerleave', () => hero.classList.remove('is-lit'));
  }

  /* ───── NUMBER FLIP: digits shuffle and land, like the homepage stats ───── */
  function flip(el) {
    if (reduced || el.dataset.flipped) return;   // once only: a second flip mid-shuffle would land on a random digit
    el.dataset.flipped = '1';
    const final = el.textContent;
    const t0 = performance.now(), dur = 900;
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur), keep = Math.floor(p * final.length);
      el.textContent = final.split('').map((c, i) => i < keep || !/\d/.test(c) ? c : (Math.random() * 10) | 0).join('');
      if (p < 1) setTimeout(() => requestAnimationFrame(step), 45); else el.textContent = final;
    })(t0);
  }

  /* ───── ENTRANCES: only things below the fold rise in; numbers flip when they arrive ───── */
  // a number flips with its nearest .rise block, so ones deep inside a tall card wait until they're actually on screen
  const flipIn = block => {
    const nums = $$('[data-flip]', block).filter(f => f.closest('.rise') === block && !f.dataset.flipped);
    if (nums.length && !reduced) Sound.play('flap');   // the homepage board's split-flap tick, only when sound is on
    nums.forEach(flip);
  };
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      // entrance-only stagger delays live under .is-arriving; dropping it afterwards keeps hovers instant
      el.classList.add('is-arriving'); el.classList.remove('pre');
      setTimeout(() => el.classList.remove('is-arriving'), 1600);
      flipIn(e.target);
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('.rise').forEach(el => {
      if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pre'); io.observe(el); }
      else flipIn(el);
    });
  }

  /* ───── DRIVER FILTER: highlight one type of variance ───── */
  $$('.drv-filter button').forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    $$('.drv-filter button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(on));
    $$('.drv tbody tr').forEach(tr => tr.classList.toggle('is-dim', on && tr.dataset.type !== b.dataset.type));
  }));
})();
