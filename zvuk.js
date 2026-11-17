// Звук шапки: петля ветра + случайные вставки (ковка, шахта, птицы, голоса). Настройки - звук_шапки.json через data-cfg.
(function () {
  const btn = document.getElementById('sndbtn'); if (!btn) return;
  const C = JSON.parse(btn.dataset.cfg), H = btn.closest('.hero, .big');
  let ctx = null, master = null, bufs = {}, on = false, timers = [], started = false;
  const S = window.__fsSound = { on: false, loaded: 0, inserts: [], ctx: null };
  const rnd = (a, b) => a + Math.random() * (b - a);
  function heroFrac() { const r = H.getBoundingClientRect(); return Math.max(0, Math.min(1, r.bottom / Math.max(1, r.height))); }
  // страница открывается и с диска (file://), где fetch запрещён - звук берём из zvuk_dannye.js (base64), он подгружается по первому клику
  function data() { return window.__FS_SND ? Promise.resolve() : new Promise((ok, bad) => { const s = document.createElement('script'); s.src = btn.dataset.src || 'zvuk_dannye.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
  async function load(u) {
    await data(); const b64 = (window.__FS_SND || {})[u];
    if (b64) { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return ctx.decodeAudioData(a.buffer); }
    const r = await fetch(u); return ctx.decodeAudioData(await r.arrayBuffer());
  }
  async function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)(); S.ctx = ctx;
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const files = [C['петля']['файл'], ...C['вставки'].map(v => v['файл'])];
    await Promise.all(files.map(async f => { bufs[f] = await load(f); S.loaded++; }));
    // петля ветра: бесшовно (loop буфера), сторона медленно гуляет
    const src = ctx.createBufferSource(); src.buffer = bufs[C['петля']['файл']]; src.loop = true;
    const g = ctx.createGain(); g.gain.value = C['петля']['громкость'];
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 1 / 23; lg.gain.value = C['петля']['качание_сторон'] || 0; lfo.connect(lg); lg.connect(pan.pan); lfo.start(); src.connect(g); g.connect(pan); pan.connect(master); }
    else { src.connect(g); g.connect(master); }
    src.start(); S.loop = src; started = true;
  }
  function insert(v) {
    if (!on) return;
    const b = bufs[v['файл']], d = Math.min(b.duration, rnd(v['длит'][0], v['длит'][1])), off = rnd(0, Math.max(0, b.duration - d));
    const s = ctx.createBufferSource(); s.buffer = b; const g = ctx.createGain(), t = ctx.currentTime, f = Math.min(1.2, d / 3), vol = v['громкость'] * rnd(0.7, 1.1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + f); g.gain.setValueAtTime(vol, t + d - f); g.gain.linearRampToValueAtTime(0, t + d);
    let out = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.7, 0.7); g.connect(p); out = p; }
    s.connect(g); out.connect(master); s.start(t, off, d);
    S.inserts.push({ имя: v['имя'], t: +t.toFixed(1), длит: +d.toFixed(1) });
  }
  // первые вставки разнесены (птицы раньше, голоса позже), дальше - случайные паузы из настроек
  function plan(v, first, i) { timers.push(setTimeout(() => { insert(v); plan(v); }, (first ? rnd(3, 7) + i * 6 : rnd(v['пауза'][0], v['пауза'][1])) * 1000)); }
  function level() { if (!ctx) return; const target = on ? C['громкость'] * heroFrac() : 0; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(target, ctx.currentTime, on ? 0.6 : 0.25); S.target = +target.toFixed(3); }
  async function toggle() {
    on = !on; S.on = on; btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); btn.querySelector('span').textContent = on ? 'Звук вкл' : 'Звук';
    if (on) { if (!started) { btn.classList.add('wait'); try { await init(); } finally { btn.classList.remove('wait'); } } await ctx.resume(); level(); [...C['вставки']].sort((a, b) => a['пауза'][0] - b['пауза'][0]).forEach((v, i) => plan(v, true, i)); }
    else { timers.forEach(clearTimeout); timers = []; level(); setTimeout(() => { if (!on && ctx) ctx.suspend(); }, 1500); }
  }
  btn.addEventListener('click', ev => { ev.stopPropagation(); toggle(); });
  btn.addEventListener('pointerdown', ev => ev.stopPropagation());
  addEventListener('scroll', level, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!ctx || !on) return; document.hidden ? ctx.suspend() : ctx.resume(); });
})();
