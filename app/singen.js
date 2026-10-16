// ---- Reiter „Mitsingen“ (v63): großer Text mit Wortfüllung, Einzähler, Schlagpunkte, Zeile üben (auch langsam),
// Timing-Rückmeldung über das Mikrofon, Übersetzung je Zeile. Daten und Quellen kommen aus sing.js.
const Singen = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const timed = src => src && src.tok && src.tok.some(t => t.b != null);
  let ciCache = null, ciAt = 0, wordEls = [], srcTxt = '', lastBeat = -2;
  let raf = 0, lastSrc = null, speed = 1, player = null, mic = null, lineSig = '', prevB = null, res = {}, scored = {};

  // ---- Quelle: laufender Übungsplayer, sonst was gerade spielt, sonst die zuletzt gespielte ----
  function getSrc() {
    if (player) return Object.assign({}, player.src, { nowB: player.nowB() });
    const now = performance.now();
    if (!ciCache || now - ciAt > 250) { ciCache = window.SoloInfo ? SoloInfo() : null; ciAt = now; }
    const ci = ciCache;
    const s = window.Sing ? Sing.source(ci) : null;
    if (s && s.kind !== 'none' && timed(s)) { lastSrc = s; return s; }
    return lastSrc ? Object.assign({}, lastSrc, { nowB: null }) : null;
  }
  const lineOf = (src, l) => src.tok.map((t, i) => Object.assign({ i }, t)).filter(t => t.l === l);
  function focus(src) {
    const tok = src.tok, nb = src.nowB; let cur = -1, i = -1;
    if (nb != null) tok.forEach((t, j) => { if (t.b != null && nb >= t.b - 0.02 && nb < Sing.endOf(tok, j)) cur = j; });
    i = cur >= 0 ? cur : nb != null ? tok.findIndex(t => t.b != null && t.b > nb) : -1;
    if (i < 0) { const last = tok.map((t, j) => t.b != null ? j : -1).filter(j => j >= 0); i = nb != null && last.length && nb > tok[last[last.length - 1]].b ? last[last.length - 1] : tok.findIndex(t => t.b != null); }
    return { cur, line: i >= 0 ? tok[i].l : -1, idx: i };
  }

  // ---- Anzeige (jedes Bild, solange der Reiter offen ist) ----
  function frame() {
    raf = requestAnimationFrame(frame);
    const src = getSrc(), has = timed(src);
    if ($('sbEmpty').hidden !== !!has) { $('sbEmpty').hidden = !!has; $('sbStage').hidden = !has; }
    if (!has) { if (srcTxt !== '–') { srcTxt = '–'; $('sbSrc').textContent = '–'; } $('sbCount').textContent = ''; lineSig = ''; return; }
    const st = src.title + (player ? ' · ' + T('Übung') + ' ' + Math.round(speed * 100) + ' %' : ''); if (st !== srcTxt) { srcTxt = st; $('sbSrc').textContent = st; }
    const nb = src.nowB, f = focus(src);
    if (player && (f.cur < 0 || src.tok[f.cur].l !== player.line)) { f.cur = -1; f.line = player.line; }   // beim Üben nur die geübte Zeile
    // neuer Durchlauf (zurückgesprungen) → Mikrofon-Ergebnisse dieser Stelle zurücksetzen
    if (nb != null && prevB != null && nb < prevB - 0.75) { res = {}; scored = {}; lineSig = ''; }
    prevB = nb;
    // Schlagpunkte
    const dots = $('sbDots').children;
    let beatIn = -1; if (nb != null) { const lb = String(src.label(nb)).split('.'); beatIn = (+lb[1] || 1) - 1; }
    if (beatIn !== lastBeat) { lastBeat = beatIn; for (let k = 0; k < dots.length; k++) dots[k].className = k === beatIn ? (k === 0 ? 'on one' : 'on') : ''; }
    // Einzähler vor einem Einsatz nach einer Pause
    let cnt = '';
    if (nb != null && f.cur < 0) {
      const nx = src.tok.findIndex(t => t.b != null && t.b > nb);
      if (nx >= 0) {
        const pv = nx - 1, gapStart = pv >= 0 && src.tok[pv].b != null ? Sing.endOf(src.tok, pv) : -1e9, d = src.tok[nx].b - nb;
        if (src.tok[nx].b - gapStart >= 1 && d <= 3.999) cnt = d < 0.35 ? '♪' : String(Math.ceil(d - 0.35));
      }
    }
    const ce = $('sbCount'); if (ce.textContent !== cnt) { ce.textContent = cnt; ce.classList.toggle('go', cnt === '♪'); }
    // v85: ganzer Text als mitlaufende Liste – aktuelle Zeile groß in der Mitte, Akkorde darüber, Pausen mit Sekunden
    const trOn = $('sbTrOn').checked, sig = src.id + '|' + Sing.ver() + '|' + (trOn ? 1 : 0) + '|' + JSON.stringify(res).length + '|' + (player ? player.line : -1);
    if (sig !== listSig) { listSig = sig; buildList(src); curRow = -2; }
    const ms = b => (src.beatMs ? src.beatMs(b) : 500);
    // Pause: vor dem nächsten Einsatz die Sekunden zeigen (in der Pausenzeile bzw. oben)
    let gapActive = -1, waitS = null;
    if (nb != null && f.cur < 0) {
      const nx = src.tok.findIndex(t => t.b != null && t.b > nb);
      if (nx >= 0) { waitS = (src.tok[nx].b - nb) * ms(nb) / 1000; const g = gapEls[src.tok[nx].l]; if (g && nb >= g.from - 0.01 && src.tok[nx] === src.tok.find(t => t.l === src.tok[nx].l && t.b != null)) gapActive = src.tok[nx].l; }
    }
    const row = gapActive >= 0 ? 'g' + gapActive : 'l' + f.line;
    if (row !== curRow) { curRow = row; setCurrent(src, f.line, gapActive); }
    gapEls.forEach((g, l) => { if (!g) return; const on = l === gapActive; if (on !== g.on) { g.on = on; g.el.classList.toggle('on', on); }
      const txt = on && waitS != null ? T('noch ') + fmtS(waitS) : fmtS(g.dur) + ' ' + T('Pause'); if (txt !== g.txt) { g.txt = txt; g.t.textContent = txt; g.bar.style.transform = 'scaleX(' + (on && waitS != null ? Math.max(0, Math.min(1, waitS / g.dur)) : 0) + ')'; } });
    const wt = waitS != null && waitS >= 1.2 ? T('Einsatz in ') + fmtS(waitS) : ''; if (wt !== waitTxt) { waitTxt = wt; $('sbWait').textContent = wt; }
    // Füllung und Farbe: vergangene Wörter voll, aktuelles anteilig und eingefärbt
    wordEls.forEach(w => {
      const t = src.tok[w.i]; if (!t) return; let p = 0;
      if (t.b != null && nb != null) { const e = Sing.endOf(src.tok, w.i); p = nb <= t.b ? 0 : nb >= e ? 1 : (nb - t.b) / (e - t.b); }
      p = Math.round(p * 200) / 200; if (p !== w.p) { w.p = p; w.bar.style.transform = 'scaleX(' + p + ')'; const d = p >= 1; if (d !== w.done) { w.done = d; w.el.classList.toggle('done', d); } }
      const on = w.i === f.cur; if (on !== w.on) { w.on = on; w.el.classList.toggle('on', on); }
    });
    if (mic) micFrame(src, nb, f);
  }
  let listSig = '', curRow = -2, gapEls = [], waitTxt = '';
  const fmtS = x => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).toString().replace('.', ',') + ' s';
  function chordFn(src) {
    const ci = window.SoloInfo ? SoloInfo() : null;
    return b => { if (!ci || !ci.segs || b == null) return ''; let f = src.toCi(b); if (f == null) return ''; if (ci.L) f = ((f % ci.L) + ci.L) % ci.L;
      const sg = ci.segs.find(x => f >= x.a - 1 && f < x.e); return sg && sg.name && !/^(N|–|-)$/.test(sg.name) ? sg.name : ''; };
  }
  // ganze Liste aufbauen: Zeilen mit Akkorden, Übersetzung, Pausenzeilen (≥ 2 s ohne Gesang)
  function buildList(src) {
    const chAt = chordFn(src), tr = Sing.getTr(src), trOn = $('sbTrOn').checked, ms = b => (src.beatMs ? src.beatMs(b) : 500);
    const n = Math.max(-1, ...src.tok.map(t => t.l)) + 1; let h = '', lastCh = null, prevEnd = null; gapEls = [];
    for (let l = 0; l < n; l++) {
      const ws = lineOf(src, l); if (!ws.length) continue;
      const first = ws.find(t => t.b != null);
      if (first && prevEnd != null) { const dur = (first.b - prevEnd) * ms(prevEnd) / 1000; if (dur >= 2) h += '<div class="sb-gap" data-g="' + l + '" data-from="' + prevEnd + '" data-dur="' + dur + '"><i class="sb-gapbar"></i><span>♪</span><b></b></div>'; }
      let anyCh = false;
      const words = ws.map(t => { const c = chAt(t.b), show = c && c !== lastCh; if (c) lastCh = c; if (show) anyCh = true;
        return '<span class="sb-w" data-i="' + t.i + '">' + (show ? '<b class="sb-ch">' + esc(c) + '</b>' : '') + esc(t.w) + '<i class="sb-fill"></i>' + mark(t.i) + '</span>'; }).join(' ');
      h += '<div class="sb-row" data-l="' + l + '"><p class="sb-line' + (anyCh ? ' has-ch' : '') + '">' + words + '</p>' + (trOn && tr[l] ? '<p class="sb-tr">' + esc(tr[l]) + '</p>' : '<p class="sb-tr"></p>') + '</div>';
      const last = ws.filter(t => t.b != null).pop(); if (last) prevEnd = Sing.endOf(src.tok, last.i);
    }
    const list = $('sbList'); list.innerHTML = h;
    list.querySelectorAll('.sb-gap').forEach(el => { gapEls[+el.dataset.g] = { el, from: +el.dataset.from, dur: +el.dataset.dur, t: el.querySelector('b'), bar: el.querySelector('.sb-gapbar'), on: false, txt: '' }; });
    wordEls = [];
  }
  // aktuelle Zeile (bzw. Pause davor) hervorheben, Kennungen umhängen, Liste weich mitscrollen
  function setCurrent(src, line, gap) {
    const list = $('sbList'); if (!list) return;
    ['sbLine', 'sbTr'].forEach(id => { const o = document.getElementById(id); if (o && list.contains(o)) o.removeAttribute('id'); });
    list.querySelectorAll('.sb-row').forEach(r => { const l = +r.dataset.l; r.classList.toggle('cur', l === line); r.classList.toggle('past', l < line); r.classList.toggle('next', l === line + 1); });
    const row = list.querySelector('.sb-row[data-l="' + line + '"]');
    if (row) { const p = row.querySelector('.sb-line'), t = row.querySelector('.sb-tr'); p.id = 'sbLine'; t.id = 'sbTr'; }
    wordEls = row ? [...row.querySelectorAll('.sb-w')].map(el => ({ el, bar: el.querySelector('.sb-fill'), i: +el.dataset.i, p: -1, on: false, done: false })) : [];
    list.querySelectorAll('.sb-row.past .sb-w').forEach(el => el.classList.add('done'));
    list.querySelectorAll('.sb-row:not(.past):not(.cur) .sb-w').forEach(el => el.classList.remove('done', 'on'));
    const nx = lineOf(src, line + 1).map(t => t.w).join(' '); $('sbNext').textContent = nx;
    const target = gap >= 0 ? list.querySelector('.sb-gap[data-g="' + gap + '"]') : row;
    if (target) { const box = $('sbScroll'), y = target.offsetTop + target.offsetHeight / 2 - box.clientHeight * 0.4; list.style.transform = 'translateY(' + (-Math.max(0, y)).toFixed(0) + 'px)'; }
  }
  function mark(i) {
    const d = res[i]; if (d == null) return '';
    const cls = Math.abs(d) <= 70 ? 'ok' : d < 0 ? 'early' : 'late';
    return '<small class="sb-d ' + cls + '">' + (d > 0 ? '+' : '') + Math.round(d) + '</small>';
  }

  // ---- Zeile üben: eigener Player (Ausschnitt der Originaldatei, gedehnt ohne Tonhöhenänderung) ----
  function stopPlayer() {
    if (!player) return;
    try { player.node.stop(); player.node.disconnect(); player.g.disconnect(); } catch (e) {}
    player = null; ciCache = null; $('sbLoop').classList.remove('active'); $('sbLoop').textContent = T('↻ Zeile üben'); lineSig = ''; listSig = '';
  }
  async function startPlayer(line) {
    const src = getSrc();
    if (!src || src.kind !== 'file') { info(T('Zeile üben geht mit geladenen Songdateien. Für Songs aus dem Songwriting: dort das Tempo senken.')); return; }
    const words = lineOf(src, line).filter(t => t.b != null); if (!words.length) { info(T('Diese Zeile hat noch kein Timing.')); return; }
    const b0 = words[0].b - 4, b1 = Sing.endOf(src.tok, words[words.length - 1].i) + 1;
    const f0 = Sing.b2f(b0, src.beats), f1 = Sing.b2f(b1, src.beats);
    const x = Looper.singAudio(src.track, f0, f1); if (!x) { info(T('Ausschnitt nicht verfügbar.')); return; }
    stopPlayer();
    if (typeof Looper !== 'undefined' && Looper.stopAll) Looper.stopAll();
    info(T('Bereite die Zeile vor …'));
    await new Promise(r => setTimeout(r, 30));
    const y = speed === 1 ? x : Looper.stretchAudio(x, Math.round(x.length / speed));
    if (typeof ensureAudio === 'function') ensureAudio();
    const ctx = audioCtx, buf = ctx.createBuffer(2, y.length, x.sr);
    buf.copyToChannel(y.l, 0); buf.copyToChannel(y.r || y.l, 1);
    const node = ctx.createBufferSource(), g = ctx.createGain(); node.buffer = buf; node.loop = true; g.gain.value = 1;
    node.connect(g); g.connect(typeof ensureMasterBus === 'function' ? ensureMasterBus() : ctx.destination);
    const t0 = ctx.currentTime + 0.06, sr = x.sr, len = y.length, sp = speed, beats = src.beats;
    node.start(t0);
    player = { node, g, line, src: Object.assign({}, src),
      nowB: () => { const el = ctx.currentTime - t0 - (ctx.outputLatency || 0); if (el < 0) return b0; const pf = ((el * sr) % len); return Sing.f2b(f0 + pf * sp, beats); } };
    $('sbLoop').classList.add('active'); $('sbLoop').textContent = T('■ Üben beenden');
    info(T('Zeile ') + (line + 1) + ' · ' + Math.round(sp * 100) + ' % – ' + T('mit einem Takt Anlauf, in Schleife.'));
    res = {}; scored = {}; lineSig = ''; listSig = '';
  }
  function info(m) { $('sbLoopInfo').textContent = m; }

  // ---- Timing prüfen: Gesangseinsätze über das Mikrofon erkennen und mit den Wortzeiten vergleichen ----
  async function startMic() {
    if (typeof Looper === 'undefined' || !Looper.openInput) return;
    $('sbMicInfo').textContent = T('Eingang wird geöffnet …');
    const ok = await Looper.openInput(); const an = ok && Looper.inputAnalyser();
    if (!an) { $('sbMicInfo').textContent = T('Kein Zugriff auf den Eingang.'); return; }
    mic = { an, buf: new Float32Array(an.fftSize), nf: 0.004, above: false, belowSince: 0 };
    $('sbMic').classList.add('active'); $('sbMicInfo').textContent = T('Sing mit – jedes Wort bekommt grün (genau), blau (zu früh) oder orange (zu spät).');
    res = {}; scored = {}; lineSig = '';
  }
  function stopMic() {
    if (!mic) return; mic = null;
    try { Looper.releaseAnalyser(); } catch (e) {}
    $('sbMic').classList.remove('active'); $('sbMicInfo').textContent = T('Mit Kopfhörern singen – sonst hört das Mikrofon die Musik mit.');
  }
  function micFrame(src, nb, f) {
    if (nb == null) return;
    const m = mic, an = m.an; an.getFloatTimeDomainData(m.buf);
    const N = 512, B = m.buf; let s = 0; for (let k = B.length - N; k < B.length; k++) s += B[k] * B[k];
    const rms = Math.sqrt(s / N), now = performance.now();
    if (!m.above) m.nf = m.nf * 0.98 + Math.min(rms, 0.05) * 0.02;
    const thr = Math.max(0.012, m.nf * 4);
    if (!m.above && rms > thr && now - m.belowSince > 90) {
      m.above = true;
      const ctx = audioCtx, outMs = ((ctx && (ctx.outputLatency || ctx.baseLatency)) || 0) * 1000;
      const inMs = Math.max(0, (Looper.latencyMs ? Looper.latencyMs() : 0) - outMs), winMs = N / 2 / (ctx ? ctx.sampleRate : 48000) * 1000;
      const bm = src.beatMs(nb), ob = nb - (inMs + winMs) / bm;
      let best = -1, bd = 1e9;
      src.tok.forEach((t, i) => { if (t.b == null || scored[i]) return; const d = Math.abs(ob - t.b); if (d < 0.6 && d < bd) { bd = d; best = i; } });
      if (best >= 0) { scored[best] = 1; res[best] = (ob - src.tok[best].b) * bm; score(src, src.tok[best].l); }
    } else if (m.above && rms < thr * 0.5) { m.above = false; m.belowSince = now; }
  }
  function score(src, l) {
    const ws = lineOf(src, l).filter(t => t.b != null), got = ws.filter(t => res[t.i] != null);
    if (!got.length) return;
    const ok = got.filter(t => Math.abs(res[t.i]) <= 70).length, avg = got.reduce((a, t) => a + res[t.i], 0) / got.length;
    $('sbScore').textContent = T('Zeile ') + (l + 1) + ': ' + ok + T(' von ') + ws.length + T(' genau') + ' · Ø ' + (avg > 0 ? '+' : '') + Math.round(avg) + ' ms'
      + (Math.abs(avg) <= 40 ? '' : avg < 0 ? T(' (eher zu früh)') : T(' (eher zu spät)'));
  }

  // ---- Übersetzung ----
  function trLines(src) { const n = Math.max(0, ...src.tok.map(t => t.l)) + 1, tr = Sing.getTr(src); return Array.from({ length: n }, (_, i) => tr[i] || ''); }

  function init() {
    if (!$('panel-singen')) return;
    const vis = () => !$('panel-singen').hidden;
    const run = () => { if (vis()) { if (!raf) raf = requestAnimationFrame(frame); } else { cancelAnimationFrame(raf); raf = 0; stopPlayer(); stopMic(); } };
    document.addEventListener('tabchange', () => setTimeout(run, 0));
    new MutationObserver(run).observe($('panel-singen'), { attributes: true, attributeFilter: ['hidden'] });
    $('sbLoop').addEventListener('click', () => { if (player) { stopPlayer(); return; } const src = getSrc(); if (src) startPlayer(focus(src).line); });
    const setSpeed = v => {
      speed = Math.max(0.4, Math.min(1, Math.round(v * 100) / 100));
      $('sbSpeed').querySelectorAll('button').forEach(x => x.classList.toggle('active', +x.dataset.s === speed));
      $('sbSpV').textContent = Math.round(speed * 100) + ' %';
      clearTimeout(setSpeed.t); if (player) setSpeed.t = setTimeout(() => { if (player) startPlayer(player.line); }, 350);
    };
    $('sbSpeed').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSpeed(+b.dataset.s); });
    $('sbSpDn').addEventListener('click', () => setSpeed(speed - 0.01));
    $('sbSpUp').addEventListener('click', () => setSpeed(speed + 0.01));
    const step = d => {
      const src = getSrc(); if (!src) return;
      const maxL = Math.max(0, ...src.tok.map(t => t.l)), l = Math.max(0, Math.min(maxL, (player ? player.line : focus(src).line) + d));
      if (player) { startPlayer(l); return; }
      if (src.kind === 'file' && typeof Looper !== 'undefined') {
        const w = lineOf(src, l).find(t => t.b != null); if (!w) return;
        const f = Sing.b2f(w.b - 4, src.beats) - src.origPos;
        if (f >= 0 && f < src.L) Looper.seek(src.track, f); else info(T('Diese Zeile liegt außerhalb des geloopten Ausschnitts – „Zeile üben“ spielt sie trotzdem.'));
      }
    };
    $('sbList').addEventListener('click', e => { const r = e.target.closest('.sb-row'); if (!r) return; const src = getSrc(); if (!src) return; const cur = player ? player.line : focus(src).line; step(+r.dataset.l - cur); });
    $('sbPrev').addEventListener('click', () => step(-1)); $('sbNextL').addEventListener('click', () => step(1));
    $('sbMic').addEventListener('click', () => { if (mic) stopMic(); else startMic(); });
    $('sbTrOn').addEventListener('change', () => { lineSig = ''; listSig = ''; });
    $('panel-singen').querySelector('.sb-tredit').addEventListener('toggle', e => { const src = getSrc(); if (e.target.open && src) $('sbTrText').value = trLines(src).join('\n'); });
    $('sbTrSave').addEventListener('click', () => {
      const src = getSrc(); if (!src) return;
      const ok = Sing.setTr(src, $('sbTrText').value.replace(/\r/g, '').split('\n'));
      $('sbTrInfo').textContent = ok ? T('Übersetzung gespeichert.') : T('Erst Text und Timing anlegen (Improvisation → „🎤 Gesangstext“).');
    });
    $('sbTrClaude').addEventListener('click', async () => {
      const src = getSrc(); if (!src) return;
      const n = Math.max(0, ...src.tok.map(t => t.l)) + 1, lyr = Array.from({ length: n }, (_, l) => lineOf(src, l).map(t => t.w).join(' ')).join('\n');
      const lang = window.__lang === 'en' ? 'English' : 'Deutsche';
      const txt = (window.__lang === 'en' ? 'Translate these song lyrics line by line into English. Reply with exactly ' + n + ' lines, no numbers, nothing else.' : 'Übersetze diesen Liedtext Zeile für Zeile ins ' + lang + '. Antworte mit genau ' + n + ' Zeilen, ohne Nummern und ohne weiteren Text.') + '\n\n' + lyr;
      try { await navigator.clipboard.writeText(txt); $('sbTrInfo').textContent = T('Kopiert – in einen Chat mit Claude einfügen, Antwort oben einsetzen und speichern.'); }
      catch (e) { $('sbTrText').value = txt; $('sbTrInfo').textContent = T('Kopieren ging nicht – der Auftrag steht im Feld, bitte von dort kopieren.'); }
    });
    run();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { debug: () => ({ player: !!player, speed, mic: !!mic, res: Object.assign({}, res), line: player ? player.line : -1 }) };
})();
window.Singen = Singen;
