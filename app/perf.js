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
  // Audio-Hänger: In Fenstern von 1 s muss die Audio-Uhr so weit laufen wie die echte Uhr.
  // Bleibt sie > 30 ms zurück, hat die Audioausgabe gestockt (Puffer leer, Gerät/Takt).
  const au = { t: 0, a: 0, n: 0, ms: 0, late0: null };
  function audioCheck(now) {
    const ctx = typeof audioCtx !== 'undefined' ? audioCtx : null;
    if (!ctx || ctx.state !== 'running') { au.t = 0; return; }
    if (!au.t) { au.t = now; au.a = ctx.currentTime; return; }
    if (now - au.t < 1000) return;
    const wall = now - au.t, aud = (ctx.currentTime - au.a) * 1000, lag = wall - aud;
    if (lag > 30 && wall < 3000) { au.n++; au.ms += lag; }          // längere Lücken = Tab im Hintergrund, nicht zählen
    au.t = now; au.a = ctx.currentTime;
  }
  function step() {
    const now = performance.now(), dt = now - lastT; lastT = now;
    span += dt; busy += Math.max(0, dt - STEP - 2);
    audioCheck(now);
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
    const ctx0 = typeof audioCtx !== 'undefined' ? audioCtx : null;
    set('pfStall', ctx0 && ctx0.state === 'running' ? (au.n ? au.n + ' × (' + fmt(au.ms) + ' ms)' : '0') : 'Audio aus');
    let late = null; try { if (typeof Rhythm !== 'undefined' && Rhythm.debug) { const l = Rhythm.debug().late || 0; if (au.late0 == null) au.late0 = l; late = l - au.late0; } } catch (e) {}
    set('pfLate', late == null ? '–' : String(late));
    const appSr = ctx0 ? ctx0.sampleRate : null, devSr = L && L.mic ? L.inSr : null;
    set('pfRate', appSr ? fmt(appSr / 1000, 1) + (devSr && devSr !== appSr ? ' / Gerät ' + fmt(devSr / 1000, 1) : '') + ' kHz' : '–');

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
    if (L && L.gaps) note += 'Aussetzer: das iPad kam mit dem Eingang nicht hinterher. ';
    if (au.n) note = 'Audio-Hänger: Die Wiedergabe hat ' + au.n + '× kurz gestockt. ' + note;
    if (L && L.mic && L.inSr && ctx0 && L.inSr !== ctx0.sampleRate) note = 'Gerät und App laufen mit verschiedener Abtastrate – Safari muss umrechnen, das kann stocken. ' + note;
    if (L && !L.mic && L.micErr) note = 'Eingang ließ sich nicht öffnen – Ursache: ' + L.micErr + '. ' + note;
    set('pfNote', note.trim());
  }

  function start() {
    if (timer) return;                                   // läuft schon
    au.t = 0; au.n = 0; au.ms = 0; au.late0 = null;
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
    show(); showLog();
  }
  function stop() {
    clearInterval(timer); timer = 0; cancelAnimationFrame(raf); raf = 0;
    try { if (rc) rc.stop(); } catch (e) {}
  }
  // ---- Anheften, Verschieben, Kompakt (gespeichert in 3nps-perf) ----
  const home = pop.parentNode, homeNext = pop.nextSibling;
  let st = { pin: false, compact: false, x: null, y: null };
  // Eigener Schlüssel 3nps-perfwin (3nps-perf gehört der Einstellung „Leistung“ im Looper).
  // v35/v36 schrieben versehentlich nach 3nps-perf → einmalig umziehen und die Einstellung reparieren.
  try {
    const old = localStorage.getItem('3nps-perf');
    if (old && old.charAt(0) === '{') {
      if (!localStorage.getItem('3nps-perfwin')) localStorage.setItem('3nps-perfwin', old);
      localStorage.setItem('3nps-perf', 'auto');
    }
    Object.assign(st, JSON.parse(localStorage.getItem('3nps-perfwin') || '{}'));
  } catch (e) {}
  const saveSt = () => { try { localStorage.setItem('3nps-perfwin', JSON.stringify(st)); } catch (e) {} };
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
  // ---- Wächter im Hintergrund (auch bei geschlossenem Fenster, 1× pro Sekunde, nur bei laufenden Drums) ----
  // Bleibt die Audio-Uhr wiederholt hinter der echten Zeit zurück, stockt die Wiedergabe → einmal einen Rat geben.
  const wd = { t: 0, a: 0, hits: [], told: false };
  setInterval(() => {
    const ctx = typeof audioCtx !== 'undefined' ? audioCtx : null, now = performance.now();
    const drums = typeof Rhythm !== 'undefined' && Rhythm.on && Rhythm.on();
    if (!ctx || ctx.state !== 'running' || document.hidden) { wd.t = 0; return; }
    if (!wd.t) { wd.t = now; wd.a = ctx.currentTime; return; }
    const t0 = wd.t, wall = now - wd.t, lag = wall - (ctx.currentTime - wd.a) * 1000;
    wd.t = now; wd.a = ctx.currentTime;
    if (wall > 3000 || lag <= 30) return;
    logHang(t0, now, lag, drums);
    if (!drums) return;
    wd.hits.push(now); while (wd.hits.length && now - wd.hits[0] > 60000) wd.hits.shift();
    if (wd.hits.length < 3 || wd.told) return;
    wd.told = true;
    const big = window.__audioHint === 'playback';
    const msg = big
      ? 'Die Wiedergabe stockt ab und zu, obwohl der große Audio-Puffer aktiv ist. Probier bei den Drums „Raum“ auszuschalten.'
      : 'Die Wiedergabe stockt ab und zu (häufig mit USB-Verstärkern). Abhilfe: unter „Leistung“ „Stabil – großer Audio-Puffer“ wählen und die App neu starten, oder bei den Drums „Raum“ ausschalten.';
    const el = document.getElementById('loopStatus'); if (el) el.textContent = msg;
  }, 1000);

  // ---- Hänger-Protokoll: Uhrzeit, Dauer und was die App in dieser Sekunde tat (± 0,5 s) ----
  const hangLog = [];
  const two = n => (n < 10 ? '0' : '') + n;
  function logHang(t0, t1, lag, drums) {
    const evs = (window.__appEv || []).filter(e => e[0] >= t0 - 500 && e[0] <= t1 + 100).map(e => e[1]);
    const d = new Date();
    const state = [window.__live ? 'Live' : '', drums ? 'Drums' : '', (typeof Looper !== 'undefined' && Looper.debug && Looper.debug().mic) ? 'Eingang' : ''].filter(Boolean).join('+');
    hangLog.push(two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()) + '  ' + Math.round(lag) + ' ms  ' +
      (evs.length ? 'App: ' + [...new Set(evs)].join(', ') : 'App: nichts') + (state ? '  [' + state + ']' : ''));
    if (hangLog.length > 300) hangLog.splice(0, 100);
    showLog();
  }
  const logEl = $('pfLog');
  function logText() {
    const n = hangLog.length, ext = hangLog.filter(l => l.includes('App: nichts')).length;
    return n ? 'Hänger: ' + n + ' · davon ohne App-Ereignis: ' + ext + '\n' + hangLog.slice().reverse().join('\n') : 'noch keine Hänger';
  }
  function showLog() { if (logEl && open) logEl.textContent = logText(); }
  const cpyBtn = $('pfCopy'), clrBtn = $('pfClear');
  if (cpyBtn) cpyBtn.addEventListener('click', () => {
    const txt = '3nps-Looper Hänger-Protokoll ' + new Date().toLocaleString('de-DE') + '\n' + logText();
    const ok = () => { cpyBtn.textContent = 'Kopiert ✓'; setTimeout(() => { cpyBtn.textContent = 'Kopieren'; }, 1500); };
    try { navigator.clipboard.writeText(txt).then(ok, () => { selectLog(); }); } catch (e) { selectLog(); }
  });
  function selectLog() { try { const r = document.createRange(); r.selectNodeContents(logEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); cpyBtn.textContent = 'markiert – kopieren'; } catch (e) {} }
  if (clrBtn) clrBtn.addEventListener('click', () => { hangLog.length = 0; showLog(); });
  document.addEventListener('tabchange', e => { if (window.__appEvent) window.__appEvent('Reiter ' + e.detail); });
  document.addEventListener('rhythm', e => { if (window.__appEvent) window.__appEvent(e.detail && e.detail.on ? 'Drums an' : 'Drums aus'); });
  document.addEventListener('visibilitychange', () => { if (window.__appEvent) window.__appEvent(document.hidden ? 'App im Hintergrund' : 'App vorne'); });

  window.PerfView = { open: () => setOpen(true), close: () => setOpen(false), pin: setPin, state: () => Object.assign({ open }, st) };
})();
