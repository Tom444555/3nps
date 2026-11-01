// ---------- Studio v122: Analyse im Hintergrund (Onsets, Tonhöhenkurve, Akkorde), Audio-Quantisieren, Akkordspur ----------
// Rechenteile laufen in einem Worker (Quelltext: unten stehende Funktionen + YIN aus app/pitch.js + FFT/Akkorderkennung
// des Loopers aus app/chords.js). Ergebnisse verändern das Projekt nur über Proj.change (rückgängig machbar).

// Onsets: Spektralfluss (log. Betrag, 1024er-FFT, Sprung ~5 ms) mit gleitender Schwelle, dann abtastgenau an der Hüllkurve
function anaOnsets(x, sr, o) {
  o = o || {}; const n = x.length, M = sr > 60000 ? 2048 : 1024, H = M / 4, nF = Math.floor(n / H) + 1;
  const win = new Float64Array(M); for (let i = 0; i < M; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / M);
  const K = M / 2, prev = new Float64Array(K), flux = new Float32Array(nF), fr = new Float64Array(M);
  for (let f = 0; f < nF; f++) {
    const st = f * H - M / 2; for (let i = 0; i < M; i++) { const j = st + i; fr[i] = j >= 0 && j < n ? x[j] * win[i] : 0; }
    const { re, im } = fft(fr); let s = 0;
    for (let k = 1; k < K; k++) { const v = Math.log(1 + 20 * Math.sqrt(re[k] * re[k] + im[k] * im[k]) / M * 2); const d = v - prev[k]; if (d > 0) s += d; prev[k] = v; }
    flux[f] = s;
  }
  let mx = 0, mean = 0; for (let f = 0; f < nF; f++) { mx = Math.max(mx, flux[f]); mean += flux[f]; } mean /= Math.max(1, nF);
  const W = 10, gap = Math.max(2, Math.round((o.gap || 0.06) * sr / H)), tmp = [], peaks = [];
  for (let f = 1; f < nF - 1; f++) {
    tmp.length = 0; for (let d = -W; d <= W; d++) { const q = f + d; if (q >= 0 && q < nF) tmp.push(flux[q]); } tmp.sort((a, b) => a - b);
    const thr = tmp[tmp.length >> 1] + (o.delta || 0.35) * mean + 0.04 * mx;
    if (flux[f] > thr && flux[f] >= flux[f - 1] && flux[f] > flux[f + 1]) { if (peaks.length && f - peaks[peaks.length - 1] < gap) { if (flux[f] > flux[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = f; } else peaks.push(f); }
  }
  // Feinlage: Hüllkurve (Spitze je 16 Bilder) um den Rahmen; Anfang = wo sie zuletzt unter 15 % über dem Grund lag
  const B = 16, out = [];
  peaks.forEach(f => {
    const c = f * H, a = Math.max(0, c - M), e = Math.min(n, c + M / 2), nb = Math.ceil((e - a) / B); if (nb < 2) return;
    const env = new Float32Array(nb); for (let b = 0; b < nb; b++) { let m = 0; for (let i = a + b * B, z = Math.min(e, i + B); i < z; i++) { const v = x[i] < 0 ? -x[i] : x[i]; if (v > m) m = v; } env[b] = m; }
    let pk = 0; for (let b = 1; b < nb; b++) if (env[b] > env[pk]) pk = b;
    let lo = env[pk]; for (let b = 0; b <= pk; b++) lo = Math.min(lo, env[b]);
    const th = lo + 0.15 * (env[pk] - lo); let j = pk; while (j > 0 && env[j - 1] > th) j--;
    const at = a + j * B; if (!out.length || at - out[out.length - 1] > (o.gap || 0.06) * sr * 0.5) out.push(at);
  });
  return out;
}
// Tonhöhenkurve → Transpositionsfaktoren je hop Bilder (Ziel = nächster Ton der Skala, Stärke, Glättung = Geschwindigkeit)
function anaPc(x, sr, o) {
  const hop = o.hop || 512, W = sr > 60000 ? 4096 : 2048, n = x.length, nB = Math.ceil(n / hop), buf = new Float32Array(W);
  const SC = { dur: [0, 2, 4, 5, 7, 9, 11], moll: [0, 2, 3, 5, 7, 8, 10], penta: [0, 2, 4, 7, 9], pentam: [0, 3, 5, 7, 10], chrom: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
  const ok = new Array(12).fill(false); (SC[o.scale] || SC.dur).forEach(iv => { ok[(iv + (o.key || 0)) % 12] = true; });
  const mids = new Float32Array(nB).fill(NaN);
  for (let b = 0; b < nB; b++) {
    const c = b * hop + (hop >> 1), s = c - W / 2; for (let i = 0; i < W; i++) { const j = s + i; buf[i] = j >= 0 && j < n ? x[j] : 0; }
    const r = Pitch.detect(buf, sr, { gate: o.gate || 0.01, fmin: 70, fmax: 1400 }); if (r && r.conf > 0.55) mids[b] = 69 + 12 * Math.log2(r.f / 440);
  }
  // Ausreißer (Oktavfehler) glätten: Median über 5 stimmhafte Rahmen
  const med = new Float32Array(nB).fill(NaN);
  for (let b = 0; b < nB; b++) { if (isNaN(mids[b])) continue; const w = []; for (let d = -2; d <= 2; d++) { const v = mids[b + d]; if (b + d >= 0 && b + d < nB && !isNaN(v)) w.push(v); } w.sort((p, q) => p - q); med[b] = w[w.length >> 1]; }
  const str = Math.max(0, Math.min(1, (o.str != null ? o.str : 100) / 100)), tau = Math.max(0, (o.spd || 0) / 1000), a = tau > 0 ? Math.exp(-(hop / sr) / tau) : 0;
  const tr = new Float32Array(nB); let cur = 0, hold = 0, last = 0, moved = 0, voiced = 0;
  for (let b = 0; b < nB; b++) {
    let want = 0; const m = med[b];
    if (!isNaN(m)) { let best = null; for (let d = 0; d <= 6 && best == null; d++) for (const q of [Math.round(m) - d, Math.round(m) + d]) if (ok[((q % 12) + 12) % 12] && (best == null || Math.abs(q - m) < Math.abs(best - m))) best = q; want = (best - m) * str; last = want; hold = 4; voiced++; if (Math.abs(best - m) > 0.15) moved++; }
    else if (hold > 0) { hold--; want = last; }
    cur = a * cur + (1 - a) * want; tr[b] = Math.pow(2, cur / 12);
  }
  return { tr, voiced, moved };
}
// Akkorde: auf ~11 kHz herunter (Tiefpass + Ausdünnen), dann die Akkorderkennung des Loopers je Schlag
function anaChords(x, sr, beats, o) {
  const q = Math.max(1, Math.round(sr / 11025)), T = 31, h = new Float32Array(T), fc = 0.45 / q; let hs = 0;
  for (let i = 0; i < T; i++) { const k = i - (T - 1) / 2, w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (T - 1)); h[i] = (k === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * k) / (Math.PI * k)) * w; hs += h[i]; }
  const m = Math.floor(x.length / q), y = new Float32Array(m);
  for (let j = 0; j < m; j++) { const c = j * q; let s = 0; for (let i = 0; i < T; i++) { const p = c + i - (T - 1) / 2; if (p >= 0 && p < x.length) s += x[p] * h[i]; } y[j] = s / hs; }
  return chordAnalyse(y, sr / q, beats, Object.assign({ loop: false }, o || {}));
}

const Ana = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let wk = null, wid = 0; const wait = {};
  function worker() {
    if (wk) return wk; const S = window.__SRC || {};
    const src = [S.pitch, S.fft, S.chords, anaOnsets.toString(), anaPc.toString(), anaChords.toString(),
      'onmessage=e=>{const d=e.data;try{let r;if(d.op==="onsets")r=anaOnsets(d.x,d.sr,d.o);else if(d.op==="pc"){r=anaPc(d.x,d.sr,d.o);postMessage({id:d.id,r},[r.tr.buffer]);return;}else if(d.op==="chords")r=anaChords(d.x,d.sr,d.beats,d.o);postMessage({id:d.id,r});}catch(err){postMessage({id:d.id,err:String(err&&err.stack||err)})}}'].join('\n');
    wk = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
    wk.onmessage = e => { const p = wait[e.data.id]; if (p) { delete wait[e.data.id]; p(e.data); } };
    return wk;
  }
  function run(op, data, transfer) { return new Promise((res, rej) => { const id = ++wid; wait[id] = d => d.err ? rej(new Error(d.err)) : res(d.r); worker().postMessage(Object.assign({ id, op }, data), transfer || []); }); }
  const mono = d => { const n = d.l.length, m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = (d.l[i] + d.r[i]) * 0.5; return m; };
  // ---------- Onsets einer Region (Bilder der Zeitleiste) ----------
  async function onsets(rid) { const r = Proj.reg(rid); if (!r || r.kind !== 'audio') return []; const d = await SDB.read(r.audio, r.offset, r.len), x = mono(d); const os = await run('onsets', { x, sr: Proj.P.sr }, [x.buffer]); return os.map(o => r.start + o); }
  const GRIDS = [[1, '1/4'], [0.5, '1/8'], [0.25, '1/16']];
  // ---------- Audio quantisieren ----------
  // Quelle ist immer das Original (r.qz) → mehrfach mit anderer Stärke möglich; Ergebnis = neues Audio, Original bleibt in der DB
  async function quantize(rid, o, say) {
    const P = Proj.P, r = Proj.reg(rid); if (!r || r.kind !== 'audio' || (r.takes && r.takes.length)) throw new Error('Nur für normale Audio-Regionen (keine Take-Ordner).');
    const sr = P.sr, src = r.qz ? { audio: r.qz.audio, offset: r.qz.offset + r.offset } : { audio: r.audio, offset: r.offset }, len = r.len;
    const g = +o.grid || 0.5, st = Math.max(0, Math.min(100, o.str != null ? +o.str : 100)) / 100, mode = o.mode === 'stretch' ? 'stretch' : 'slice', XF = Math.round(sr * 0.005);
    say && say('Quantisieren: suche Anschläge …');
    const d = await SDB.read(src.audio, src.offset, len), x = mono(d), os = await run('onsets', { x, sr }, [x.buffer]);
    // Anker: Quelle s → Ziel t (relativ zum Regionsanfang); Anfang und Ende bleiben, Reihenfolge bleibt
    const A = [{ s: 0, t: 0 }], minD = Math.round(sr * 0.02); let moved = 0;
    for (const on of os) {
      if (on < minD || on > len - minD) continue; const F = r.start + on, tb = Math.round(TMap.f2beat(P, F) / g) * g, T = TMap.beat2f(P, tb), tt = Math.round(on + st * (T - F)), l = A[A.length - 1];
      if (on - l.s < minD || tt - l.t < minD || tt > len - minD) continue;
      A.push({ s: on, t: tt }); if (Math.abs(tt - on) > 1) moved++;
    }
    A.push({ s: len, t: len });
    const L = new Float32Array(len), R = d.r !== d.l ? new Float32Array(len) : null;
    say && say('Quantisieren: ' + (A.length - 2) + ' Anschläge, ' + moved + ' verschoben …');
    const sin2 = v => { const s = Math.sin(Math.PI / 2 * v); return s * s; };
    for (let i = 0; i + 1 < A.length; i++) {
      const s0 = A[i].s, t0 = A[i].t, s1 = A[i + 1].s, t1 = A[i + 1].t, last = i + 2 === A.length;
      if (mode === 'slice') {
        // Scheibe i: ab t0 die Quelle ab s0; endet, wo die Quelle den nächsten Anschlag erreicht oder der nächste beginnt (Überblendung 5 ms)
        const e = Math.min(t1, t0 + (s1 - s0)), u0 = i > 0 ? t0 - XF : t0;
        for (let u = Math.max(0, u0); u < e; u++) {
          let w = 1; if (i > 0 && u < t0) w = sin2((u - u0) / XF);
          if (!(last && e === len) && u >= e - XF) w *= 1 - sin2((u - (e - XF)) / XF);
          const j = s0 + (u - t0); if (j < 0 || j >= len) continue;
          L[u] += d.l[j] * w; if (R) R[u] += d.r[j] * w;
        }
      } else {
        // Zeitdehnung zwischen den Anschlägen (Signalsmith), Übergänge mit 5 ms Überblendung
        const ext = last ? 0 : Math.min(XF, len - s1), want = t1 - t0 + ext, seg = { l: d.l.slice(s0, s1 + ext), r: d.r.slice(s0, s1 + ext) };
        let y = seg; if (Math.abs((s1 - s0) / (t1 - t0) - 1) > 0.002) { const z = await Imp.stretch(seg, want, sr); if (z) y = z; }
        const n = Math.min(want, y.l.length);
        for (let k = 0; k < n; k++) { const u = t0 + k; if (u >= len) break; let w = 1; if (i > 0 && k < XF) w = sin2(k / XF); if (ext && k >= n - ext) w *= 1 - sin2((k - (n - ext)) / ext); L[u] += y.l[k] * w; if (R) R[u] += y.r[k] * w; }
      }
    }
    const m = await SDB.putAudio((r.name || 'Audio') + ' (quantisiert)', sr, L, R);
    Proj.editRegion(rid, q => { q.qz = { audio: src.audio, offset: src.offset, grid: g, str: Math.round(st * 100), mode, n: A.length - 2, moved }; q.audio = m.id; q.offset = 0; delete q.pc; });
    return { onsets: A.length - 2, moved };
  }
  function restore(rid) { const r = Proj.reg(rid); if (!r || !r.qz) return false; Proj.editRegion(rid, q => { q.audio = q.qz.audio; q.offset = q.qz.offset + q.offset; delete q.qz; delete q.pc; }); return true; }
  function quantDlg(rid) {
    const r = Proj.reg(rid); if (!r) return; const q = r.qz || {};
    let g0 = 0.5; try { g0 = +localStorage.getItem('3nps-studio-qgrid') || 0.5; } catch (e) {}
    UI.dialog('<h2>Audio quantisieren · ' + esc(r.name || '') + '</h2><div class="card"><label class="row">Raster <select id="qGrid">' + GRIDS.map(([v, n]) => '<option value="' + v + '"' + (Math.abs(v - (q.grid || g0)) < 1e-6 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label class="row">Stärke <input type="range" id="qStr" min="0" max="100" step="5" value="' + (q.str != null ? q.str : 100) + '" style="width:160px"><b id="qStrO">' + (q.str != null ? q.str : 100) + ' %</b></label>' +
      '<label class="row">Verfahren <select id="qMode"><option value="slice"' + (q.mode !== 'stretch' ? ' selected' : '') + '>Schneiden + Verschieben (Überblendung)</option><option value="stretch"' + (q.mode === 'stretch' ? ' selected' : '') + '>Zeitdehnung zwischen den Anschlägen</option></select></label>' +
      '<p class="note">Erkennt die Anschläge (Spektralfluss) und zieht sie auf das Raster der Tempokarte. Das Original bleibt gespeichert – „Original wiederherstellen“ oder ↶ holt es zurück.' + (r.qz ? ' Zuletzt: ' + r.qz.n + ' Anschläge, ' + r.qz.moved + ' verschoben.' : '') + '</p></div>' +
      '<div class="btns">' + (r.qz ? '<button class="btn" id="qOrig">Original wiederherstellen</button>' : '') + '<span style="flex:1"></span><button class="btn" data-close>Abbrechen</button><button class="btn p" id="qGo">Quantisieren</button></div>');
    $('qStr').oninput = e => { $('qStrO').textContent = e.target.value + ' %'; };
    if ($('qOrig')) $('qOrig').onclick = () => { UI.close(); restore(rid); UI.inspect(); Arr.kick(); UI.say('Original wiederhergestellt.'); };
    $('qGo').onclick = async () => {
      const o = { grid: +$('qGrid').value, str: +$('qStr').value, mode: $('qMode').value }; try { localStorage.setItem('3nps-studio-qgrid', o.grid); } catch (e) {} UI.close();
      try { const res = await quantize(rid, o, UI.say); UI.inspect(); Arr.kick(); UI.say('Quantisiert: ' + res.onsets + ' Anschläge erkannt, ' + res.moved + ' ans Raster gezogen (↶ = rückgängig).'); } catch (e) { console.error(e); UI.say('Quantisieren: ' + e.message); }
    };
  }
  // ---------- Akkorde erkennen → Akkordspur (P.chords = [{b, beats, name, r, t}], b in Schlägen ab Projektanfang) ----------
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const nameOf = (r, t) => window.LiedCore && LiedCore.cname ? LiedCore.cname({ r, t }) : NOTE[r] + t;
  function rt(name) { const c = Roll.parseChord(name); if (!c) return null; const m = String(name).trim().match(/^([A-Ha-h])(#|b|♯|♭)?(.*)$/); let t = (m[3] || '').trim(); if (t === '°') t = 'dim'; return { r: c.r, t }; }
  async function detect(what, rid, say) {
    const P = Proj.P, sr = P.sr; let a, b, x;
    if (what === 'region') {
      const r = Proj.reg(rid); if (!r || r.kind !== 'audio') throw new Error('Erst eine Audio-Region antippen.'); a = r.start; b = r.start + r.len;
      if (r.takes && r.takes.length) { say && say('Akkorde: rechne die Spur …'); const y = await Exp.render({ a, b, tail: 0, only: r.track, noMaster: true }); x = mono(y); }
      else x = mono(await SDB.read(r.audio, r.offset, r.len));
    } else {
      const cyc = P.cycle && P.cycle.on && P.cycle.b > P.cycle.a; a = cyc ? P.cycle.a : 0; b = cyc ? P.cycle.b : Proj.projEnd(); if (!(b > a)) throw new Error('Das Projekt ist leer.');
      say && say('Akkorde: rechne den Mix …'); const y = await Exp.render({ a, b, tail: 0, noMaster: true }, f => say && say('Akkorde: rechne den Mix … ' + Math.round(f * 100) + ' %')); x = mono(y);
    }
    const beats = [], ks = [], bar = []; TMap.beats(P, a, b, (f, isBar, k) => { beats.push((f - a) / sr); ks.push(k); bar.push(isBar); });
    if (beats.length < 2) throw new Error('Zu kurz – mindestens zwei Schläge.');
    say && say('Akkorde: Chroma-Analyse über ' + beats.length + ' Schläge …');
    const sg = TMap.at(P, a), res = await run('chords', { x, sr, beats, o: { beatsPerBar: sg.sig, downIndex: Math.max(0, bar.indexOf(true)) } }, [x.buffer]);
    if (!res) throw new Error('Keine Akkorde erkannt.');
    // je halben Takt (bei ungerader Taktart je Takt) die häufigste Erkennung, gleiche Nachbarn zusammenfassen
    const slots = []; let cur = null;
    ks.forEach((k, i) => { const s = TMap.at(P, TMap.beat2f(P, k) + 1), inBar = ((k - s.beat) % s.sig + s.sig) % s.sig, half = s.sig % 2 === 0 && s.sig >= 4 ? s.sig / 2 : s.sig;
      if (!cur || inBar % half === 0) { cur = { b: k, beats: 0, votes: {} }; slots.push(cur); } cur.beats++; const nm = res.perBeat[i] || '–'; cur.votes[nm] = (cur.votes[nm] || 0) + 1; });
    const out = [];
    slots.forEach(s => { let best = '–', bv = -1; Object.keys(s.votes).forEach(nm => { if (s.votes[nm] > bv) { bv = s.votes[nm]; best = nm; } }); if (best === '–') return;
      const m = best.match(/^([A-G]#?)(.*)$/), r = NOTE.indexOf(m[1]), t = m[2], l = out[out.length - 1];
      if (l && l.r === r && l.t === t && Math.abs(l.b + l.beats - s.b) < 1e-6) l.beats += s.beats; else out.push({ b: s.b, beats: s.beats, r, t, name: nameOf(r, t) }); });
    const b0 = TMap.f2beat(P, a) - 1e-6, b1 = TMap.f2beat(P, b) + 1e-6;
    Proj.change('chords', p => { p.chords = (p.chords || []).filter(c => c.b + c.beats <= b0 || c.b >= b1).concat(out).sort((u, v) => u.b - v.b); p.chordLane = true; });
    Arr.heads(); Arr.kick(); window.__lastChords = out.map(c => c.name);
    return out;
  }
  // Akkordspur bearbeiten (Antippen im Arrangement)
  async function editAt(f) {
    const P = Proj.P, bt = TMap.f2beat(P, f), cs = P.chords || [], i = cs.findIndex(c => bt >= c.b && bt < c.b + c.beats);
    if (i >= 0) {
      const c = cs[i], n = await UI.ask('Akkord (leer = löschen), z. B. Am, F, G7, Csus4, E5', c.name); if (n == null) return;
      if (!n.trim() || n.trim() === '-') { Proj.change('chords', p => { p.chords.splice(i, 1); }); UI.say('Akkord gelöscht.'); }
      else { const q = rt(n); if (!q) return UI.say('Nicht erkannt: ' + n); Proj.change('chords', p => { Object.assign(p.chords[i], q, { name: n.trim() }); }); }
    } else {
      // neuer Akkord ab dem halben Takt, bis zum nächsten Akkord (höchstens ein Takt)
      const s = TMap.at(P, f), b0 = TMap.f2beat(P, TMap.barFloor(P, f)), half = s.sig % 2 === 0 && s.sig >= 4 ? s.sig / 2 : s.sig, st = b0 + Math.floor((bt - b0) / half) * half;
      const nx = cs.filter(c => c.b > st).sort((u, v) => u.b - v.b)[0], len = Math.max(1, Math.min(s.sig, nx ? nx.b - st : s.sig));
      const n = await UI.ask('Neuer Akkord ab Takt ' + (TMap.pos(P, TMap.beat2f(P, st)).bar + 1), ''); if (!n) return; const q = rt(n); if (!q) return UI.say('Nicht erkannt: ' + n);
      Proj.change('chords', p => { p.chords = (p.chords || []).concat([Object.assign({ b: st, beats: len, name: n.trim() }, q)]).sort((u, v) => u.b - v.b); p.chordLane = true; });
    }
    Arr.kick();
  }
  function chordDlg() {
    const P = Proj.P, n = (P.chords || []).length;
    UI.dialog('<h2>Akkordspur</h2><div class="card"><p>' + (n ? n + ' Akkorde: ' + esc(P.chords.slice(0, 16).map(c => c.name).join(' · ')) + (n > 16 ? ' …' : '') : 'Noch leer.') + '</p>' +
      '<div class="btns"><button class="btn" data-c="mix">Akkorde aus dem Mix erkennen</button><button class="btn" data-c="lane">' + (P.chordLane ? 'Akkordspur ausblenden' : 'Akkordspur zeigen') + '</button>' + (n ? '<button class="btn danger" data-c="clr">Akkordspur leeren</button>' : '') + '</div>' +
      '<p class="note">Erkennen: Chroma-Analyse je Schlag (Tempokarte), Vergleich mit Dur/Moll/7/sus/5 und Glättung; Ergebnis je halben Takt. In der Spur antippen = Akkord ändern oder neu eintragen. Im Cycle wird nur der Cycle-Bereich erkannt.</p></div>' +
      '<div class="card"><b>Begleitung aus Akkordspur erzeugen</b><label class="row">Bass <select id="caBass"><option value="whole">Grundton lang</option><option value="eighth">Achtel</option><option value="rq" selected>Grundton–Quinte</option><option value="walk">Laufend</option></select></label>' +
      '<div class="btns"><button class="btn" data-g="bass">Bass erzeugen</button><button class="btn" data-g="pad">Flächen erzeugen</button><button class="btn" data-g="arp">Arpeggio erzeugen</button></div></div>' +
      '<div class="btns"><button class="btn p" data-close>Fertig</button></div>');
    $('dlg').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.c === 'mix') { UI.close(); try { const out = await detect('mix', null, UI.say); UI.say(out.length ? 'Akkordspur: ' + out.length + ' Akkorde erkannt (antippen zum Ändern).' : 'Keine Akkorde erkannt.'); } catch (err) { console.error(err); UI.say('Akkorde: ' + err.message); } return; }
      if (b.dataset.c === 'lane') { Proj.change('chords', p => { p.chordLane = !p.chordLane; }); Arr.heads(); Arr.kick(); UI.close(); return; }
      if (b.dataset.c === 'clr') { Proj.change('chords', p => { p.chords = []; }); Arr.kick(); UI.close(); return; }
      if (b.dataset.g) { const st = $('caBass').value; UI.close(); Roll.genChords(b.dataset.g, st); }
    };
  }
  return { run, onsets, quantize, restore, quantDlg, detect, editAt, chordDlg, rt };
})();
window.Ana = Ana;
