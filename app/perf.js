/* ---------- Leistungsanzeige im Kopf: Rechenlast, Arbeitsspeicher, Latenz ----------
   Misst nur, solange das Fenster offen ist – zugeklappt läuft hier nichts. */
(() => {
  const $ = id => document.getElementById(id);
  const btn = $('perfBtn'), pop = $('perfPop');
  if (!btn || !pop) return;
  const fmt = (v, d = 0) => v.toFixed(d).replace('.', ',');
  const set = (id, t) => { const e = $(id); if (e && e.textContent !== t) e.textContent = t; };
  function bar(id, frac, warn, hot) {
    const e = $(id); if (!e) return;
    const f = Math.max(0, Math.min(1, frac || 0));
    e.style.width = (f * 100).toFixed(1) + '%';
    e.className = f >= hot ? 'hot' : f >= warn ? 'warn' : '';
  }

  let open = false, tick = 0, timer = 0, raf = 0, rc = null;
  // Bedienung: Wie lange war das Programm blockiert? (Taktgeber alle 25 ms, Verspätung = Arbeit)
  const STEP = 25; let lastT = 0, busy = 0, span = 0, cpu = 0;
  // Bildrate
  let frames = 0, fpsT = 0, fps = 0;
  // Audio-Rechenlast (nur wo der Browser sie meldet, z. B. Chrome am Mac)
  let audLoad = null;

  function loop(now) {
    frames++;
    if (now - fpsT >= 1000) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; }
    raf = requestAnimationFrame(loop);
  }
  function step() {
    const now = performance.now(), dt = now - lastT; lastT = now;
    span += dt; busy += Math.max(0, dt - STEP - 2);
    if (span >= 2000) { cpu = busy / span; busy = 0; span = 0; }
    if (++tick % 20 === 0) show();
  }

  function show() {
    // Rechenlast
    set('pfCpu', '≈ ' + fmt(cpu * 100) + ' %'); bar('pfCpuBar', cpu, 0.35, 0.65);
    set('pfFps', fps ? fmt(fps) + ' Bilder/s' : '–');
    const L = (typeof Looper !== 'undefined' && Looper.perf) ? Looper.perf() : null;
    if (audLoad != null) { set('pfAud', fmt(audLoad * 100) + ' %'); bar('pfAudBar', audLoad, 0.5, 0.8); }
    else if (L && L.mic) { const lag = Math.max(0, L.lagMs); set('pfAud', 'Rückstand ' + fmt(lag) + ' ms'); bar('pfAudBar', lag / 250, 0.4, 0.8); }
    else { set('pfAud', 'Eingang zu'); bar('pfAudBar', 0, 1, 1); }
    set('pfGaps', L && L.mic ? String(L.gaps) : '–');

    // Arbeitsspeicher
    if (L) {
      set('pfMemCur', fmt(L.curMB, 1) + ' MB');
      set('pfMemHist', fmt(L.histMB, 1) + ' / ' + L.histMax + ' MB'); bar('pfHistBar', L.histMB / L.histMax, 0.7, 0.92);
    }
    const pm = performance.memory;
    set('pfHeap', pm && pm.usedJSHeapSize ? fmt(pm.usedJSHeapSize / 1048576) + ' MB' : 'meldet Safari nicht');

    // Latenz
    const ctx = typeof audioCtx !== 'undefined' ? audioCtx : null;
    const base = ctx && ctx.baseLatency ? ctx.baseLatency * 1000 : null;
    const out = ctx && ctx.outputLatency ? ctx.outputLatency * 1000 : null;
    const inn = L && L.mic && L.inLat != null ? L.inLat * 1000 : null;
    set('pfLatIn', inn != null ? fmt(inn, 1) + ' ms' : (L && L.mic ? 'meldet Gerät nicht' : 'Eingang zu'));
    set('pfLatBase', base != null ? fmt(base, 1) + ' ms' : '–');
    set('pfLatOut', out != null ? fmt(out, 1) + ' ms' : '–');
    const sum = (inn || 0) + (base || 0) + (out || 0);
    set('pfLatSum', sum ? (inn == null ? '≥ ' : '≈ ') + fmt(sum) + ' ms' : '–');
    set('pfLatComp', L && L.comp ? L.comp + ' ms' : '–');

    let note = 'Werte meldet das Gerät selbst. ';
    if (out != null && out > 60) note = 'Ausgang über 60 ms – vermutlich Bluetooth-Kopfhörer/-Box. Zum Spielen besser Kabel oder das Interface. ';
    else if (!L || !L.mic) note += 'Für Eingangswerte im Looper „Eingang öffnen“. ';
    else note += 'Was du beim Spielen direkt hörst, kommt über den Direkt-Ausgang des Interfaces ohne diese Verzögerung. ';
    if (L && L.gaps) note += 'Aussetzer: das iPad kam mit dem Eingang nicht hinterher.';
    set('pfNote', note.trim());
  }

  function start() {
    lastT = performance.now(); busy = 0; span = 0; frames = 0; fpsT = lastT;
    timer = setInterval(step, STEP); raf = requestAnimationFrame(loop);
    try {
      const ctx = typeof audioCtx !== 'undefined' ? audioCtx : null;
      if (ctx && ctx.renderCapacity && !rc) {
        rc = ctx.renderCapacity;
        rc.addEventListener('update', e => { audLoad = e.averageLoad; });
        rc.start({ updateInterval: 1 });
      } else if (rc) rc.start({ updateInterval: 1 });
    } catch (e) { rc = null; }
    show();
  }
  function stop() {
    clearInterval(timer); timer = 0; cancelAnimationFrame(raf); raf = 0;
    try { if (rc) rc.stop(); } catch (e) {}
  }
  function setOpen(on) {
    if (on === open) return;
    open = on; pop.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { document.dispatchEvent(new CustomEvent('hdrpop', { detail: 'perf' })); start(); } else stop();
  }
  btn.addEventListener('click', e => { e.stopPropagation(); setOpen(!open); });
  pop.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('hdrpop', e => { if (e.detail !== 'perf') setOpen(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setOpen(false); });
  window.PerfView = { open: () => setOpen(true), close: () => setOpen(false) };
})();
