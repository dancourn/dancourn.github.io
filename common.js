/* Shared page chrome for every page on the site: sound effects, the light/dark switch and the toast.
   Each page needs #soundBtn, #themeBtn and #toast in its markup, and loads this before its own script.
   Pages react to a theme change by listening for the 'dc-theme' event (e.g. to recolor a canvas). */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  /* ───────────────── SOUND ─────────────────
     Every sound is synthesized on the fly with Web Audio. Off by default; the choice carries across pages. */
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
      if (!b) return;
      b.setAttribute('aria-pressed', String(v));
      // SVG paths have no .hidden property, so set the attribute itself
      b.querySelector('.snd-on').toggleAttribute('hidden', !v);
      b.querySelector('.snd-off').toggleAttribute('hidden', v);
      b.title = v ? 'Sound on' : 'Sound off';
    }
    return { play, setEnabled, get enabled() { return enabled; }, toggle() { setEnabled(!enabled); if (enabled) play('chime'); toast(enabled ? 'Sound on' : 'Sound off'); } };
  })();
  Sound.setEnabled(Sound.enabled);
  $('#soundBtn')?.addEventListener('click', () => Sound.toggle());

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
  const root = document.documentElement;
  const effectiveTheme = () => root.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.classList.add('theme-swap');   // site.css: transitions off for the switch, so every color changes in the same frame
    root.setAttribute('data-theme', next);
    void root.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-swap')));
    store.set('dc-theme', next);
    document.dispatchEvent(new CustomEvent('dc-theme', { detail: next }));
    Sound.play('theme');
    $('#themeBtn').title = next === 'dark' ? 'Dark theme' : 'Light theme';
  }
  $('#themeBtn')?.addEventListener('click', toggleTheme);

  window.DC = { Sound, toast, store };
})();
