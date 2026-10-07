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
    if (timer) return;                                   // läuft schon
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
  // ---- Anheften, Verschieben, Kompakt (gespeichert in 3nps-perf) ----
  const home = pop.parentNode, homeNext = pop.nextSibling;
  let st = { pin: false, compact: false, x: null, y: null };
  try { Object.assign(st, JSON.parse(localStorage.getItem('3nps-perf') || '{}')); } catch (e) {}
  const saveSt = () => { try { localStorage.setItem('3nps-perf', JSON.stringify(st)); } catch (e) {} };
  const pinBtn = $('pfPin'), cmpBtn = $('pfCompact'), closeBtn = $('pfClose'), head = $('pfHead');
  function clamp() {
    if (!st.pin) return;
    const w = pop.offsetWidth || 300, h = pop.offsetHeight || 200;
    const maxX = Math.max(4, innerWidth - w - 4), maxY = Math.max(4, innerHeight - 44);
    st.x = Math.min(Math.max(4, st.x == null ? 16 : st.x), maxX);
    st.y = Math.min(Math.max(4, st.y == null ? 90 : st.y), maxY);
    pop.style.left = st.x + 'px'; pop.style.top = st.y + 'px';
  }
  function applyPin() {
    // Position vor dem Umschalten messen (danach gilt position: fixed, und top: 100% würde nach unten springen)
    if (st.pin && st.x == null && pop.parentNode !== document.body && !pop.hidden) { const r = pop.getBoundingClientRect(); st.x = r.left; st.y = r.top; }
    pop.classList.toggle('pinned', st.pin); pop.classList.toggle('compact', st.compact);
    pinBtn.setAttribute('aria-pressed', st.pin ? 'true' : 'false'); cmpBtn.setAttribute('aria-pressed', st.compact ? 'true' : 'false');
    pinBtn.textContent = st.pin ? 'Angeheftet' : 'Anheften';
    if (st.pin) {
      if (pop.parentNode !== document.body) {
        document.body.appendChild(pop);              // eigene Ebene: liegt über allem, unabhängig von der Kopfleiste
      }
      clamp();
    } else {
      if (pop.parentNode !== home) home.insertBefore(pop, homeNext);
      pop.style.left = pop.style.top = '';
    }
  }
  function setPin(on) { st.pin = on; saveSt(); applyPin(); }
  pinBtn.addEventListener('click', () => setPin(!st.pin));
  cmpBtn.addEventListener('click', () => { st.compact = !st.compact; saveSt(); applyPin(); });
  closeBtn.addEventListener('click', () => { if (st.pin) setPin(false); setOpen(false); });
  // Ziehen an der Titelzeile (Finger, Stift oder Maus). Ziehen heftet automatisch an.
  let drag = null;
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    if (!st.pin) setPin(true);
    const r = pop.getBoundingClientRect();
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
    try { head.setPointerCapture(e.pointerId); } catch (er) {}
    pop.classList.add('dragging');
  });
  head.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    st.x = e.clientX - drag.dx; st.y = e.clientY - drag.dy; clamp();
  });
  const endDrag = e => { if (!drag || e.pointerId !== drag.id) return; drag = null; pop.classList.remove('dragging'); saveSt(); };
  head.addEventListener('pointerup', endDrag); head.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => { if (st.pin) clamp(); });

  function setOpen(on) {
    if (on === open) return;
    open = on; pop.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { applyPin(); if (!st.pin) document.dispatchEvent(new CustomEvent('hdrpop', { detail: 'perf' })); start(); } else stop();
  }
  btn.addEventListener('click', e => { e.stopPropagation(); if (open && st.pin) { clamp(); return; } setOpen(!open); });
  pop.addEventListener('click', e => e.stopPropagation());
  // Zuklappen durch Tipp daneben, Esc oder den anderen Kopf-Knopf – nur, solange nicht angeheftet
  document.addEventListener('click', () => { if (!st.pin) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !st.pin) setOpen(false); });
  document.addEventListener('hdrpop', e => { if (e.detail !== 'perf' && !st.pin) setOpen(false); });
  // Im Hintergrund nicht messen; angeheftet beim Zurückkommen weitermessen
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (open) { if (st.pin) stop(); else setOpen(false); } }
    else if (open && st.pin) start();
  });
  applyPin();
  if (st.pin) setTimeout(() => setOpen(true), 0);     // angeheftet bleibt es auch nach dem Neustart offen
  window.PerfView = { open: () => setOpen(true), close: () => setOpen(false), pin: setPin, state: () => Object.assign({ open }, st) };
})();
