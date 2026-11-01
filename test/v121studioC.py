# v121 Studio: Takes/Comping, Tempo- und Taktwechsel (Tempokarte), Gruppenbusse + Sidechain
import asyncio, sys, json
from playwright.async_api import async_playwright
S = 'http://localhost:8765/studio/'
ok = 0; tot = 0
def check(n, c, info=''):
    global ok, tot; tot += 1; ok += bool(c); print(('OK    ' if c else 'FEHLER') + '  ' + n + ('  · ' + str(info) if info != '' else ''))

HELP = """
window.__mk = async (name, secs, fn) => { const sr = Engine.sr(), n = Math.round(sr * secs), w = SDB.writer(name, sr, false), B = 65536;
  for (let a = 0; a < n; a += B) { const m = Math.min(B, n - a), l = new Float32Array(m); for (let i = 0; i < m; i++) l[i] = fn((a + i) / sr); w.push(l, l); }
  return (await w.done()); };
window.__addTrack = (name, meta, start) => { let tid; Proj.change('regions', q => { const t = Proj.track('audio', name); tid = t.id; q.tracks.push(t); if (meta) q.regions.push({ id: Proj.nid('r'), track: t.id, kind: 'audio', audio: meta.id, start: start || 0, offset: 0, len: meta.frames, gain: 0, fi: 0, fo: 0, name }); }); Engine.dirty(true); return tid; };
// Goertzel-Pegel einer Frequenz in [a, b)
window.__gz = (x, a, b, f) => { const w = 2 * Math.PI * f / x.sr, c = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = a; i < b; i++) { const s = x.l[i] + c * s1 - s2; s2 = s1; s1 = s; } return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) / (b - a) * 2; };
window.__rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x.l[i] * x.l[i]; return Math.sqrt(s / Math.max(1, b - a)); };
0"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1366, 'height': 1024}, bypass_csp=True, accept_downloads=True, permissions=['microphone'])
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(S); await pg.wait_for_timeout(1200)
        await pg.evaluate(HELP); await pg.evaluate("Engine.ensure().then(()=>0)")
        sr = await pg.evaluate("Engine.sr()")

        # ================= altes Projekt (v120-Format) lädt unverändert =================
        old = await pg.evaluate("""(async()=>{ const m = await __mk('Alt', 4, t => Math.sin(t*2*Math.PI*330)*0.3); const P = Proj.blank('Altes Projekt', Engine.sr()); P.id = 'pOLD120'; P.bpm = 90; P.sig = 4;
          const t = Proj.track ? null : null; const tr = { id: 'tOld', kind: 'audio', name: 'Gitarre', color: '#2de2ff', vol: -3, pan: 10, mute: false, solo: false, arm: false, eq: EQ7.flat(), fx: { comp: { on: true, th: -20, ratio: 3, att: 10, rel: 120, mk: 2 }, sat: { on: false, drive: 30 }, rev: 10, dly: 0 }, auto: { vol: [], pan: [] } };
          P.tracks.push(tr); P.regions.push({ id: 'rOld', track: 'tOld', kind: 'audio', audio: m.id, start: Math.round(Engine.sr()*60/90*4), offset: 0, len: m.frames, gain: 0, fi: 0, fo: 0, name: 'Alt' }); P.markers.push({ f: Math.round(Engine.sr()*60/90*8), name: 'Refrain', color: '#8ad94e' });
          await SDB.put('projects', P); const before = JSON.stringify(P); await Proj.load('pOLD120'); Arr.zoomAll(); UI.sync(); await Engine.seek(Math.round(Engine.sr()*60/90*9)); const pos = document.getElementById('lPos').textContent;
          const x = await Exp.render({ a: 0, b: Proj.projEnd(), tail: 0 }); await Proj.save(); const after = JSON.stringify(await SDB.get('projects', 'pOLD120'));
          return { same: before === after, pos, bar: Proj.bar(), want: Engine.sr()*60/90*4, peak: x.l.reduce((m,v)=>Math.max(m,Math.abs(v)),0), pre: __rms(x, 1000, Math.round(Engine.sr()*2.5)), g: Engine.graph.grp.length, sc: Engine.graph.tr.some(n => n.comp.sc), tempo: 'tempo' in Proj.P, groups: 'groups' in Proj.P } })()""")
        check('Altes Projekt: lädt, Format bleibt beim Speichern unverändert', old['same'] and not old['tempo'] and not old['groups'], old)
        check('Altes Projekt: konstantes Tempo (eine Tempo-Markierung), Taktanzeige stimmt', abs(old['bar'] - old['want']) < 1 and old['pos'] == '3.2.1', old['pos'])
        check('Altes Projekt: Wiedergabe/Export wie vorher (Region ab Takt 2, Ton da)', old['peak'] > 0.1 and old['pre'] < 1e-4, (round(old['peak'], 3), old['pre']))
        check('Ohne Nutzung: keine Busse, kein Sidechain-Knoten im Graph', old['g'] == 0 and not old['sc'])

        # ================= Takes: Aufnahme im Cycle =================
        await pg.evaluate("(async()=>{ await Proj.newProject('Takes'); Proj.change('tempo', q => { q.bpm = 120; }); localStorage.setItem('3nps-studio-lat','0'); localStorage.setItem('3nps-studio-countin','0'); Sched.countIn = false; Rec.setTakes(true); UI.sync(); })()")
        await pg.evaluate("(()=>{ const P = Proj.P; P.cycle = { on: true, a: 0, b: Proj.bar2f(1) }; Engine.setCycle(); Arr.V.selTrack = null; UI.sync(); })()")
        tk_on = await pg.evaluate("document.getElementById('tTakes').classList.contains('on')")
        await pg.click('#bRec'); await pg.wait_for_timeout(int(2.0 * 3 * 1000 + 900))
        await pg.click('#bRec'); await pg.wait_for_timeout(1800)
        R = await pg.evaluate("(()=>{ const P = Proj.P, r = P.regions.find(r => r.takes); const t = r && P.tracks.find(t => t.id === r.track); return r && { n: r.takes.length, start: r.start, len: r.len, L: Proj.bar2f(1), comp: r.comp, last: r.takes[r.takes.length-1].id, full: r.takes.filter(k => k.len === r.len).length, offs: r.takes.map(k => k.offset), open: t.takesOpen, cyc: P.cycle.on, regs: P.regions.filter(q => q.track === r.track).length } })()")
        check('„Takes“ an (Knopf leuchtet)', tk_on)
        check('Aufnahme im Cycle: 3 Durchgänge = 3 Takes in einem Take-Ordner', R and R['n'] >= 3 and R['full'] >= 3 and R['regs'] == 1, R and (R['n'], R['full'], R['regs']))
        check('Take-Ordner liegt genau im Cycle, Takes um je 1 Cycle-Länge versetzt', R and R['start'] == 0 and R['len'] == R['L'] and all(abs(R['offs'][i + 1] - R['offs'][i] - R['L']) < 1 for i in range(len(R['offs']) - 1)), R and R['offs'])
        check('Cycle bleibt an, Take-Zeilen aufgeklappt, Comp = letzter ganzer Take', R and R['cyc'] and R['open'] and R['comp'] and len(R['comp']) == 1, R and R['comp'])
        lv = await pg.evaluate("(async()=>{ const r = Proj.P.regions.find(r => r.takes); const d = await SDB.read(r.takes[1].audio, r.takes[1].offset, r.len); let m = 0; for (const v of d.l) m = Math.max(m, Math.abs(v)); return m })()")
        check('Takes enthalten Ton (Test-Mikrofon)', lv > 0.01, round(lv, 3))
        # zweite Aufnahme im selben Cycle → weitere Takes im selben Ordner
        await pg.evaluate("Engine.seek(0)")
        await pg.click('#bRec'); await pg.wait_for_timeout(int(2.0 * 1000 + 900)); await pg.click('#bRec'); await pg.wait_for_timeout(1500)
        n2 = await pg.evaluate("(()=>{ const rs = Proj.P.regions.filter(r => r.takes); return [rs.length, rs[0].takes.length, rs[0].takes.map(t=>t.name)] })()")
        check('Nochmal aufnehmen: Takes kommen in denselben Ordner dazu', n2[0] == 1 and n2[1] >= R['n'] + 1, n2)

        # ================= Comping hörbar (synthetische Takes 220 Hz / 660 Hz) =================
        cp = await pg.evaluate("""(async()=>{ await Proj.newProject('Comp'); Proj.change('tempo', q => { q.bpm = 120; }); const sr = Engine.sr(), L = Proj.bar2f(2);
          const a = await __mk('A', 4.2, t => Math.sin(t*2*Math.PI*220)*0.4), b = await __mk('B', 4.2, t => Math.sin(t*2*Math.PI*660)*0.4);
          let rid; Proj.change('regions', q => { const t = Proj.track('audio', 'Gesang'); t.takesOpen = true; q.tracks.push(t); rid = Proj.nid('r'); q.regions.push({ id: rid, track: t.id, kind: 'audio', audio: b.id, start: 0, offset: 0, len: L, tlen: L, gain: 0, fi: 0, fo: 0, name: 'Gesang · 2 Takes', takes: [{ id: 'kA', name: 'Take 1', audio: a.id, offset: 0, len: L }, { id: 'kB', name: 'Take 2', audio: b.id, offset: 0, len: L }], comp: [{ a: 0, b: L, k: 'kB' }] }); });
          Engine.dirty(true); UI.show('arr'); Arr.V.x0 = 0; Arr.V.y0 = 0; Arr.zoomAll(); Arr.heads(); return { rid, L, th: Arr.V.th } })()""")
        await pg.wait_for_timeout(400)
        box = await pg.locator('#lanes').bounding_box()
        ytk = box['y'] + 34 + cp['th'] + 0 * 30 + 15
        xa = await pg.evaluate("Arr.fx(Proj.bar2f(0.5))"); xb = await pg.evaluate("Arr.fx(Proj.bar2f(1))")
        await pg.evaluate("document.getElementById('tSnap').value='beat'")
        await pg.mouse.move(box['x'] + xa, ytk); await pg.mouse.down(); await pg.mouse.move(box['x'] + (xa + xb) / 2, ytk, steps=4); await pg.mouse.move(box['x'] + xb, ytk, steps=4); await pg.mouse.up()
        await pg.wait_for_timeout(300)
        comp = await pg.evaluate("Proj.reg('%s').comp" % cp['rid'])
        bar = cp['L'] / 2
        check('Comping per Wischen: Take 1 im gewischten Bereich (Takt 1,5–2)', comp and len(comp) == 3 and comp[1]['k'] == 'kA' and abs(comp[1]['a'] - bar / 2) < 2 and abs(comp[1]['b'] - bar) < 2, comp)
        m = await pg.evaluate("""(async()=>{ const x = await Exp.render({ a: 0, b: Proj.bar2f(2), tail: 0, noMaster: true }), sr = x.sr, B = Proj.bar2f(1), H = Proj.bar2f(0.5), w = Math.round(sr*0.1);
          const r = (a) => ({ lo: __gz(x, a, a + w, 220), hi: __gz(x, a, a + w, 660) });
          // Schnittstelle: größter Sprung zwischen zwei Abtastwerten um die Naht (±15 ms)
          let jump = 0; for (let i = H - Math.round(sr*0.03); i < H + Math.round(sr*0.03); i++) jump = Math.max(jump, Math.abs(x.l[i+1] - x.l[i]));
          // Überblendung direkt am Klangbaustein: Takes mit Gleichspannung +0,5 / −0,5 → Übergangsbereich zählen
          const P = Proj.P, r0 = P.regions[0], ca = await __mk('DCa', 4.2, t => 0.5), cb = await __mk('DCb', 4.2, t => -0.5);
          const Q = JSON.parse(JSON.stringify(P)), q = Q.regions[0]; q.takes[0].audio = ca.id; q.takes[1].audio = cb.id;
          const d = await Engine.blockData(Q, 0, Math.floor(H / Engine.B)), j0 = H - Math.floor(H / Engine.B) * Engine.B; let ramp = 0, mono = true; for (let i = j0 - 600; i < j0 + 600; i++) { const v = d.l[i]; if (v > -0.499 && v < 0.499) ramp++; if (i > j0 - 600 && Math.sign(d.l[j0 + 600] - d.l[j0 - 600]) * (d.l[i] - d.l[i - 1]) < -1e-6) mono = false; }
          return { before: r(H - w - 2000), inside: r(H + 2000), after: r(B + 2000), jump, ramp, mono, sum: d.l[j0] } })()""")
        check('Offline-Render: vor dem Schnitt Take 2 (660 Hz), im Bereich Take 1 (220 Hz), danach wieder Take 2',
              m['before']['hi'] > 0.1 and m['before']['lo'] < 0.02 and m['inside']['lo'] > 0.1 and m['inside']['hi'] < 0.02 and m['after']['hi'] > 0.1 and m['after']['lo'] < 0.02, m)
        check('Überblendung ~10 ms an der Schnittstelle (gleitend, kein Knack)', 380 <= m['ramp'] <= 460 * sr / 44100 + 20 and m['mono'] and abs(m['sum']) < 0.05 and m['jump'] < 0.06, (m['ramp'], m['mono'], round(m['sum'], 3), round(m['jump'], 3)))
        # Antippen: Take 2 im Abschnitt Takt 1,5–2 (zweite Take-Zeile)
        await pg.mouse.click(box['x'] + (xa + xb) / 2, box['y'] + 34 + cp['th'] + 1 * 30 + 15); await pg.wait_for_timeout(300)
        comp2 = await pg.evaluate("Proj.reg('%s').comp" % cp['rid'])
        check('Comping per Antippen: Abschnitt wechselt zurück auf Take 2', comp2 and len(comp2) == 1 and comp2[0]['k'] == 'kB', comp2)
        # Take-Liste: Umbenennen, Ganz nehmen, Zu Region machen
        await pg.evaluate("Arr.V.sel = '%s'; UI.inspect()" % cp['rid'])
        await pg.click('#dRegC [data-r="takes"]'); await pg.wait_for_timeout(300)
        nitems = await pg.locator('#dlg .takel .item').count()
        await pg.locator('#dlg .takel .item').nth(0).locator('[data-ta="ren"]').click(); await pg.wait_for_timeout(200)
        await pg.fill('#askI', 'Strophe gut'); await pg.click('#askOk'); await pg.wait_for_timeout(300)
        await pg.locator('#dlg .takel .item').nth(0).locator('[data-ta="all"]').click(); await pg.wait_for_timeout(300)
        st = await pg.evaluate("(()=>{ const r = Proj.reg('%s'); return { n: r.takes[0].name, comp: r.comp } })()" % cp['rid'])
        check('Take-Liste: Umbenennen und „Ganz nehmen“', nitems == 2 and st['n'] == 'Strophe gut' and len(st['comp']) == 1 and st['comp'][0]['k'] == 'kA', st)
        await pg.locator('#dlg .takel .item').nth(1).locator('[data-ta="del"]').click(); await pg.wait_for_timeout(300)
        nd = await pg.evaluate("Proj.reg('%s').takes.length" % cp['rid'])
        await pg.evaluate("UI.close()"); await pg.click('#tUndo'); await pg.wait_for_timeout(200)
        nu = await pg.evaluate("Proj.reg('%s').takes.length" % cp['rid'])
        check('Take löschen (↶ holt ihn zurück)', nd == 1 and nu == 2, (nd, nu))
        await pg.evaluate("UI.close(); UI.takeDlg('%s')" % cp['rid']); await pg.wait_for_timeout(200)
        await pg.locator('#dlg .takel .item').nth(1).locator('[data-ta="reg"]').click(); await pg.wait_for_timeout(300)
        rg = await pg.evaluate("(()=>{ const r = Proj.reg('%s'); return { takes: !!r.takes, audio: r.audio, comp: !!r.comp } })()" % cp['rid'])
        bid = await pg.evaluate("Proj.P.regions[0].audio")
        x2 = await pg.evaluate("(async()=>{ const x = await Exp.render({ a: 0, b: Proj.bar2f(2), tail: 0, noMaster: true }); return { lo: __gz(x, 2000, 8000, 220), hi: __gz(x, 2000, 8000, 660) } })()")
        check('„Zu Region machen“: normale Region aus dem Take (klingt 660 Hz)', not rg['takes'] and not rg['comp'] and x2['hi'] > 0.1 and x2['lo'] < 0.02, (rg, x2))

        # ================= Tempo- und Taktwechsel =================
        T = await pg.evaluate("""(async()=>{ await Proj.newProject('Tempo'); Proj.change('tempo', q => { q.bpm = 120; q.sig = 4; }); const sr = Engine.sr();
          const au = await __mk('Klick', 3, t => (t % 1 < 0.02 ? 0.5 : 0)); const ta = __addTrack('Audio', au, Math.round(sr * 2.5));
          // Drummer- und Noten-Spur ab Takt 1
          let dt, mt; Proj.change('tracks', q => { const d = Proj.track('drum', 'Drums'); d.kit = 'synth'; dt = d.id; q.tracks.push(d); q.regions.push({ id: 'rDr', track: d.id, kind: 'drum', start: 0, len: Math.round(sr * 2 * 6), name: 'Rock', drum: { mode: 'gen', style: 'rock', energy: 60, cplx: 0, fill: 0, human: 0, vol: 85, crash: false } });
            const m = Proj.track('midi', 'Klavier'); m.inst = 'epiano'; mt = m.id; q.tracks.push(m); q.regions.push({ id: 'rMi', track: m.id, kind: 'midi', start: 0, len: Math.round(sr * 2 * 6), name: 'Noten', notes: [0, 4, 8, 9, 10, 16, 19].map(b => ({ t: b, d: 0.5, m: 60, v: 100 })) }); });
          Proj.P.cycle = { on: false, a: Proj.bar2f(2), b: Proj.bar2f(3) };
          Engine.dirty(true);
          UI.setTempoMap(120, 4, [{ bar: 2, bpm: 60 }, { bar: 3, sig: 3 }]);
          const P = Proj.P, bars = [0,1,2,3,4,5].map(b => Proj.bar2f(b) / sr), ar = P.regions.find(r => r.kind === 'audio').start / sr;
          const hits = []; Drum.hitsIn(P, 0, Proj.bar2f(5), (ti, t, f, id) => { if (id === 'kick') hits.push(f / sr); });
          const notes = []; Inst.notesIn(P, 0, Infinity, (ti, t, f) => notes.push(f / sr));
          await Engine.seek(Math.round(sr * 9)); const pos = document.getElementById('lPos').textContent, sig = document.getElementById('lSig').textContent, bpm = document.getElementById('lBpm').value;
          const snap = Proj.snap(Math.round(sr * 4.6), 'beat') / sr, snapB = Proj.snap(Math.round(sr * 8.4), 'bar') / sr;
          return { bars, ar, hits, notes, pos, sig, bpm, snap, snapB, cyc: [P.cycle.a / sr, P.cycle.b / sr], tempo: P.tempo, segs: TMap.segs(P).length } })()""")
        check('Tempokarte: Takt 3 nach 4 s (120 BPM), Takt 4 nach 8 s (60 BPM), Takt 5 nach 11 s (3/4)', [round(v, 3) for v in T['bars'][:5]] == [0, 2, 4, 8, 11] and abs(T['bars'][5] - 14) < 1e-3, T['bars'])
        check('Audio-Region bleibt in Sekunden fest (2,5 s)', abs(T['ar'] - 2.5) < 1e-3, T['ar'])
        check('Cycle folgt den Takten (Takt 3–4 = 4–8 s)', abs(T['cyc'][0] - 4) < 1e-3 and abs(T['cyc'][1] - 8) < 1e-3, T['cyc'])
        check('Taktzahlen/Anzeige: 9 s = 4.2.1 (Takt 4, Schlag 2), Taktart 3/4 und 60 BPM an der Stelle', T['pos'] == '4.2.1' and T['sig'].startswith('3/4') and abs(float(T['bpm']) - 60) < 0.01, (T['pos'], T['sig'], T['bpm']))
        check('Drummer folgt: Kick auf jeder Takt-Eins (0, 2, 4, 8, 11 s)', all(any(abs(h - v) < 0.002 for h in T['hits']) for v in [0, 2, 4, 8, 11]), [round(h, 2) for h in T['hits']][:24])
        check('3/4-Takt: Drummer spielt 3 Schläge (keine Treffer über die Takt-Eins hinaus)', not any(8 + 3 - 0.01 > h > 8 + 2.99 for h in T['hits']) and any(abs(h - 10) < 0.01 for h in T['hits']), [round(h, 2) for h in T['hits'] if h >= 8])
        check('Noten folgen der Tempokarte (Schlag 8 = 4 s, 9 = 5 s, 16 = 12 s, 19 = 15 s)', all(any(abs(n - v) < 0.002 for n in T['notes']) for v in [0, 2, 4, 5, 6, 12, 15]), [round(n, 2) for n in T['notes']])
        check('Einrasten/Quantisierung folgt (4,6 s → Schlag 5 s; 8,4 s → Takt 8 s)', abs(T['snap'] - 5) < 1e-3 and abs(T['snapB'] - 8) < 1e-3, (T['snap'], T['snapB']))
        # Metronom: Klicks über den Tempowechsel hören (Oszillator-Starts mitschneiden)
        await pg.evaluate("""(()=>{ window.__clk = []; const o = OscillatorNode.prototype.start; OscillatorNode.prototype.start = function (t) { if (this.type === 'square') __clk.push([this.frequency.value, t]); return o.apply(this, arguments); }; Sched.click = true; })()""")
        await pg.evaluate("(async()=>{ await Engine.seek(Math.round(Engine.sr()*3)); await Engine.play(); window.__t0 = Engine.st.t0; })()")
        await pg.wait_for_timeout(9000)
        clk = await pg.evaluate("(()=>{ Engine.stop(); Sched.click = false; return __clk.map(([f, t]) => [f > 1500 ? 1 : 0, Math.round((t - __t0 + 3) * 1000) / 1000]) })()")
        times = [c[1] for c in clk]; acc = [c[1] for c in clk if c[0]]
        want = [3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11]
        check('Metronom folgt: 0,5 s vor Takt 3, danach 1 s; Betonung auf 4, 8, 11 s (3/4)', all(any(abs(t - v) < 0.003 for t in times) for v in want) and not any(abs(t - 4.5) < 0.01 for t in times) and all(any(abs(a - v) < 0.003 for a in acc) for v in [4, 8, 11]) and not any(abs(a - 7) < 0.01 or abs(a - 10) < 0.01 for a in acc), (times[:14], acc))
        # Tempowechsel verschieben: Takt 3 → 120 BPM, Drummer/Cycle wandern mit, Audio bleibt
        T2 = await pg.evaluate("""(()=>{ const sr = Engine.sr(); UI.setTempoMap(120, 4, [{ bar: 2, bpm: 90 }, { bar: 3, sig: 3 }]); const P = Proj.P; return { b3: Proj.bar2f(3) / sr, cyc: [P.cycle.a / sr, P.cycle.b / sr], ar: P.regions.find(r => r.kind === 'audio').start / sr, dr: P.regions.find(r => r.kind === 'drum').len / sr } })()""")
        check('Tempo ändern: Takte/Cycle verschieben sich, Audio bleibt bei 2,5 s', abs(T2['b3'] - (4 + 4 * 60 / 90)) < 1e-3 and abs(T2['cyc'][1] - T2['b3']) < 1e-3 and abs(T2['ar'] - 2.5) < 1e-3, T2)
        # MIDI-Export mit Tempo-Meta
        md = await pg.evaluate("""(()=>{ const u = Exp.midi(Proj.P, 0), ev = []; for (let i = 0; i < u.length - 6; i++) { if (u[i] === 0xFF && u[i+1] === 0x51 && u[i+2] === 3) ev.push(['tempo', Math.round(60000000 / ((u[i+3] << 16) | (u[i+4] << 8) | u[i+5]) * 100) / 100]); if (u[i] === 0xFF && u[i+1] === 0x58 && u[i+2] === 4) ev.push(['sig', u[i+3]]); } return ev })()""")
        check('MIDI-Export enthält Tempo-Meta (120 → 90) und Taktart 4/4 → 3/4', ['tempo', 120] in md and ['tempo', 90] in md and ['sig', 4] in md and ['sig', 3] in md, md)
        # Tempo-Dialog
        await pg.click('#tTempo'); await pg.wait_for_timeout(300)
        rows = await pg.locator('#tmList .tmrow').count()
        await pg.click('#dlg [data-close]')
        check('Dialog „♩ Tempo/Takt“ zeigt die Wechsel', rows == 2, rows)
        await pg.click('#tUndo'); await pg.wait_for_timeout(200)
        un = await pg.evaluate("Proj.P.tempo")
        check('Rückgängig stellt die vorige Tempokarte her', un and un[0]['bpm'] == 60, un)

        # ================= Gruppenbusse und Sidechain =================
        G = await pg.evaluate("""(async()=>{ await Proj.newProject('Bus'); Proj.change('tempo', q => { q.bpm = 120; }); const sr = Engine.sr();
          const bass = await __mk('Bass', 4, t => Math.sin(t*2*Math.PI*110)*0.4), kick = await __mk('Kick', 4, t => (t % 0.5 < 0.1 ? Math.sin(t*2*Math.PI*60)*0.9 : 0));
          const tb = __addTrack('Bass', bass), tk = __addTrack('Kick', kick); window.__tb = tb; window.__tk = tk;
          const L = async () => { const x = await Exp.render({ a: 0, b: sr * 4, tail: 0, only: tb, noMaster: true }); return __rms(x, sr * 0.2, sr * 3.8); };
          const l0 = await L(); UI.show('mix'); return { l0 } })()""")
        await pg.select_option('.strip[data-t] select.out >> nth=0', 'g1'); await pg.wait_for_timeout(300)
        G2 = await pg.evaluate("""(async()=>{ const sr = Engine.sr(), P = Proj.P, L = async () => { const x = await Exp.render({ a: 0, b: sr * 4, tail: 0, only: __tb, noMaster: true }); return __rms(x, sr * 0.2, sr * 3.8); };
          const strips = document.querySelectorAll('.strip.grp').length, grp = Engine.graph.grp.filter(Boolean).length, out = P.tracks[0].out;
          const l1 = await L(); Proj.editChan('g1', g => { g.vol = -12; }); const l2 = await L(); Proj.editChan('g1', g => { g.vol = 0; g.mute = true; }); const l3 = await L(); Proj.editChan('g1', g => { g.mute = false; });
          return { strips, grp, out, l1, l2, l3 } })()""")
        check('Spur-Ausgang „→ Bus 1“: Bus entsteht, eigener Streifen im Mischpult', G2['out'] == 'g1' and G2['strips'] == 1 and G2['grp'] == 1, G2)
        check('Bus-Routing messbar: Bus-Fader −12 dB senkt die Spur auf ¼, Bus-Mute = still', abs(G2['l1'] - G['l0']) < G['l0'] * 0.02 and abs(G2['l2'] / G2['l1'] - 0.2512) < 0.02 and G2['l3'] < 1e-4, (G['l0'], G2))
        # Sidechain über das Effekte-Fenster des Basses
        await pg.click('.strip[data-t] .slot[data-k="comp"] >> nth=0'); await pg.wait_for_timeout(300)
        opts = await pg.evaluate("[...document.querySelectorAll('#fxSc option')].map(o => o.textContent)")
        await pg.select_option('#fxSc', await pg.evaluate("__tk")); await pg.wait_for_timeout(200)
        await pg.evaluate("""(()=>{ const set = (k, v) => { const el = document.querySelector('#dlg [data-k="' + k + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }; set('comp.th', -40); set('comp.ratio', 20); set('comp.att', 1); set('comp.rel', 60); set('comp.mk', 0); })()""")
        await pg.click('#dlg [data-close]'); await pg.wait_for_timeout(300)
        SC = await pg.evaluate("""(async()=>{ const sr = Engine.sr(), t = Proj.P.tracks[0]; const x = await Exp.render({ a: 0, b: sr * 4, tail: 0, only: __tb, noMaster: true });
          let on = 0, off = 0, no = 0, nf = 0; for (let k = 1; k < 7; k++) { const a = Math.round((k * 0.5 + 0.02) * sr); on += __rms(x, a, a + Math.round(0.06 * sr)); no++; const b = Math.round((k * 0.5 + 0.3) * sr); off += __rms(x, b, b + Math.round(0.12 * sr)); nf++; }
          return { sc: t.fx.comp.sc === __tk, on: t.fx.comp.on, duck: on / no, free: off / nf, node: Engine.graph.tr[0].comp.sc === true, other: Engine.graph.tr[1].comp instanceof DynamicsCompressorNode } })()""")
        check('Sidechain-Auswahl: Spuren und Busse wählbar', any('Kick' in o for o in opts) and not any('Bus 1' in o for o in opts), opts)
        check('Sidechain-Ducking im Export: Bass leiser während der Kick (≥ 10 dB)', SC['sc'] and SC['on'] and SC['duck'] < SC['free'] * 0.316 and SC['free'] > 0.1, SC)
        check('Sidechain-Knoten nur dort, wo gewählt (andere Spuren: normaler Kompressor)', SC['node'] and SC['other'])
        live = await pg.evaluate("(async()=>{ await Engine.seek(0); await Engine.play(); await new Promise(r => setTimeout(r, 1800)); const red = Engine.graph.tr[0].comp.red || 0; Engine.stop(); return red })()")
        check('Sidechain wirkt auch live (Absenkung gemeldet)', live > 6, round(live, 1))
        # Bus-Sidechain: Bus 1 (mit Bass) duckt bei der Kick; Bass selbst ohne
        BS = await pg.evaluate("""(async()=>{ const sr = Engine.sr(); Proj.editTrack(__tb, t => { t.fx.comp.sc = ''; t.fx.comp.on = false; }); Proj.editChan('g1', g => { g.fx.comp = { on: true, th: -40, ratio: 20, att: 1, rel: 60, mk: 0, sc: __tk }; }); Engine.dirty(true);
          const x = await Exp.render({ a: 0, b: sr * 4, tail: 0, only: __tb, noMaster: true }); let on = 0, off = 0; for (let k = 1; k < 7; k++) { const a = Math.round((k * 0.5 + 0.02) * sr); on += __rms(x, a, a + Math.round(0.06 * sr)); const b = Math.round((k * 0.5 + 0.3) * sr); off += __rms(x, b, b + Math.round(0.12 * sr)); }
          return { duck: on / 6, free: off / 6, node: Engine.graph.grp[0].comp.sc === true } })()""")
        check('Bus mit Sidechain (Bus 1 duckt bei der Kick)', BS['node'] and BS['duck'] < BS['free'] * 0.316, BS)
        # Rückkopplung ausgeschlossen: Bass-Sidechain = eigener Bus wird ignoriert
        fb = await pg.evaluate("(async()=>{ Proj.editTrack(__tb, t => { t.fx.comp = { on: true, th: -40, ratio: 20, att: 1, rel: 60, mk: 0, sc: 'g1' }; }); Engine.dirty(true); const x = await Exp.render({ a: 0, b: Engine.sr() * 2, tail: 0, only: __tb, noMaster: true }); return __rms(x, 1000, Engine.sr() * 1.9) })()")
        check('Sidechain auf den eigenen Bus führt nicht zu Rückkopplung/Stille-Fehler', fb > 0.01, round(fb, 4))
        # Projekt speichern/laden behält Busse, Takes-Format
        sv = await pg.evaluate("(async()=>{ await Proj.save(); const id = Proj.P.id; await Proj.load(id); return { g: (Proj.P.groups||[]).length, out: Proj.P.tracks[0].out } })()")
        check('Busse bleiben nach Speichern/Laden', sv['g'] == 1 and sv['out'] == 'g1', sv)
        check('keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print('\n%d/%d' % (ok, tot)); sys.exit(0 if ok == tot else 1)
asyncio.run(main())
