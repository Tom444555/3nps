# v122 Studio: Insert-Effekte (Chorus, Tremolo, Tonhöhenkorrektur, Amp), Audio-Quantisieren, Projekt teilen/importieren, Akkorde aus Audio
import asyncio, sys, json, os
from playwright.async_api import async_playwright
S = 'http://localhost:8765/studio/'
TMP = '/tmp/claude-0/-home-claude/1cfc7bee-3f63-5ae7-a8c6-d1d35bb1fb3c/scratchpad'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))

HELP = """
window.__mk = async (name, secs, fn, stereo) => { const sr = Engine.sr(), n = Math.round(sr * secs), w = SDB.writer(name, sr, !!stereo), B = 65536;
  for (let a = 0; a < n; a += B) { const m = Math.min(B, n - a), l = new Float32Array(m), r = new Float32Array(m); for (let i = 0; i < m; i++) { const v = fn((a + i) / sr); if (Array.isArray(v)) { l[i] = v[0]; r[i] = v[1]; } else { l[i] = v; r[i] = v; } } w.push(l, stereo ? r : l); }
  return (await w.done()); };
window.__addTrack = (name, meta, start) => { let tid; Proj.change('regions', q => { const t = Proj.track('audio', name); tid = t.id; q.tracks.push(t); if (meta) q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: meta.id, start: start || 0, offset: 0, len: meta.frames, gain: 0, fi: 0, fo: 0, name }); }); Engine.dirty(true); return tid; };
window.__gz = (x, a, b, f) => { const w = 2 * Math.PI * f / x.sr, c = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = a; i < b; i++) { const s = x.l[i] + c * s1 - s2; s2 = s1; s1 = s; } return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) / (b - a) * 2; };
window.__rms = (x, a, b, ch) => { const d = ch === 'r' ? x.r : x.l; let s = 0; for (let i = a; i < b; i++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, b - a)); };
window.__diff = (x, y) => { let m = 0; const n = Math.min(x.l.length, y.l.length); for (let i = 0; i < n; i++) { m = Math.max(m, Math.abs(x.l[i] - y.l[i]), Math.abs(x.r[i] - y.r[i])); } return m; };
// Frequenz über Nulldurchgänge (linear interpoliert) in [a, b)
window.__zf = (x, a, b) => { let first = -1, last = -1, n = 0; for (let i = a + 1; i < b; i++) { const p = x.l[i - 1], q = x.l[i]; if (p < 0 && q >= 0) { const t = i - 1 + p / (p - q); if (first < 0) first = t; else n++; last = t; } } return n > 0 ? n * x.sr / (last - first) : 0; };
// Zupfer: kurzer Anstieg, abklingend
window.__pluck = (ts, f) => t => { let v = 0; for (const t0 of ts) { const d = t - t0; if (d >= 0 && d < 0.35) v += Math.sin(2 * Math.PI * f * d) * Math.exp(-d * 12) * Math.min(1, d / 0.0015) * 0.5; } return v; };
0"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, bypass_csp=True, accept_downloads=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(S); await pg.wait_for_timeout(1200)
        await pg.evaluate(HELP); await pg.evaluate("Engine.ensure().then(()=>0)")

        # ================= Insert-Effekte: aus = bitgenau, an = messbar =================
        await pg.evaluate("""(async()=>{ await Proj.newProject('Effekte'); Proj.change('tempo', q => { q.bpm = 120; }); const sr = Engine.sr();
          const m = await __mk('Ton', 4, t => t < 2 ? Math.sin(2 * Math.PI * 330 * t) * 0.3 : (Math.sin(t * 91234.5) * 0.0015));
          window.__ta = __addTrack('Gitarre', m, 0); })()""")
        base = await pg.evaluate("""(async()=>{ const sr = Engine.sr(); window.__x0 = await Exp.render({ a: 0, b: sr * 4, tail: 0, noMaster: true });
          const t = Proj.P.tracks[0]; t.fx.cho = JSON.parse(JSON.stringify(Ins.DEF.cho)); t.fx.trem = JSON.parse(JSON.stringify(Ins.DEF.trem)); t.fx.amp = JSON.parse(JSON.stringify(Ins.DEF.amp)); t.fx.pc = JSON.parse(JSON.stringify(Ins.DEF.pc)); Engine.dirty(true);
          const x = await Exp.render({ a: 0, b: sr * 4, tail: 0, noMaster: true }); return { d: __diff(__x0, x), ins: Engine.graph.tr[0].ins, fxn: Engine.graph.fxn.length } })()""")
        check('Alle Inserts aus: Export bitgenau wie vorher, kein Zusatzknoten im Graph', base['d'] == 0 and base['ins'] is None and base['fxn'] == 0, base)
        # Chorus
        ch = await pg.evaluate("""(async()=>{ const sr = Engine.sr(), t = Proj.P.tracks[0]; t.fx.cho = { on: true, rate: 1, depth: 80, mix: 50 }; Engine.dirty(true);
          const x = await Exp.render({ a: 0, b: sr * 4, tail: 0, noMaster: true }); const w = Math.round(sr * 0.05), lv = [];
          for (let a = Math.round(sr * 0.1); a + w < sr * 1.9; a += w) lv.push(__rms(x, a, a + w));
          let lr = 0; for (let i = Math.round(sr * 0.2); i < sr * 1.8; i++) lr = Math.max(lr, Math.abs(x.l[i] - x.r[i]));
          // LFO-Phase hängt an der Projektposition: Export ab 1 s zeigt dieselbe Pegelkurve wie der ganze Export (Rate 0,7 Hz → frei laufend wäre sie verschoben)
          t.fx.cho.rate = 0.7; Engine.dirty(true); const xa = await Exp.render({ a: 0, b: sr * 4, tail: 0, noMaster: true }), y = await Exp.render({ a: sr, b: sr * 4, tail: 0, noMaster: true });
          let dd = 0, rg = 0; for (let a = Math.round(sr * 0.1); a + w < sr * 0.95; a += w) { const p = __rms(y, a, a + w), q = __rms(xa, a + sr, a + sr + w); dd = Math.max(dd, Math.abs(p - q)); rg = Math.max(rg, q); } dd /= rg;
          window.__xc = x; return { mn: Math.min(...lv), mx: Math.max(...lv), lr, dd, node: !!Engine.graph.tr[0].ins.cho } })()""")
        check('Chorus an: Pegel schwebt (Kammfilter wandert) und L/R verschieden', ch['node'] and ch['mx'] / max(1e-9, ch['mn']) > 1.3 and ch['lr'] > 0.05, ch)
        check('Chorus hängt an der Zeitleiste (Export ab 0:01 hat dieselbe Schwebung wie der ganze Export)', ch['dd'] < 0.03, ch['dd'])
        # Tremolo im Takt (1/4 bei 120 BPM) + Tempowechsel
        tr = await pg.evaluate("""(async()=>{ const sr = Engine.sr(), t = Proj.P.tracks[0]; t.fx.cho.on = false; t.fx.trem = { on: true, rate: 4, depth: 80, sync: true, div: 1 }; Engine.dirty(true);
          const w = Math.round(sr * 0.012), at = (x, s) => __rms(x, Math.round(s * sr) - (w >> 1), Math.round(s * sr) + (w >> 1));
          const x = await Exp.render({ a: 0, b: sr * 2, tail: 0, noMaster: true }); const r1 = at(x, 0.75) / at(x, 1.0), r2 = at(x, 1.25) / at(x, 1.5);
          t.fx.trem.sync = false; t.fx.trem.rate = 4; Engine.applyAll(); Engine.dirty(true); const y = await Exp.render({ a: 0, b: sr * 2, tail: 0, noMaster: true }); const f1 = at(y, 1.125) / at(y, 1.0);
          return { r1, r2, f1 } })()""")
        check('Tremolo im Takt: Tiefpunkt genau zwischen den Schlägen (−80 %)', tr['r1'] < 0.3 and tr['r2'] < 0.3, tr)
        check('Tremolo frei (4 Hz): Tiefpunkt nach 1/8 s', tr['f1'] < 0.3, tr['f1'])
        tm = await pg.evaluate("""(async()=>{ const sr = Engine.sr(), t = Proj.P.tracks[0]; t.fx.trem = { on: true, rate: 4, depth: 80, sync: true, div: 1 }; Proj.retempo(p => { p.tempo = [{ bar: 1, bpm: 60 }]; });
          const m = await __mk('Lang', 6, tt => Math.sin(2 * Math.PI * 330 * tt) * 0.3); Proj.editRegion(Proj.P.regions[0].id, r => { r.audio = m.id; r.len = m.frames; });
          const w = Math.round(sr * 0.012), at = (x, s) => __rms(x, Math.round(s * sr) - (w >> 1), Math.round(s * sr) + (w >> 1));
          const x = await Exp.render({ a: 0, b: sr * 5, tail: 0, noMaster: true }); const o = { low: at(x, 2.5) / at(x, 3.0), mid: at(x, 2.25) / at(x, 3.0), low2: at(x, 3.5) / at(x, 4.0) };
          Proj.retempo(p => { delete p.tempo; }); return o })()""")
        check('Tremolo folgt der Tempokarte (ab Takt 2: 60 BPM → Tiefpunkt bei 2,5 s statt 2,25 s)', tm['low'] < 0.3 and tm['low2'] < 0.3 and tm['mid'] > 0.45, tm)
        live = await pg.evaluate("""(async()=>{ const t = Proj.P.tracks[0]; t.fx.trem = { on: true, rate: 4, depth: 90, sync: true, div: 1 }; Engine.dirty(true); await Engine.seek(0); await Engine.play(); const lv = []; const t0 = performance.now();
          while (performance.now() - t0 < 1600) { await new Promise(r => setTimeout(r, 15)); lv.push(Engine.level(0)); } Engine.stop(); const s = lv.slice(20).sort((a, b) => a - b); return { lo: s[Math.floor(s.length * 0.05)], hi: s[Math.floor(s.length * 0.95)], n: Engine.graph.fxn.length } })()""")
        check('Tremolo wirkt auch live (Pegel pulsiert)', live['hi'] > 0.05 and live['lo'] < live['hi'] * 0.4 and live['n'] == 1, live)
        # Amp: Drive (Obertöne) und Gate
        amp = await pg.evaluate("""(async()=>{ const sr = Engine.sr(), t = Proj.P.tracks[0]; const m = await __mk('Ton2', 4, tt => tt < 2 ? Math.sin(2 * Math.PI * 330 * tt) * 0.3 : (Math.sin(tt * 91234.5) * 0.0015)); Proj.editRegion(Proj.P.regions[0].id, r => { r.audio = m.id; r.len = m.frames; });
          t.fx.trem.on = false; Engine.dirty(true); const x0 = await Exp.render({ a: 0, b: sr * 4, tail: 0, noMaster: true });
          t.fx.amp = Object.assign({ on: true }, AmpDSP.AMP_PRESETS.metal); Engine.dirty(true); const x = await Exp.render({ a: 0, b: sr * 4, tail: 0, noMaster: true });
          const a = Math.round(sr * 0.5), e = Math.round(sr * 1.5), h3 = __gz(x, a, e, 990) / __gz(x, a, e, 330), h30 = __gz(x0, a, e, 990) / __gz(x0, a, e, 330);
          const gOn = __rms(x, Math.round(sr * 2.6), Math.round(sr * 3.6));
          t.fx.amp.gate = -80; Engine.applyAll(); Engine.dirty(true); const y = await Exp.render({ a: 0, b: sr * 4, tail: 0, noMaster: true }); const gOff = __rms(y, Math.round(sr * 2.6), Math.round(sr * 3.6));
          const src = await fetch('../index.html').then(r => r.text()); const same = src.includes(AmpDSP.ampChain.toString().split('\\n').slice(1, 6).join('\\n'));
          return { h3, h30, gOn, gOff, same, gate: !!Engine.graph.tr[0].ins.amp.gate, os: Engine.graph.tr[0].ins.amp.shp.oversample } })()""")
        check('Amp an: Verzerrung messbar (3. Oberton ≫ ohne Amp), WaveShaper 4x', amp['h3'] > 0.05 and amp['h30'] < 0.002 and amp['os'] == '4x', amp)
        check('Amp-Gate schließt bei leisem Rauschen (−45 dB), ohne Gate bleibt es hörbar', amp['gate'] and amp['gOn'] < amp['gOff'] * 0.1 and amp['gOff'] > 1e-4, (amp['gOn'], amp['gOff']))
        check('Amp-Kette ist derselbe Code wie im Looper (v117)', amp['same'])
        # Effekte-Fenster: Karten und Schalter
        await pg.evaluate("(()=>{ const t = Proj.P.tracks[0]; ['amp','cho','trem','pc'].forEach(k => delete t.fx[k]); Engine.dirty(true); Arr.V.selTrack = t.id; Arr.heads(); UI.inspect(); Mix.fxDlg(t.id); })()")
        await pg.wait_for_timeout(300)
        cards = await pg.evaluate("['amp','cho','trem','pc'].map(k => !!document.querySelector('#dlg .ins-' + k))")
        await pg.click('#dlg .ins-cho input[type=checkbox]'); await pg.wait_for_timeout(300)
        on1 = await pg.evaluate("!!(Engine.graph.tr[0].ins && Engine.graph.tr[0].ins.cho)")
        await pg.evaluate("(()=>{ const el = document.querySelector('#dlg [data-ik=\"cho.rate\"]'); el.value = 2.5; el.dispatchEvent(new Event('input', { bubbles: true })); })()")
        await pg.click('#dlg [data-close]'); await pg.wait_for_timeout(300)
        st = await pg.evaluate("(()=>{ const f = Proj.P.tracks[0].fx; return { cho: f.cho, amp: 'amp' in f, trem: 'trem' in f, slot: !!document.querySelector('.strip .slot[data-k=\"cho\"]') || true } })()")
        undo = await pg.evaluate("(()=>{ Proj.undo(); Engine.dirty(true); const f = Proj.P.tracks[0].fx; return { cho: 'cho' in f, ins: Engine.graph.tr[0].ins } })()")
        check('Effekte-Fenster: Karten Amp, Chorus, Tremolo, Tonhöhenkorrektur', all(cards), cards)
        check('Chorus per Haken an → sofort im Graph; Regler übernommen; unbenutzte Inserts bleiben aus dem Projekt', on1 and st['cho'] and st['cho']['on'] and abs(st['cho']['rate'] - 2.5) < 1e-6 and not st['amp'] and not st['trem'], st)
        check('Rückgängig nimmt den Chorus wieder heraus', not undo['cho'] and undo['ins'] is None, undo)
        # Tonhöhenkorrektur (452 Hz → A 440 in C-Dur)
        pc = await pg.evaluate("""(async()=>{ const sr = Engine.sr(); const m = await __mk('Gesang', 3, tt => Math.sin(2 * Math.PI * 452 * tt) * 0.3 * Math.min(1, tt * 20));
          const tid = __addTrack('Stimme', m, 0); Proj.change('mix', p => p.tracks.forEach(t => { t.solo = t.id === tid; }));
          const i = Proj.tIndex(tid), x0 = await Exp.render({ a: 0, b: sr * 3, tail: 0, noMaster: true });
          Proj.editTrack(tid, t => { t.fx.pc = { on: true, key: 0, scale: 'dur', str: 100, spd: 0 }; }); const n = await Ins.pcApply(tid); Engine.dirty();
          const x1 = await Exp.render({ a: 0, b: sr * 3, tail: 0, noMaster: true });
          Proj.editTrack(tid, t => { t.fx.pc.str = 50; }); await Ins.pcApply(tid); const x2 = await Exp.render({ a: 0, b: sr * 3, tail: 0, noMaster: true });
          Proj.editTrack(tid, t => { t.fx.pc.on = false; }); Engine.dirty(); const x3 = await Exp.render({ a: 0, b: sr * 3, tail: 0, noMaster: true });
          const A = Math.round(sr * 0.8), B = Math.round(sr * 2.2), r = Proj.P.regions.find(q => q.track === tid);
          return { n, f0: __zf(x0, A, B), f1: __zf(x1, A, B), f2: __zf(x2, A, B), f3: __zf(x3, A, B), off: __diff(x0, x3), pc: !!(r.pc && r.pc.audio), keep: !!(await SDB.meta(r.audio)) } })()""")
        check('Tonhöhenkorrektur: 452 Hz → 440 Hz (A in C-Dur)', pc['n'] == 1 and abs(pc['f0'] - 452) < 1 and abs(pc['f1'] - 440) < 2.5, (round(pc['f0'], 1), round(pc['f1'], 1)))
        check('Tonhöhenkorrektur Stärke 50 %: halber Weg (~446 Hz)', 443 < pc['f2'] < 449.5, round(pc['f2'], 1))
        check('Tonhöhenkorrektur aus: bitgenau das Original (Original bleibt gespeichert)', pc['off'] == 0 and pc['keep'] and pc['pc'], pc['off'])

        # ================= Audio quantisieren =================
        Q = await pg.evaluate("""(async()=>{ await Proj.newProject('Quantisieren'); Proj.change('tempo', q => { q.bpm = 120; }); const sr = Engine.sr();
          const offs = [0.031, -0.024, 0.018, -0.035, 0.027, -0.015, 0.038, -0.029, 0.022, -0.033, 0.012, -0.02];
          const ts = offs.map((o, k) => 0.5 + k * 0.5 + o); window.__truth = ts; const m = await __mk('Gitarre', 7.5, __pluck(ts, 220), true);
          window.__tq = __addTrack('Gitarre', m, 0); window.__rq = Proj.P.regions[0].id; window.__orig = m.id;
          const os = await Ana.onsets(__rq), dev = f => { const b = TMap.f2beat(Proj.P, f); return Math.abs(b - Math.round(b)) * Proj.spb(); };
          const det = ts.map(t => Math.min(...os.map(o => Math.abs(o - t * sr)))) ;
          return { n: os.length, det: Math.max(...det) / sr * 1000, dev: os.reduce((s, o) => s + dev(o), 0) / os.length / sr * 1000 } })()""")
        check('Onset-Erkennung: alle 12 Anschläge, auf ±3 ms genau', Q['n'] == 12 and Q['det'] < 3, Q)
        await pg.evaluate("(()=>{ UI.show('arr'); Arr.V.sel = __rq; Arr.V.selTrack = __tq; UI.inspect(); })()")
        await pg.click('#dRegC [data-r="qz"]'); await pg.wait_for_timeout(300)
        await pg.select_option('#qGrid', '1'); await pg.click('#qGo')
        await pg.wait_for_function("Proj.reg(__rq) && Proj.reg(__rq).qz", timeout=20000); await pg.wait_for_timeout(300)
        Q1 = await pg.evaluate("""(async()=>{ const sr = Engine.sr(), os = await Ana.onsets(__rq), dev = f => { const b = TMap.f2beat(Proj.P, f); return Math.abs(b - Math.round(b)) * Proj.spb(); }; const r = Proj.reg(__rq);
          return { n: os.length, dev: os.reduce((s, o) => s + dev(o), 0) / os.length / sr * 1000, mx: Math.max(...os.map(dev)) / sr * 1000, qz: r.qz, audio: r.audio !== __orig, len: r.len, st: document.getElementById('status').textContent } })()""")
        check('Quantisieren 1/4, Stärke 100: Anschläge liegen auf dem Raster (vorher Ø ' + str(round(Q['dev'])) + ' ms daneben)', Q1['n'] == 12 and Q1['dev'] < 2 and Q1['mx'] < 4 and Q['dev'] > 15, (round(Q1['dev'], 2), round(Q1['mx'], 2)))
        check('Neues Audio, Original bleibt in der DB (Region merkt es sich)', Q1['audio'] and Q1['qz']['audio'] == await pg.evaluate("__orig") and Q1['qz']['moved'] >= 11, Q1['qz'])
        Q2 = await pg.evaluate("""(async()=>{ const sr = Engine.sr(), dev = f => { const b = TMap.f2beat(Proj.P, f); return Math.abs(b - Math.round(b)) * Proj.spb(); };
          await Ana.quantize(__rq, { grid: 1, str: 50, mode: 'slice' }); let os = await Ana.onsets(__rq); const half = os.reduce((s, o) => s + dev(o), 0) / os.length / sr * 1000;
          await Ana.quantize(__rq, { grid: 1, str: 100, mode: 'stretch' }); os = await Ana.onsets(__rq); const str = os.reduce((s, o) => s + dev(o), 0) / os.length / sr * 1000, n2 = os.length;
          const x = await Exp.render({ a: 0, b: sr * 7, tail: 0, noMaster: true }); let pk = 0; for (const v of x.l) pk = Math.max(pk, Math.abs(v));
          return { half, str, n2, pk, orig: Proj.reg(__rq).qz.audio === __orig } })()""")
        check('Stärke 50 %: Abweichung etwa halbiert', Q['dev'] * 0.3 < Q2['half'] < Q['dev'] * 0.7, round(Q2['half'], 1))
        check('Verfahren Zeitdehnung: ebenfalls aufs Raster (immer vom Original aus)', Q2['n2'] == 12 and Q2['str'] < 4 and Q2['orig'] and Q2['pk'] > 0.2, (round(Q2['str'], 2), Q2['n2']))
        U = await pg.evaluate("""(async()=>{ Proj.undo(); Proj.undo(); Proj.undo(); const a = Proj.reg(__rq).audio; await Ana.quantize(__rq, { grid: 0.5, str: 100 }); const r1 = Ana.restore(__rq); const b = Proj.reg(__rq); await Proj.save(); await SDB.gc();
          return { undo: a === __orig, restore: r1 && b.audio === __orig && !b.qz && b.offset === 0, meta: !!(await SDB.meta(__orig)) } })()""")
        check('Rückgängig (↶) und „Original wiederherstellen“ bringen das Original zurück', U['undo'] and U['restore'] and U['meta'], U)

        # ================= Akkorde aus Audio =================
        C = await pg.evaluate("""(async()=>{ await Proj.newProject('Akkorde'); Proj.change('tempo', q => { q.bpm = 100; }); const sr = Engine.sr(), spb = 0.6;
          const prog = [[48, 52, 55, 60, 64], [45, 48, 52, 57, 60], [41, 45, 48, 53, 57], [43, 47, 50, 55, 59]];
          const m = await __mk('Klavier', 8 * 4 * spb, t => { const b = Math.floor(t / (4 * spb)), d = t - b * 4 * spb, ch = prog[b % 4]; let v = 0; for (const n of ch) { const f = 440 * Math.pow(2, (n - 69) / 12); for (let h = 1; h <= 3; h++) v += Math.sin(2 * Math.PI * f * h * d) / h; } return v * 0.05 * Math.exp(-d * 0.7) * Math.min(1, d / 0.005); });
          window.__tc = __addTrack('Klavier', m, 0); window.__rc = Proj.P.regions[0].id; UI.show('arr'); Arr.V.sel = __rc; Arr.V.selTrack = __tc; UI.inspect(); return true })()""")
        await pg.click('#dRegC [data-r="chd"]')
        await pg.wait_for_function("Proj.P.chords && Proj.P.chords.length >= 4", timeout=20000); await pg.wait_for_timeout(200)
        C1 = await pg.evaluate("(()=>{ const P = Proj.P; return { names: P.chords.map(c => c.name), beats: P.chords.map(c => c.beats), b: P.chords.map(c => c.b), lane: P.chordLane, rt: P.chords.map(c => [c.r, c.t]), cname: P.chords.every(c => LiedCore.cname({ r: c.r, t: c.t }) === c.name) } })()")
        check('Akkorde erkennen (Region): C – Am – F – G (zweimal), je ein Takt', C1['names'] == ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'] and C1['beats'] == [4] * 8 and C1['b'] == [0, 4, 8, 12, 16, 20, 24, 28], C1['names'])
        check('Akkordspur im Looper-Format ({b, beats, r, t, name} wie Songwriting/LiedCore)', C1['lane'] and C1['cname'] and C1['rt'][1] == [9, 'm'], C1['rt'][:4])
        C2 = await pg.evaluate("(async()=>{ Proj.change('chords', p => { p.chords = []; }); const out = await Ana.detect('mix', null); return out.map(c => c.name) })()")
        check('Akkorde aus dem Mix (ganzes Projekt) ebenso', C2 == ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'], C2)
        # Antippen in der Akkordspur → ändern
        await pg.evaluate("Arr.zoomAll()"); await pg.wait_for_timeout(200)
        x2 = await pg.evaluate("(()=>{ const r = document.getElementById('lanes').getBoundingClientRect(); return { x: r.left + Arr.fx(TMap.beat2f(Proj.P, 5.5)), y: r.top + 44 } })()")
        await pg.mouse.click(x2['x'], x2['y']); await pg.wait_for_timeout(300)
        await pg.fill('#askI', 'Am7'); await pg.click('#askOk'); await pg.wait_for_timeout(300)
        ed = await pg.evaluate("(()=>{ const c = Proj.P.chords[1]; return [c.name, c.r, c.t] })()")
        check('Akkordspur: Antippen → Akkord ändern (Am → Am7)', ed == ['Am7', 9, 'm7'], ed)
        G = await pg.evaluate("""(()=>{ const r = Roll.genChords('bass', 'rq'), P = Proj.P, t = P.tracks.find(x => x.id === r.track); return { kind: t.kind, inst: t.inst, n: r.notes.length, start: r.start, len: Math.round(Proj.f2beat(r.start + r.len) - Proj.f2beat(r.start)), roots: [0, 4, 8, 12].map(b => r.notes.find(n => Math.abs(n.t - b) < 1e-6).m % 12) } })()""")
        check('Begleitung aus Akkordspur: Bass über 8 Takte mit den richtigen Grundtönen', G['kind'] == 'midi' and G['inst'] == 'kbass' and G['n'] == 32 and G['start'] == 0 and G['len'] == 32 and G['roots'] == [0, 9, 5, 7], G)
        await pg.evaluate("(()=>{ Proj.P.chords[2].name = 'Fmaj7'; Proj.P.chords[2].t = 'maj7'; Proj.P.chords[3].name = 'G5'; Proj.P.chords[3].t = '5'; })()")
        pad = await pg.evaluate("(()=>{ const r = Roll.genChords('pad'); const at = b => [...new Set(r.notes.filter(n => Math.abs(n.t - b) < 1e-6).map(n => n.m % 12))].sort((a, c) => a - c); return [at(8), at(12)] })()")
        check('Flächen aus Akkordspur: Fmaj7 und Powerchord G5 richtig', pad[0] == [0, 4, 5, 9] and pad[1] == [2, 7], pad)
        await pg.evaluate("Proj.undo(); Proj.undo(); Engine.dirty(true)")

        # ================= Projekt teilen und importieren =================
        await pg.evaluate("""(async()=>{ await Proj.newProject('Teilen'); const sr = Engine.sr(); Proj.change('tempo', q => { q.bpm = 96; q.tempo = [{ bar: 4, bpm: 120 }]; q.key = 'A Moll'; });
          const a = await __mk('Stereo', 3, t => [Math.sin(2 * Math.PI * 220 * t) * 0.3, Math.sin(2 * Math.PI * 330 * t) * 0.2], true), b = await __mk('Mono', 2, t => Math.sin(2 * Math.PI * 550 * t) * 0.25);
          const t1 = __addTrack('Gitarre', a, 1000), t2 = __addTrack('Gesang', b, Math.round(sr * 0.5));
          Proj.editTrack(t1, t => { t.vol = -4.5; t.pan = -30; t.fx.cho = { on: true, rate: 1.3, depth: 40, mix: 30 }; t.fx.rev = 20; t.out = 'g1'; }); Proj.change('mix', p => { Proj.ensureGroup(p, 'g1').vol = -2; });
          Proj.editTrack(t2, t => { t.fx.comp = { on: true, th: -30, ratio: 4, att: 5, rel: 100, mk: 2, sc: t1 }; });
          const tm = Proj.addTrack('midi', 'Klavier'); Proj.addRegion({ track: tm.id, kind: 'midi', start: 0, len: Proj.bar2f(2), notes: [{ t: 0, d: 1, m: 60, v: 100 }, { t: 1, d: 1, m: 64, v: 90 }], name: 'Noten' });
          Proj.change('markers', p => { p.markers.push({ f: Proj.bar2f(1), name: 'Refrain', color: '#8ad94e' }); p.chords = [{ b: 0, beats: 4, name: 'Am', r: 9, t: 'm' }]; p.chordLane = true; });
          await Ana.quantize(Proj.P.regions[1].id, { grid: 0.25, str: 50 }); Engine.dirty(true); await Proj.save(); window.__srcP = JSON.parse(JSON.stringify(Proj.P)); window.__srcMix = await Exp.render({ a: 0, b: sr * 3.5, tail: 0 }); })()""")
        async with pg.expect_download() as dl:
            await pg.click('#bProj'); await pg.wait_for_timeout(400); await pg.click('#dlg [data-a="share"]')
        d = await dl.value; path = os.path.join(TMP, 'teilen.loopsmiths'); await d.save_as(path)
        sz = os.path.getsize(path); head = open(path, 'rb').read(4)
        check('„Projekt als Datei teilen“ → eine Datei .loopsmiths (ZIP, Fallback Download)', d.suggested_filename == 'Teilen.loopsmiths' and head == b'PK\x03\x04' and sz > 48000 * 5 * 2, (d.suggested_filename, sz))
        await pg.click('#bProj'); await pg.wait_for_timeout(400)
        async with pg.expect_file_chooser() as fc:
            await pg.click('#dlg [data-a="imp"]')
        await (await fc.value).set_files(path)
        await pg.wait_for_function("window.__lastImport && Proj.P.id === __lastImport.id", timeout=30000); await pg.wait_for_timeout(300)
        I = await pg.evaluate("""(async()=>{ const A = __srcP, B = Proj.P, sr = Engine.sr();
          const strip = p => JSON.parse(JSON.stringify(p), (k, v) => ['id', 'track', 'audio', 'sc', 'src', 'ts'].includes(k) ? undefined : v);
          const sa = strip(A), sb = strip(B); delete sa.name; delete sb.name;
          const sum = async r => { const d = await SDB.read(r.audio, r.offset, r.len); let s = 0, q = 0; for (let i = 0; i < d.l.length; i++) { s += Math.round(d.l[i] * 32767) * ((i % 97) + 1); q += Math.round(d.r[i] * 32767) * ((i % 89) + 3); } return s + ':' + q; };
          const cs = []; for (let i = 0; i < A.regions.length; i++) { if (A.regions[i].kind !== 'audio') continue; cs.push([await sum(A.regions[i]), await sum(B.regions[i])]); }
          const qa = await sum(Object.assign({}, A.regions[1], { audio: A.regions[1].qz.audio, offset: A.regions[1].qz.offset })), qb = await sum(Object.assign({}, B.regions[1], { audio: B.regions[1].qz.audio, offset: B.regions[1].qz.offset }));
          const mix = await Exp.render({ a: 0, b: sr * 3.5, tail: 0 }); let m = 0; for (let i = 0; i < mix.l.length; i++) m = Math.max(m, Math.abs(mix.l[i] - __srcMix.l[i]));
          const ids = { p: A.id !== B.id, t: A.tracks.every((t, i) => t.id !== B.tracks[i].id), r: A.regions.every((r, i) => r.id !== B.regions[i].id), a: A.regions.every((r, i) => !r.audio || r.audio !== B.regions[i].audio),
            sc: B.tracks[1].fx.comp.sc === B.tracks[0].id, reg: B.regions.every(r => r.track && B.tracks.some(t => t.id === r.track)) };
          const list = await Proj.list();
          return { same: JSON.stringify(sa) === JSON.stringify(sb), cs, q: qa === qb, mix: m, ids, name: B.name, n: list.filter(p => p.name.startsWith('Teilen')).length, imp: __lastImport } })()""")
        check('Import: gleiches Projekt (Spuren, Regionen, Mischpult, Busse, Tempokarte, Marker, Akkorde, Noten)', I['same'], I['name'])
        check('Import: Audio-Prüfsumme gleich (alle Regionen + Original vor dem Quantisieren)', all(a == c for a, c in I['cs']) and I['q'] and len(I['cs']) == 2, I['cs'])
        check('Import: Mix klingt gleich (Export-Vergleich)', I['mix'] < 1e-6, I['mix'])
        check('Import: neue IDs (Projekt, Spuren, Regionen, Audio), Verweise (Sidechain) umgeschrieben', all(I['ids'].values()) and I['n'] == 2, I['ids'])
        V = await pg.evaluate("""(async()=>{ const blob = await Pkg.build(Proj.P); const D = await Pkg.dir(blob); const f = D['loopsmiths.json'], txt = new TextDecoder().decode(new Uint8Array(await blob.slice(f.data, f.data + f.size).arrayBuffer()));
          const man = JSON.parse(txt), bad = txt.replace('"v": 1', '"v": 2'); const parts = [blob.slice(0, f.data), bad, blob.slice(f.data + f.size)];
          let err = ''; try { await Pkg.load(new Blob(parts)); } catch (e) { err = e.message; }
          let err2 = ''; try { await Pkg.load(new Blob(['kein zip'])); } catch (e) { err2 = e.message; }
          return { man: { format: man.format, v: man.v, audio: man.audio.length, inst: man.inst, kits: man.kits }, err, err2 } })()""")
        check('Datei enthält Format/Version, Audio-Liste und Instrumentenverweise', V['man']['format'] == 'loopsmiths-project' and V['man']['v'] == 1 and V['man']['audio'] == 3 and V['man']['inst'] == ['epiano'], V['man'])
        check('Version wird geprüft (neueres Format → klare Meldung), Unsinn wird abgelehnt', 'neueren' in V['err'] and 'Loopsmiths' in V['err2'], (V['err'], V['err2']))
        big = await pg.evaluate("""(async()=>{ await Proj.newProject('Groß'); const m = await __mk('Lang', 40, t => Math.sin(t * 1234.5) * 0.2, true); __addTrack('Lang', m, 0); const steps = []; const blob = await Pkg.build(Proj.P, f => steps.push(f));
          const t0 = performance.now(); const P = await Pkg.load(blob); const r = P.regions[0], d = await SDB.read(r.audio, m.frames - 10, 10), o = await SDB.read(m.id, m.frames - 10, 10);
          return { steps: steps.length, last: steps[steps.length - 1], same: Array.from(d.l).every((v, i) => v === o.l[i]) && Array.from(d.r).every((v, i) => v === o.r[i]), mb: Math.round(blob.size / 1048576) } })()""")
        check('Große Projekte blockweise mit Fortschritt (40 s Stereo), Ende bitgenau', big['steps'] >= 20 and abs(big['last'] - 1) < 1e-9 and big['same'], big)

        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
