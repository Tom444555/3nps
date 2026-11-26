/* ---------- v163: Mitsingen lernen (Lernen › Mitsingen lernen) ----------
   Wird erst beim ersten Öffnen geladen (lernen.js lädt mitsingen.css/.js). Links der Fahrplan in 8 Schritten mit Haken je Stück und drei Wegen
   („Gründlich“, „Schnell“, „Mit Gitarre“), rechts der Schritt: „So geht’s“, „Warum“, Richtzeit, Übungsfeld, „Tipps zu diesem Schritt“.
   Bausteine für weitere Fahrplan-Seiten (v165 „Songtext schreiben“): planCard()/stepCard() bauen dasselbe Gerüst (Klassen msl-…),
   Inhalt kommt nur aus STEPS/WAYS – ein anderer Fahrplan braucht nur andere Listen.
   Üben mit Musikdatei – nutzt nur, was die App schon anbietet (keine zweite Ladeart): die Datei auf einer Looper-Spur (Looper.singSrc/singAudio),
   den erkannten Text aus „Mitsingen“ (Sing.source/lines/endOf: Zeilen mit Zeiten; sonst Abschnitte nach Takten), Zeitdehnung ohne Tonhöhe
   (Looper.stretchAudioHQ, Signalsmith Stretch), Tonart verschieben mit demselben Verfahren im eigenen Worker (stretch/worker.js, erst bei Bedarf),
   „Gesang trennen“ des Loopers (Looper.sepTrack, Rückfrage zum 79-MB-Download dort) und die Begleitung daraus (Looper.karaAudio), Mikrofon über
   den Eingang des Loopers (Looper.openInput/inputAnalyser, erst nach Antippen von „● Aufnehmen“). Eigene Wiedergabe: ein AudioBufferSource am
   Master-Bus wie „Zeile üben“ im Mitsingen; der Looper wird vorher angehalten, startet er, stoppt die Wiedergabe hier.
   Übezeit: Die Seite schreibt KEINE Zeit (Tom 26.11.: „nicht dass die Zeit gedoppelt wird“) – sie zeigt die Summe nur an und bietet „Üben einschalten“
   (derselbe Schalter wie überall). Ihre Wiedergabe startet den Looper nicht, also auch keine Looper-Zeit.
   Speicher: localStorage „3nps-mitsingen“ – EIN Schlüssel, jedes Schreiben ein setItem:
     { v: 1, w: Weg 'g'|'s'|'m', cur: Stück-Schlüssel, p: { Schlüssel: { n: Name, d: [geschaffte Schritte], s: gezeigter Schritt,
       h: [[Datei, Einheit 'l'|'t', Index, Umfang, Text]] (schwierige Stellen), e: geändert } } }
   Stück-Schlüssel: 'sb:<id>' (Songbook), 'f:<Datei>' (geladene Datei), 'o:<id>' (eigenes Stück), '_' (ohne Stück).
   Aufnahmen bleiben im Speicher der Seite (und auf Wunsch als Idee in der App) – nichts verlässt das Gerät. */
window.MitsingenLernen = (() => {
  const KEY = '3nps-mitsingen', SBKEY = '3nps-songbook', TKEY = '3nps-uebezeit-themen', $ = id => document.getElementById(id);
  const TT = s => (typeof T === 'function' ? T(s) : s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
  const md = x => ((x % 12) + 12) % 12;
  const isMin = () => window.__dev === 'min';

  /* ---------- Inhalt: 8 Schritte, 3 Wege (in eigenen Worten nach Gesangs- und Gitarrenlehrer-Quellen, siehe PAKET-v159-v161.md) ---------- */
  // pre: Voreinstellung fürs Übungsfeld { r: Tempo, m: 'loop'|'echo', v: Gesang 1 | 0.35 | 0 }, x: Zusatz ('key' Tonart, 'text' Text, 'chords' Akkorde & Text)
  const STEPS = [
    { t: 'Song & Tonart', c: 'Passt das Lied zu deiner Stimme?', min: 'ca. 5 min', x: 'key',
      so: 'Sing den Refrain und die höchste Stelle einmal locker mit, ohne zu drücken. Wird es oben eng oder unten brummig, verschieb die Tonart, bis beide Enden bequem gehen.',
      why: 'In einer Tonart, die nicht zu deiner Stimme passt, übst du gegen die Stimme statt mit ihr – das kostet Kraft und Fehler setzen sich fest.',
      err: ['Die Originaltonart erzwingen, weil sie „richtig“ klingt.', 'Nur die Strophe prüfen – die hohen Stellen kommen meist im Refrain.', 'Mit kalter Stimme testen: erst eine Minute summen, dann prüfen.'],
      ok: 'Höchster und tiefster Ton gehen ohne Druck – auch beim dritten Durchgang.' },
    { t: 'Hören & gliedern', c: 'Abschnitte und Atemstellen', min: 'ca. 10 min', pre: { r: 1, m: 'loop', v: 1 },
      so: 'Hör das Lied zwei-, dreimal bewusst durch, ohne mitzusingen. Merk dir den Ablauf (Strophe, Refrain, Bridge) und wo der Sänger Luft holt – schwierige Stellen gleich mit „★ Stelle merken“ sichern.',
      why: 'Wer den Bauplan kennt, verliert beim Singen nicht den Faden. Atemstellen, die du vorher festlegst, retten lange Zeilen.',
      err: ['Nebenbei hören statt zuhören.', 'Erst atmen, wenn die Luft schon weg ist.', 'Wiederholungen übersehen – oft ändert sich im zweiten Refrain nur ein Wort.'],
      ok: 'Du kannst den Ablauf ohne Musik aufzählen und weißt bei jeder Zeile, wo du atmest.' },
    { t: 'Text sprechen', c: 'erst lesen, dann frei', min: 'ca. 10 min', x: 'text',
      so: 'Lies den Text laut, Zeile für Zeile, in normalem Sprechtempo. Dann deck ihn ab und sprich ihn frei – erst eine Strophe, dann das Ganze.',
      why: 'Der Text bricht beim Singen am häufigsten weg. Sitzt er beim Sprechen, muss der Kopf beim Singen nicht mehr suchen.',
      err: ['Gleich singen, bevor die Worte sitzen.', 'Nur still mitlesen – lautes Sprechen trainiert auch Mund und Zunge.', 'Schwierige Wortfolgen überspringen, statt sie langsam zu wiederholen.'],
      ok: 'Du sprichst eine Strophe frei, ohne zu stocken und ohne nachzusehen.' },
    { t: 'Text im Takt', c: 'sprechen zur Aufnahme, 75 %', min: 'ca. 10 min', pre: { r: 0.75, m: 'loop', v: 1 },
      so: 'Lass die Zeile langsam laufen und sprich den Text genau im Rhythmus mit – noch nicht singen. Sitzt eine Zeile dreimal hintereinander, nimm die nächste dazu.',
      why: 'Text und Rhythmus laufen dann von allein – beim Singen bleibt der Kopf frei für die Töne.',
      err: ['Silben zu früh setzen, weil du den Text schon kennst.', 'In Gesangspausen weiterreden – Pausen gehören zum Rhythmus.', 'Zu schnell auf 100 % gehen.'],
      ok: 'Bei 100 % triffst du jeden Einsatz, auch nach einer Pause.' },
    { t: 'Melodie ohne Text', c: 'summen, Zeile für Zeile', min: 'ca. 15 min', pre: { r: 1, m: 'echo', v: 1 },
      so: 'Sing die Melodie nur auf „na“ oder summ sie – ganz ohne Worte. Mit „Vorsingen – Pause – Nachsingen“ hörst du die Zeile und singst sie in der Pause allein nach.',
      why: 'Ohne Text hörst du genauer auf die Töne. Was du in der Pause allein schaffst, kannst du wirklich – und läufst nicht nur mit.',
      err: ['Lauter werden, um hohe Töne zu erwischen.', 'Nur mitsummen, nie allein nachsingen.', 'Zu große Stücke auf einmal – eine Zeile reicht.'],
      ok: 'Du singst die Zeile in der Pause sauber nach, ohne vorher noch einmal hinzuhören.' },
    { t: 'Mit Text mitsingen', c: 'Original → leiser → Karaoke', min: 'ca. 15 min', pre: { r: 1, m: 'loop', v: 0.35 },
      so: 'Jetzt Text und Melodie zusammen: erst mit dem Original, dann mit leiserem Gesang im Lied, zuletzt ganz ohne (Karaoke). Erst wenn eine Stufe sicher ist, kommt die nächste.',
      why: 'Die Originalstimme ist eine Stütze. Wird sie leiser, merkst du, wo du dich noch anlehnst – bei Karaoke singst du allein.',
      err: ['Zu früh auf Karaoke wechseln.', 'Die Stimme des Sängers nachmachen, statt mit der eigenen zu singen.', 'Bei Fehlern weitersingen, statt die Zeile in die Schleife zu nehmen.'],
      ok: 'Mit Karaoke kommst du durch den ganzen Abschnitt, ohne dass Text oder Töne wackeln.' },
    { t: 'Mit Gitarre', c: 'summen → sprechen → singen', min: 'ca. 20 min', pre: { r: 0.75, m: 'loop', v: 0 }, x: 'chords',
      so: 'Spiel die Begleitung so oft, bis die Hände allein laufen. Dann summ dazu, dann sprich den Text, zuletzt sing. Schlag anfangs nur einmal pro Akkordwechsel an – das volle Muster kommt zum Schluss.',
      why: 'Hände und Stimme wollen beide Aufmerksamkeit. Läuft die Gitarre von allein, bleibt genug Kopf für den Gesang.',
      err: ['Gleich das volle Schlagmuster spielen.', 'Auf die Griffhand schauen, statt nach vorn zu singen.', 'Wenn es hakt, lauter spielen statt langsamer.'],
      ok: 'Du spielst und singst einen Abschnitt, ohne dass die Gitarre stockt, wenn die Stimme einsetzt.' },
    { t: 'Aufnehmen & anhören', c: 'schwierige Stellen merken', min: 'ca. 10 min', pre: { r: 1, m: 'loop', v: 0 },
      so: 'Nimm dich mit „● Aufnehmen“ auf (Kopfhörer!) und hör direkt danach zu – je Durchgang nur auf eine Sache: Text, Töne oder Timing. Was wackelt, mit „★ Stelle merken“ sichern und zurück in die Schleife.',
      why: 'Beim Singen hörst du dich anders, als andere dich hören. Die Aufnahme ist der ehrlichste Abgleich.',
      err: ['Alles auf einmal beurteilen wollen.', 'Nur die gelungenen Stellen anhören.', 'Ohne Kopfhörer aufnehmen – dann hörst du das Lied statt dich.'],
      ok: 'Du hörst die Aufnahme an und findest keine Stelle mehr, die du sofort zurück in die Schleife nehmen würdest.' }
  ];
  const WAYS = {
    g: { n: 'Gründlich', s: [1, 2, 3, 4, 5, 6, 7, 8], d: 'Alle 8 Schritte der Reihe nach – für neue Lieder. Verteil sie auf mehrere Tage; je Sitzung reichen 2–3 Schritte.' },
    s: { n: 'Schnell', s: [2, 5, 6, 8], d: 'Für Lieder, die du schon gut im Ohr hast: gliedern, Melodie prüfen, mitsingen, aufnehmen.' },
    m: { n: 'Mit Gitarre', s: [3, 4, 7, 8], d: 'Spielst du die Begleitung schon sicher, steig hier ein: Text, Text im Takt, dann mit Gitarre singen und aufnehmen.' }
  };
  const RATES = [1, 0.9, 0.75, 0.6, 0.5], VOX = [[1, 'laut'], [0.35, 'leise'], [0, 'aus']];

  /* ---------- Speicher ---------- */
  const blank = () => ({ v: 1, w: 'g', cur: '', p: {} });
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && typeof d === 'object' && d.p) return Object.assign(blank(), d); } catch (e) {} return blank(); }
  function store() { try { localStorage.setItem(KEY, JSON.stringify(D)); return true; } catch (e) { say(TT('Konnte nicht speichern – Speicher voll oder privates Surfen.'), true); return false; } }
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  let D = load(), built = false, sel = 0;
  const way = () => WAYS[D.w] || WAYS.g;
  function rec(k, make) { let r = D.p[k]; if (!r && make) { r = D.p[k] = { n: (pieces().find(x => x.k === k) || {}).n || '', d: [], s: 0, h: [], e: Date.now() }; } return r || null; }

  /* ---------- Stücke: geladene Dateien, Songbook, eigene ---------- */
  const hasLooper = () => typeof Looper !== 'undefined' && !!Looper.singSrc;
  function fileTracks() { const a = []; if (!hasLooper()) return a; for (let i = 0; i < 3; i++) { try { if (Looper.singSrc(i)) a.push(i); } catch (e) {} } return a; }
  function pieces() {
    const out = [];
    fileTracks().forEach(i => { const s = Looper.singSrc(i); out.push({ k: 'f:' + s.key, n: s.name.replace(/\.[a-z0-9]{2,4}$/i, ''), g: TT('Geladene Datei') + ' · ' + TT('Spur') + ' ' + (i + 1), tr: i }); });
    const sb = jget(SBKEY, null); (sb && Array.isArray(sb.s) ? sb.s : []).forEach(s => out.push({ k: 'sb:' + s.id, n: s.t || TT('Ohne Titel'), g: TT('Songbook'), sb: s }));
    Object.keys(D.p).filter(k => k.startsWith('o:')).forEach(k => out.push({ k, n: D.p[k].n || TT('Eigenes Stück'), g: TT('Eigene Stücke') }));
    out.push({ k: '_', n: TT('Ohne Stück (allgemein)'), g: '' });
    return out;
  }
  function curPiece() {
    const l = pieces(); let p = l.find(x => x.k === D.cur);
    if (!p) p = l.find(x => x.tr != null) || l.find(x => x.k.startsWith('sb:')) || l[l.length - 1];
    return p;
  }

  /* ---------- Quelle: Datei auf einer Looper-Spur, Zeilen aus dem erkannten Text oder Takte ---------- */
  let tr = -1, k0 = 0, span = 1, segC = { key: '', v: null }, info = null;
  function pickTrack() {
    const a = fileTracks(); if (!a.length) return -1;
    const p = curPiece(); if (p && p.tr != null) return p.tr;
    return a.includes(tr) ? tr : a[0];
  }
  function segs() {   // { src, u: 'l'|'t', list: [{ b0, b1, txt, w: [{ w, b, e }] }] }
    if (tr < 0 || !window.Sing || !Sing.source) return null;
    let src = null; try { src = Sing.source({ track: tr }); } catch (e) { src = null; }
    if (!src || src.kind !== 'file' || !src.beats) return null;
    const key = tr + '|' + src.id + '|' + (Sing.ver ? Sing.ver() : 0) + '|' + (src.tok || []).length + '|' + src.beats.length;
    if (segC.key === key) { segC.v.src = src; return segC.v; }
    let list = [], u = 't';
    const tok = src.tok || [];
    if (tok.some(t => t.b != null)) {
      list = Sing.lines(tok).map(ws => {
        const w = ws.filter(x => x.b != null); if (!w.length) return null;
        const ww = w.map(x => ({ w: x.w, b: x.b, e: Sing.endOf(tok, x.i) })).sort((a, b) => a.b - b.b);
        return { b0: ww[0].b, b1: Math.max(...ww.map(x => x.e)), txt: ww.map(x => x.w).join(' '), w: ww };
      }).filter(Boolean).sort((a, b) => a.b0 - b.b0);
      if (list.length) u = 'l';
    }
    if (u === 't') {   // ohne erkannten Text: Takte (Taktanfänge der Datei)
      const D0 = (src.downs || []).map(f => Sing.f2b(f, src.beats)).filter(b => b != null && b >= 0);
      for (let i = 0; i + 1 < D0.length; i++) list.push({ b0: D0[i], b1: D0[i + 1], txt: '', w: [] });
    }
    segC = { key, v: { src, u, list } };
    return segC.v;
  }
  function range(S) {   // aktueller Ausschnitt (Index k0, Umfang span)
    if (!S || !S.list.length) return null;
    k0 = Math.max(0, Math.min(S.list.length - 1, k0));
    const a = S.list[k0], e = S.list[Math.min(S.list.length - 1, k0 + span - 1)];
    return { b0: a.b0, b1: e.b1, k: k0, n: Math.min(span, S.list.length - k0), of: S.list.length };
  }

  /* ---------- Audio: Ausschnitt in ganzen Schlägen (1 Schlag Anlauf), Gesang leiser, Tempo, Tonart ---------- */
  let rate = 1, semi = 0, vox = 1, mode = 'loop', P = null, preparing = 0, pend = '', worker = null, wId = 0;
  const wWait = {}, cache = new Map();
  function excerpt(S, R) {
    const B = S.src.beats, bA = Math.floor(R.b0 + 1e-6) - 1, bB = Math.ceil(R.b1 - 1e-6);
    const fA = Sing.b2f(bA, B), fB = Sing.b2f(bB, B); if (fA == null || fB == null) return null;
    const a = Math.max(0, Math.floor(fA)), e = Math.ceil(fB);
    const x = Looper.singAudio(tr, a, e); if (!x) return null;
    let y = x, vOk = true;
    if (vox < 1) {
      const k = Looper.karaAudio ? Looper.karaAudio(tr, a, a + x.length) : null;
      if (k && k.length === x.length) {
        const mix = (o, c) => { const r = new Float32Array(o.length); for (let i = 0; i < o.length; i++) r[i] = c[i] + vox * (o[i] - c[i]); return r; };
        const l = mix(x.l, k.l); y = { l, r: x.r !== x.l ? mix(x.r, k.r) : l, length: x.length, sr: x.sr };
      } else vOk = false;
    }
    return { x, y, a, beats: bB - bA, bA, vOk, sr: x.sr };
  }
  function shift(x, n, f) {   // Tempo + Tonhöhe in einem Durchgang (Signalsmith Stretch im eigenen Worker, erst bei Bedarf)
    try { if (!worker) { worker = new Worker('stretch/worker.js'); worker.onmessage = e => { const w = wWait[e.data.id]; if (w) { delete wWait[e.data.id]; w(e.data); } }; } } catch (e) { return Promise.resolve(null); }
    const id = ++wId, L = x.l.slice(), R = x.r && x.r !== x.l ? x.r.slice() : null;
    return new Promise(res => {
      const tm = setTimeout(() => { delete wWait[id]; res(null); }, 6000 + x.length / x.sr * 2000);
      wWait[id] = d => { clearTimeout(tm); res(d.err || !d.l ? null : { l: d.l, r: d.r || d.l, length: d.l.length, sr: x.sr }); };
      worker.postMessage({ id, l: L, r: R, n, sr: x.sr, tr: [f], tb: 4096 }, R ? [L.buffer, R.buffer] : [L.buffer]);
    });
  }
  async function process(E) {
    const y = E.y; if (rate === 1 && !semi) return y;
    const n = Math.round(y.length / rate);
    if (semi) { const z = await shift(y, n, Math.pow(2, semi / 12)); if (z) return z; say(TT('Tonart verschieben ging hier nicht – es läuft die Originaltonart.'), true); semi = 0; paintKnobs(); }
    if (rate === 1) return y;
    return Looper.stretchAudioHQ ? await Looper.stretchAudioHQ(y, n, true) : Looper.stretchAudio(y, n);
  }
  function fade(c, n) { const m = Math.min(n, c.length >> 2); for (let i = 0; i < m; i++) { const g = i / m; c[i] *= g; c[c.length - 1 - i] *= g; } }
  function click(c, p, sr, f, g) { const n = Math.round(sr * 0.03); for (let i = 0; i < n && p + i < c.length; i++) if (p + i >= 0) c[p + i] += Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / (sr * 0.006)) * g; }
  // Puffer bauen: Schleife = Ausschnitt; Vorsingen – Pause – Nachsingen = Ausschnitt + gleich lange Pause mit Klicks (erster Klick hoch = „jetzt du“)
  function buffer(E, y) {
    const ctx = audioCtx, sr = E.sr, len = y.length, echo = mode === 'echo', tot = echo ? len * 2 : len;
    const l = new Float32Array(tot), r = new Float32Array(tot); l.set(y.l); r.set(y.r || y.l); fade(l.subarray(0, len), Math.round(sr * 0.006)); fade(r.subarray(0, len), Math.round(sr * 0.006));
    if (echo) { const bl = len / E.beats; for (let j = 0; j < E.beats; j++) { const p = len + Math.round(j * bl); click(l, p, sr, j ? 1600 : 2400, j ? 0.35 : 0.6); click(r, p, sr, j ? 1600 : 2400, j ? 0.35 : 0.6); } }
    const b = ctx.createBuffer(2, tot, sr); b.copyToChannel(l, 0); b.copyToChannel(r, 1); return { b, len, tot };
  }
  function stopPlay(quiet) {
    if (P) { try { P.node.onended = null; P.node.stop(); P.node.disconnect(); P.g.disconnect(); } catch (e) {} P = null; }
    preparing++; pend = ''; stopRaf(); if (!quiet) paintPlay();
  }
  async function play(kind) {
    const S = segs(), R = range(S); if (!R || typeof audioCtx === 'undefined' && typeof ensureAudio !== 'function') return false;
    stopPlay(true); mode = kind; const my = ++preparing; pend = kind;
    if (typeof Looper !== 'undefined' && Looper.running && Looper.running() && Looper.pauseToggle) Looper.pauseToggle();   // wie „Zeile üben“ im Mitsingen
    if (typeof ensureAudio === 'function') ensureAudio();
    const E = excerpt(S, R); if (!E) { say(TT('Diese Stelle lässt sich nicht abspielen.'), true); paintPlay(); return false; }
    const ck = [tr, S.src.id, R.b0, R.b1, rate, semi, E.vOk ? vox : 1].join('|');
    let y = cache.get(ck);
    if (!y) {
      if (rate !== 1 || semi) { paintPlay(TT('bereitet vor …')); }
      y = await process(E); if (my !== preparing) return false;
      if (typeof Looper !== 'undefined' && Looper.running && Looper.running()) { pend = ''; paintPlay(); return false; }   // Looper inzwischen gestartet
      cache.delete(ck); cache.set(ck, y); while (cache.size > 6) cache.delete(cache.keys().next().value);
    }
    const ctx = audioCtx, out = typeof ensureMasterBus === 'function' ? ensureMasterBus() : ctx.destination, B = buffer(E, y);
    const node = ctx.createBufferSource(), g = ctx.createGain(); node.buffer = B.b; node.loop = true; node.connect(g); g.connect(out);
    const t0 = ctx.currentTime + 0.05; node.start(t0); pend = '';
    P = { node, g, t0, len: B.len, tot: B.tot, kind, a: E.a, x: E.x, R, sr: E.sr, rate: E.x.length / B.len, ck, buf: B.b, vOk: E.vOk, xl: E.x.length };
    if (R0 && !R0.P) R0.P = { buf: B.b, t0, tot: B.tot };   // Aufnahme lief schon: Lied ab hier zum späteren „▶ Mit Lied“
    if (!E.vOk) say(TT('Gesang leiser geht hier nicht (Stelle außerhalb der getrennten Spur) – es läuft das Original.'));
    paintPlay(); startRaf(); return true;
  }
  const playing = () => !!P;
  function posOf() {   // { f: Bild in der Datei | null (Pause), you: Pause zum Nachsingen }
    if (!P) return null; const ctx = audioCtx, el = ctx.currentTime - P.t0 - (ctx.outputLatency || 0); if (el < 0) return { f: P.a, you: false };
    const p = (el * P.sr) % P.tot; if (p >= P.len) return { f: null, you: true };
    return { f: P.a + p * P.rate, you: false };
  }

  /* ---------- Aufnahme (Mikrofon erst nach Antippen; bleibt im Speicher) ---------- */
  let R0 = null, take = null, takeP = null;
  async function recStart() {
    if (R0) return;
    if (typeof Looper === 'undefined' || !Looper.openInput) return;
    say(TT('Kopfhörer auf – sonst nimmt das Mikrofon das Lied mit.'));
    let ok = false; try { ok = await Looper.openInput(); } catch (e) { ok = false; }
    const an = ok && Looper.inputAnalyser(); if (!an) { say(TT('Kein Zugriff aufs Mikrofon – in den Einstellungen erlauben.'), true); return; }
    const ctx = audioCtx, sp = ctx.createScriptProcessor(4096, 1, 1), z = ctx.createGain(); z.gain.value = 0;
    an.connect(sp); sp.connect(z); z.connect(ctx.destination);
    R0 = { sp, z, an, ch: [], n: 0, t0: null, max: ctx.sampleRate * 120, sr: ctx.sampleRate, P: P ? { buf: P.buf, t0: P.t0, tot: P.tot } : null };
    sp.onaudioprocess = e => {
      const R = R0; if (!R) return; const d = e.inputBuffer.getChannelData(0);
      if (R.t0 == null) R.t0 = e.playbackTime - 2 * d.length / R.sr;
      R.ch.push(new Float32Array(d)); R.n += d.length; if (R.n >= R.max) recStop();
    };
    paintRec();
  }
  function recStop(drop) {
    const R = R0; if (!R) return; R0 = null;
    try { R.sp.onaudioprocess = null; R.an.disconnect(R.sp); R.sp.disconnect(); R.z.disconnect(); } catch (e) {}
    try { Looper.releaseAnalyser(); } catch (e) {}
    if (!drop && R.n > R.sr * 0.5) {
      const l = new Float32Array(R.n); let o = 0; R.ch.forEach(c => { l.set(c, o); o += c.length; });
      take = { l, sr: R.sr, t0: R.t0, P: R.P, at: Date.now() };
      say(TT('Aufnahme fertig:') + ' ' + (Math.round(R.n / R.sr * 10) / 10).toString().replace('.', window.__lang === 'en' ? '.' : ',') + ' s');
    } else if (!drop) say(TT('Aufnahme zu kurz.'));
    paintRec();
  }
  function takeStop() { if (takeP) { takeP.forEach(n => { try { n.onended = null; n.stop(); n.disconnect(); } catch (e) {} }); takeP = null; } }
  function takePlay(withSong) {
    takeStop(); if (!take) return; stopPlay();
    if (typeof ensureAudio === 'function') ensureAudio();
    const ctx = audioCtx, out = typeof ensureMasterBus === 'function' ? ensureMasterBus() : ctx.destination, T0 = ctx.currentTime + 0.05;
    const lat = (typeof Looper !== 'undefined' && Looper.latencyMs ? Looper.latencyMs() : 0) / 1000, skip = Math.min(take.l.length - 1, Math.round(lat * take.sr));
    const b = ctx.createBuffer(1, take.l.length - skip, take.sr); b.copyToChannel(take.l.subarray(skip), 0);
    const v = ctx.createBufferSource(); v.buffer = b; v.connect(out); v.start(T0); takeP = [v];
    v.onended = () => { takeStop(); paintRec(); };
    if (withSong && take.P && take.t0 != null) {   // Lied an der Stelle, an der die Aufnahme begann (ungefähr, Latenz aus dem Looper)
      const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 0.6; s.buffer = take.P.buf; s.loop = true; s.connect(g); g.connect(out);
      const off = (((take.t0 - take.P.t0) * take.sr) % take.P.tot + take.P.tot) % take.P.tot;
      s.start(T0, off / take.sr); s.stop(T0 + b.duration); takeP.push(s);
    }
    paintRec();
  }
  async function takeSave() {
    if (!take || typeof AppDB === 'undefined' || !window.Sep) return;
    try {
      const now = new Date(), p = curPiece(), bpm = parseFloat(($('bpm') || {}).value) || 0;
      await AppDB.put('ideas', { v: 2, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), ts: now.getTime(), dateStr: now.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        name: TT('Mitsingen') + ' · ' + (p && p.k !== '_' ? p.n : TT('Aufnahme')), root: ($('root') || {}).value, mode: ($('mode') || {}).value, bpm, secs: take.l.length / take.sr, cat: 'idee', wav: Sep.wav({ l: take.l }, take.sr) });
      document.dispatchEvent(new CustomEvent('ideas-refresh'));
      say(TT('Als Idee gesichert (Looper › Ideen).'));
    } catch (e) { say(TT('Konnte nicht speichern – Speicher voll oder privates Surfen.'), true); }
  }

  /* ---------- Anzeige ---------- */
  function say(t, warn) { const m = $('mslMsg'); if (!m) return; m.textContent = t || ''; m.classList.toggle('warn', !!warn); }
  const fmtT = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function keyOf(p) {   // { r, mi, txt } aus dem Songbook-Stück, sonst null
    const s = p && p.sb; if (!s || s.r == null) return null;
    const mi = /Moll|Äolisch|Dorisch|Phrygisch|Lokrisch/.test(s.m || ''), dur = /Dur|Ionisch|Lydisch|Mixolydisch/.test(s.m || '');
    return { r: md(+s.r), mi, txt: NN[md(+s.r)] + (mi || dur ? ' ' + TT(mi ? 'Moll' : 'Dur') : '') };
  }
  // Baustein Fahrplan-Karte (auch für v165): Kopf, Auswahl, Zeilen, Wege, Fuß
  function planCard() {
    return '<div class="card msl-plan"><div class="card-head msl-head"><h2>' + esc(TT('Mitsingen lernen')) + '</h2><span class="caption" id="mslCnt"></span></div>'
      + '<label class="msl-pc"><span class="caption">' + esc(TT('Stück')) + '</span><select id="mslPiece" aria-label="' + esc(TT('Stück wählen')) + '"></select></label>'
      + '<p class="caption msl-meta" id="mslMeta"></p>'
      + '<div class="msl-new" id="mslNew" hidden><input type="text" id="mslNewN" maxlength="60" placeholder="' + esc(TT('Name des Stücks')) + '" aria-label="' + esc(TT('Name des Stücks')) + '">'
      + '<button type="button" class="toggle-btn" id="mslNewOk">' + esc(TT('Anlegen')) + '</button><button type="button" class="toggle-btn" id="mslNewX">' + esc(TT('Abbrechen')) + '</button></div>'
      + '<div class="msl-rows" id="mslL" role="list"></div>'
      + '<div class="msl-ways" role="group" aria-label="' + esc(TT('Weg')) + '">' + Object.keys(WAYS).map(k => '<button type="button" class="toggle-btn" data-w="' + k + '">' + esc(TT(WAYS[k].n)) + '</button>').join('') + '</div>'
      + '<p class="caption msl-wayd" id="mslWayD"></p><div class="msl-uz" id="mslUz"></div></div>';
  }
  function stepCard() {
    return '<div class="card msl-step" id="mslS"><div class="card-head msl-head"><h2 id="mslH"></h2><span class="caption msl-min" id="mslMin"></span></div>'
      + '<p class="msl-so" id="mslSo"></p><p class="caption msl-why" id="mslWhy"></p><div id="mslX"></div>'
      + '<div class="msl-box" id="mslBox">' + boxHtml() + '</div>'
      + '<div class="msl-nofile" id="mslNo" hidden></div>'
      + '<p class="caption msl-msg" id="mslMsg" role="status"></p>'
      + '<div class="msl-foot"><button type="button" class="toggle-btn msl-done" id="mslDone"></button><button type="button" class="toggle-btn" id="mslTipsB" aria-expanded="false" aria-controls="mslTips">' + esc(TT('Tipps zu diesem Schritt')) + '</button>'
      + '<button type="button" class="toggle-btn msl-nx" id="mslNext"></button></div><div class="msl-tips" id="mslTips" hidden></div></div>';
  }
  function boxHtml() {
    return '<div class="msl-top"><span id="mslPos"></span><span id="mslTime"></span></div>'
      + '<div class="msl-wave" id="mslWave"><canvas id="mslWv" height="54" aria-hidden="true"></canvas><i class="msl-hl" id="mslHl"></i><i class="msl-cur" id="mslCur"></i></div>'
      + '<div class="msl-line" id="mslLine" translate="no"></div><div class="msl-nextl" id="mslNextL" translate="no"></div><div class="msl-phase" id="mslPhase"></div>'
      + '<div class="msl-btns"><button type="button" class="toggle-btn msl-play" id="mslPlay"></button><button type="button" class="toggle-btn" id="mslPrev"></button><button type="button" class="toggle-btn" id="mslNx"></button>'
      + '<button type="button" class="toggle-btn" id="mslEcho">' + esc(TT('Vorsingen – Pause – Nachsingen')) + '</button></div>'
      + '<div class="msl-span"><span class="caption" id="mslSpanL"></span>' + [1, 2, 4].map(n => '<button type="button" class="toggle-btn" data-span="' + n + '">' + n + '</button>').join('')
      + '<button type="button" class="toggle-btn msl-mark" id="mslMark">' + esc(TT('★ Stelle merken')) + '</button><button type="button" class="toggle-btn msl-rec" id="mslRec"></button><select id="mslTr" aria-label="' + esc(TT('Spur')) + '" hidden></select></div>'
      + '<div class="msl-kgrid">'
      + '<div class="msl-k"><b id="mslRateV"></b><span>' + esc(TT('Tempo (Tonhöhe bleibt)')) + '</span><div class="msl-seg" id="mslRate">' + RATES.map(r => '<button type="button" class="toggle-btn" data-r="' + r + '">' + Math.round(r * 100) + '</button>').join('') + '</div></div>'
      + '<div class="msl-k"><b id="mslVoxV"></b><span>' + esc(TT('Gesang im Lied: laut ↔ Karaoke')) + '</span><div class="msl-seg" id="mslVox">' + VOX.map(v => '<button type="button" class="toggle-btn" data-v="' + v[0] + '">' + esc(TT(v[1])) + '</button>').join('') + '</div>'
      + '<button type="button" class="toggle-btn msl-sep" id="mslSep" hidden>' + esc(TT('Gesang trennen …')) + '</button></div>'
      + '<div class="msl-k"><b id="mslSemiV"></b><span>' + esc(TT('Tonart für deine Stimme')) + '</span><div class="msl-seg"><button type="button" class="toggle-btn" id="mslSemiD" aria-label="' + esc(TT('Halbton tiefer')) + '">−</button><button type="button" class="toggle-btn" id="mslSemi0">0</button><button type="button" class="toggle-btn" id="mslSemiU" aria-label="' + esc(TT('Halbton höher')) + '">+</button></div></div>'
      + '</div><div class="msl-pre" id="mslPre"></div>'
      + '<div class="msl-take" id="mslTake" hidden><span class="caption" id="mslTakeI"></span><button type="button" class="toggle-btn" id="mslTakeP">' + esc(TT('▶ Anhören')) + '</button><button type="button" class="toggle-btn" id="mslTakeS">' + esc(TT('▶ Mit Lied')) + '</button>'
      + '<button type="button" class="toggle-btn" id="mslTakeI2">' + esc(TT('Als Idee sichern')) + '</button><button type="button" class="toggle-btn" id="mslTakeX">' + esc(TT('Verwerfen')) + '</button></div>'
      + '<div class="msl-marks" id="mslMarks"></div>';
  }
  function build() {
    const r = $('mslRoot'); if (!r) return;
    if (!built) {
      r.innerHTML = '<div class="msl-wrap">' + planCard() + stepCard() + '</div>';
      r.addEventListener('click', onClick);
      $('mslPiece').addEventListener('change', onPiece);
      $('mslTr').addEventListener('change', () => { tr = +$('mslTr').value; k0 = 0; stopPlay(); paintBox(); });
      $('mslNewN').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); newPiece(); } });
      built = true;
    }
    const p = curPiece(), pr = rec(p.k); sel = pr && pr.s ? pr.s : (way().s.find(n => !(pr && pr.d.includes(n))) || way().s[0]);
    paint();
  }
  function paint() { paintPlan(); paintStep(); paintBox(); paintUz(); }
  function paintPlan() {
    const p = curPiece(), pr = rec(p.k), done = pr ? pr.d : [], W = way();
    const ps = pieces(), s = $('mslPiece'), groups = {};
    ps.forEach(x => { (groups[x.g] = groups[x.g] || []).push(x); });
    const opt = x => '<option value="' + esc(x.k) + '"' + (x.k === p.k ? ' selected' : '') + '>' + esc(x.n) + '</option>';
    const html = Object.keys(groups).map(g => g ? '<optgroup label="' + esc(g) + '">' + groups[g].map(opt).join('') + '</optgroup>' : groups[g].map(opt).join('')).join('') + '<option value="+">' + esc(TT('＋ Eigenes Stück …')) + '</option>';
    if (s.dataset.h !== html) { s.innerHTML = html; s.dataset.h = html; }
    s.value = p.k;
    const K = keyOf(p), sb = p.sb;
    $('mslMeta').textContent = sb ? [K ? K.txt : '', sb.b ? sb.b + ' BPM' : ''].filter(Boolean).join(' · ') : p.tr != null ? TT('Datei auf Spur') + ' ' + (p.tr + 1) : '';
    $('mslCnt').textContent = W.s.filter(n => done.includes(n)).length + ' ' + TT('von') + ' ' + W.s.length;
    $('mslL').innerHTML = STEPS.map((S, i) => {
      const n = i + 1, ok = done.includes(n), inW = W.s.includes(n);
      return '<button type="button" role="listitem" class="msl-r' + (ok ? ' ok' : '') + (n === sel ? ' on' : '') + (inW ? '' : ' off') + '" data-s="' + n + '" aria-current="' + (n === sel ? 'step' : 'false') + '">'
        + '<i aria-hidden="true">' + (ok ? '✓' : n) + '</i><span><b>' + esc(TT(S.t)) + '</b><small>' + esc(TT(S.c)) + '</small></span>' + (ok ? '<em class="sr">' + esc(TT('geschafft')) + '</em>' : '') + '</button>';
    }).join('');
    document.querySelectorAll('#mslRoot .msl-ways [data-w]').forEach(b => { const on = b.dataset.w === D.w; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    $('mslWayD').textContent = TT(W.d);
  }
  function paintStep() {
    const S = STEPS[sel - 1], p = curPiece(), pr = rec(p.k), ok = !!(pr && pr.d.includes(sel)), W = way();
    $('mslH').textContent = TT('Schritt') + ' ' + sel + ' · ' + TT(S.t);
    $('mslMin').textContent = TT(S.min);
    $('mslSo').innerHTML = '<b>' + esc(TT('So geht’s:')) + '</b> ' + esc(TT(S.so));
    $('mslWhy').textContent = TT('Warum:') + ' ' + TT(S.why);
    const d = $('mslDone'); d.textContent = ok ? TT('✓ Geschafft – zurücknehmen') : TT('✓ Schritt geschafft'); d.classList.toggle('active', ok); d.setAttribute('aria-pressed', String(ok));
    const i = W.s.indexOf(sel), nx = i >= 0 ? W.s[i + 1] : W.s.find(n => n > sel);
    const nb = $('mslNext'); nb.hidden = !nx; nb.dataset.s = nx || ''; nb.textContent = TT('Nächster Schritt ›');
    $('mslTips').innerHTML = '<b>' + esc(TT('Typische Fehler')) + '</b><ul>' + S.err.map(e => '<li>' + esc(TT(e)) + '</li>').join('') + '</ul><b>' + esc(TT('Woran merke ich, dass es sitzt?')) + '</b><p>' + esc(TT(S.ok)) + '</p>'
      + '<p class="caption">' + esc(TT('Allgemein: lieber täglich 15–20 Minuten als einmal eine Stunde. Je Durchgang nur auf eine Sache achten.')) + '</p>';
    paintX();
  }
  function chordLine(l) { const w = l.trim().split(/\s+/).filter(Boolean); return w.length > 0 && w.every(x => /^(\||-|\/|\(?x\d+\)?|[A-H](#|b)?(m|maj|min|dim|aug|sus|add)?\d*(\/[A-H](#|b)?)?)$/.test(x)); }
  function paintX() {
    const S = STEPS[sel - 1], p = curPiece(), el = $('mslX'); let h = '';
    if (S.x === 'key') {
      const K = keyOf(p), sh = semi, nk = K ? NN[md(K.r + sh)] + (K.mi ? ' ' + TT('Moll') : '') : '';
      const ex = K ? ' (' + TT('z. B.') + ' ' + NN[K.r] + (K.mi ? 'm' : '') + ' → ' + NN[md(K.r + sh)] + (K.mi ? 'm' : '') + ')' : '';
      const t = !sh ? TT(fileTracks().length ? 'Originaltonart – mit „−“/„+“ bei „Tonart für deine Stimme“ ausprobieren, was bequemer liegt.' : 'Ohne Datei: zur Gitarre in der Originaltonart singen, dann einen Bund höher oder tiefer probieren – was bequemer liegt, gilt.')
        : sh > 0 ? TT('Höher: Kapodaster in Bund {n}, Griffe wie bisher.').replace('{n}', sh)
          : TT('Tiefer: alle Griffe um {n} Halbtöne tiefer greifen{x} – oder, wenn du schon mit Kapodaster spielst, ihn {n} Bünde tiefer setzen.').replace(/\{n\}/g, -sh).replace('{x}', ex);
      h = '<div class="msl-xbox"><div class="msl-xk"><b>' + esc(TT('Tonart')) + (K ? ': ' + esc(K.txt) + (sh ? ' → ' + esc(nk) : '') : '') + '</b><span class="msl-seg"><button type="button" class="toggle-btn" id="mslKeyD" aria-label="' + esc(TT('Halbton tiefer')) + '"' + (sh <= -5 ? ' disabled' : '') + '>−</button><button type="button" class="toggle-btn" id="mslKey0">' + (sh ? (sh > 0 ? '+' : '−') + Math.abs(sh) : '0') + '</button><button type="button" class="toggle-btn" id="mslKeyU" aria-label="' + esc(TT('Halbton höher')) + '"' + (sh >= 5 ? ' disabled' : '') + '>+</button></span></div><p>' + esc(t) + '</p>'
        + (K ? '' : '<p class="caption">' + esc(TT('Stück aus dem Songbook wählen, dann steht hier die Tonart. Die Tonart-Empfehlung für deine Stimmlage gibt es auch in „Songwriting“.')) + '</p>') + '</div>';
    } else if (S.x === 'text' || S.x === 'chords') {
      const G = tr >= 0 ? segs() : null, lines = G && G.u === 'l' ? G.list.map(x => x.txt) : null;
      const sbx = p.sb && p.sb.x ? String(p.sb.x).split('\n') : null;
      const body = S.x === 'text' ? (lines || (sbx ? sbx.filter(l => !chordLine(l)) : null)) : (sbx || lines);
      h = body && body.join('').trim() ? '<div class="msl-xbox"><b>' + esc(TT(S.x === 'text' ? 'Text' : 'Akkorde & Text')) + '</b><pre class="msl-text' + (S.x === 'chords' && sbx ? ' mono' : '') + '" translate="no">' + esc(body.join('\n').replace(/\n{3,}/g, '\n\n').trim()) + '</pre></div>'
        : '<div class="msl-xbox"><p class="caption">' + esc(TT('Kein Text da: im Songbook beim Stück unter „Akkorde & Text“ eintragen oder in „Mitsingen“ erkennen lassen – oder vom Blatt lesen.')) + '</p></div>';
    }
    el.innerHTML = h;
  }
  function paintBox() {
    tr = pickTrack();
    const S = tr >= 0 ? segs() : null, box = $('mslBox'), no = $('mslNo');
    const has = !!(S && S.list.length);
    box.hidden = !has; no.hidden = has;
    if (!has) {
      no.innerHTML = '<b>' + esc(TT('Ohne Musikdatei')) + '</b><p>' + esc(TT('Der Fahrplan funktioniert auch so – als Checkliste, auch für eigene Stücke. Zum Üben mit dem Lied: Datei im Looper laden (♫ auf Spur 1), dann hierher zurückkommen – Zeile in Schleife, langsamer, Vorsingen und Nachsingen, Aufnehmen.')) + '</p>'
        + '<div class="msl-btns"><button type="button" class="toggle-btn" id="mslLoad">' + esc(TT('♫ Lied im Looper laden')) + '</button><button type="button" class="toggle-btn" id="mslToSing">' + esc(TT('Text erkennen („Mitsingen“)')) + '</button></div>';
      info = null; paintTake(); return;
    }
    const ts = fileTracks(), ts0 = $('mslTr');
    ts0.hidden = ts.length < 2;
    const th = ts.map(i => '<option value="' + i + '"' + (i === tr ? ' selected' : '') + '>' + esc(TT('Spur') + ' ' + (i + 1)) + '</option>').join('');
    if (ts0.dataset.h !== th) { ts0.innerHTML = th; ts0.dataset.h = th; } ts0.value = String(tr);
    const R = range(S), u = S.u === 'l';
    info = { S, R };
    $('mslPos').textContent = (u ? (R.n > 1 ? TT('Zeilen') + ' ' + (R.k + 1) + '–' + (R.k + R.n) : TT('Zeile') + ' ' + (R.k + 1)) : (R.n > 1 ? TT('Takte') + ' ' + (R.k + 1) + '–' + (R.k + R.n) : TT('Takt') + ' ' + (R.k + 1))) + ' ' + TT('von') + ' ' + R.of;
    const B = S.src.beats, sr = S.src.sr, f0 = Sing.b2f(R.b0, B), f1 = Sing.b2f(R.b1, B);
    $('mslTime').textContent = fmtT(f0 / sr) + ' – ' + fmtT(f1 / sr);
    $('mslPlay').textContent = P && P.kind === 'loop' ? '■ ' + TT('Stopp') : u ? TT('▶ Zeile in Schleife') : TT('▶ Abschnitt in Schleife');
    $('mslPrev').textContent = u ? TT('‹ Zeile') : TT('‹ Takte'); $('mslNx').textContent = u ? TT('Zeile ›') : TT('Takte ›');
    $('mslPrev').disabled = R.k <= 0; $('mslNx').disabled = R.k + 1 >= R.of;
    $('mslSpanL').textContent = TT(u ? 'Zeilen:' : 'Takte:');
    document.querySelectorAll('#mslRoot [data-span]').forEach(b => { const on = +b.dataset.span === span; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    paintLine(null); paintWave(); paintKnobs(); paintPlay(); paintMarks(); paintRec();
    if (!u) say(TT('Ohne erkannten Text: Abschnitte nach Takten. Text erkennen: Song & Gesang › „Mitsingen“.'));
  }
  function paintLine(nowB) {
    if (!info) return; const { S, R } = info, el = $('mslLine'), nx = $('mslNextL');
    if (S.u !== 'l') { el.textContent = TT('Takt') + ' ' + (R.k + 1) + (R.n > 1 ? '–' + (R.k + R.n) : ''); nx.textContent = TT('Summen, „na“ oder Text – ganz wie der Schritt es sagt.'); return; }
    let li = R.k; if (nowB != null) for (let j = R.k; j < R.k + R.n; j++) if (S.list[j].b0 <= nowB + 0.05) li = j;
    const L = S.list[li], sig = li + '|' + (nowB == null ? -1 : L.w.findIndex(w => nowB >= w.b && nowB < w.e));
    if (el.dataset.sig === sig) return; el.dataset.sig = sig;
    const wi = nowB == null ? -1 : L.w.findIndex(w => nowB >= w.b && nowB < w.e);
    el.innerHTML = L.w.map((w, j) => j === wi ? '<span class="msl-now">' + esc(w.w) + '</span>' : esc(w.w)).join(' ');
    const N = S.list[li + 1]; nx.textContent = N ? TT('danach:') + ' ' + N.txt : '';
  }
  function paintWave() {
    if (!info) return; const cv = $('mslWv'), wrap = $('mslWave'); if (!cv || !wrap) return;
    const { S, R } = info, B = S.src.beats, bA = Math.floor(R.b0 + 1e-6) - 1, bB = Math.ceil(R.b1 - 1e-6);
    const fA = Math.max(0, Math.floor(Sing.b2f(bA, B))), fB = Math.ceil(Sing.b2f(bB, B)), x = Looper.singAudio(tr, fA, fB);
    const W = Math.max(200, Math.min(1200, Math.round((wrap.clientWidth || 600) * Math.min(2, window.devicePixelRatio || 1)))), H = 54 * 2;
    cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.clearRect(0, 0, W, H);
    info.fA = fA; info.fB = fB;
    if (x) {
      c.fillStyle = getComputedStyle(wrap).color || '#ccc'; c.globalAlpha = 0.55;
      const n = x.length, st = Math.max(1, Math.floor(n / W / 32));
      for (let px = 0; px < W; px++) { let mx = 0; const a = Math.floor(px * n / W), e = Math.floor((px + 1) * n / W); for (let i = a; i < e; i += st) { const v = Math.abs(x.l[i]); if (v > mx) mx = v; } const h = Math.max(1, Math.min(1, mx * 1.6) * H * 0.9); c.fillRect(px, (H - h) / 2, 1, h); }
    }
    const f0 = Sing.b2f(R.b0, B), f1 = Sing.b2f(R.b1, B), hl = $('mslHl'), span0 = fB - fA || 1;
    hl.style.left = (Math.max(0, (f0 - fA) / span0) * 100).toFixed(2) + '%'; hl.style.width = (Math.max(0.5, (f1 - f0) / span0 * 100)).toFixed(2) + '%';
    $('mslCur').style.transform = 'translateX(-10px)';
  }
  function paintKnobs() {
    const pct = Math.round(rate * 100);
    $('mslRateV').textContent = pct + ' %';
    document.querySelectorAll('#mslRate [data-r]').forEach(b => { const on = +b.dataset.r === rate; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    const k = tr >= 0 && Looper.kara ? Looper.kara(tr) : null, sepOk = !!k;
    $('mslVox').hidden = !sepOk; $('mslSep').hidden = sepOk;
    if (!sepOk && vox !== 1) vox = 1;
    $('mslVoxV').textContent = !sepOk ? TT('Original') : vox === 1 ? TT('Original 100 %') : vox ? TT('leise') + ' ' + Math.round(vox * 100) + ' %' : TT('Karaoke');
    document.querySelectorAll('#mslVox [data-v]').forEach(b => { const on = +b.dataset.v === vox; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    $('mslSemiV').textContent = semi ? (semi > 0 ? '+' : '−') + Math.abs(semi) + ' ' + TT(Math.abs(semi) === 1 ? 'Halbton' : 'Halbtöne') : TT('Originaltonart');
    $('mslSemiD').disabled = semi <= -5; $('mslSemiU').disabled = semi >= 5;
    const S = STEPS[sel - 1], pr = S.pre;
    $('mslPre').innerHTML = pr ? '<span class="caption">' + esc(TT('Für diesen Schritt:')) + ' ' + Math.round(pr.r * 100) + ' % · ' + esc(TT(pr.m === 'echo' ? 'Vorsingen – Pause – Nachsingen' : 'Schleife')) + ' · ' + esc(TT('Gesang')) + ' ' + esc(TT(pr.v === 1 ? 'laut' : pr.v ? 'leise' : 'aus'))
      + (pr.v < 1 && !sepOk ? ' ' + esc(TT('(erst nach „Gesang trennen“)')) : '') + '</span> <button type="button" class="toggle-btn msl-sm" id="mslPreGo">' + esc(TT('So einstellen')) + '</button>' : '';
  }
  function paintPlay(msg) {
    const pl = $('mslPlay'), ec = $('mslEcho'); if (!pl || !info) return;
    const u = info.S.u === 'l', lp = !!(P && P.kind === 'loop') || pend === 'loop', eo = !!(P && P.kind === 'echo') || pend === 'echo';
    pl.textContent = lp ? '■ ' + TT('Stopp') : u ? TT('▶ Zeile in Schleife') : TT('▶ Abschnitt in Schleife');
    pl.classList.toggle('active', lp); pl.setAttribute('aria-pressed', String(lp));
    ec.textContent = eo ? '■ ' + TT('Stopp') : TT('Vorsingen – Pause – Nachsingen'); ec.classList.toggle('active', eo); ec.setAttribute('aria-pressed', String(eo));
    $('mslPhase').textContent = msg || (P ? (P.kind === 'echo' ? TT('Hören …') : '') : '');
    $('mslPhase').classList.remove('you');
    if (!P) { paintLine(null); $('mslCur').style.transform = 'translateX(-10px)'; }
  }
  function paintRec() {
    const b = $('mslRec'); if (!b) return;
    b.textContent = R0 ? '■ ' + TT('Aufnahme stoppen') : TT('● Aufnehmen'); b.classList.toggle('on', !!R0); b.setAttribute('aria-pressed', String(!!R0));
    paintTake();
  }
  function paintTake() {
    const t = $('mslTake'); if (!t) return;
    t.hidden = !take; if (!take) return;
    $('mslTakeI').textContent = TT('Deine Aufnahme') + ' · ' + (Math.round(take.l.length / take.sr * 10) / 10).toString().replace('.', window.__lang === 'en' ? '.' : ',') + ' s';
    $('mslTakeS').hidden = !take.P;
    $('mslTakeP').textContent = takeP ? '■ ' + TT('Stopp') : TT('▶ Anhören');
  }
  function paintMarks() {
    const el = $('mslMarks'); if (!el || !info) return;
    const p = curPiece(), pr = rec(p.k), fk = info.S.src.id, l = pr ? pr.h.filter(h => h[0] === fk) : [];
    el.innerHTML = l.length ? '<span class="caption">' + esc(TT('Schwierige Stellen:')) + '</span>' + l.map((h, i) => '<span class="msl-mk"><button type="button" class="toggle-btn" data-mk="' + i + '">' + esc(h[4] || ((h[1] === 'l' ? TT('Zeile') : TT('Takt')) + ' ' + (h[2] + 1))) + '</button><button type="button" class="toggle-btn msl-mkx" data-mkx="' + i + '" aria-label="' + esc(TT('Stelle entfernen')) + '">×</button></span>').join('') : '';
  }
  function paintUz() {
    const el = $('mslUz'); if (!el) return;
    if (!window.Uebezeit) { el.innerHTML = ''; return; }
    const d = Uebezeit.load(), p = curPiece(), th = p.sb ? 'sb' + p.sb.id : null; let g = 0, s = 0;
    d.u.forEach(u => { if (u[3] === 'ges') g += u[1]; if (th && u[3] === th) s += u[1]; });
    el.innerHTML = '<span class="caption">' + esc(TT('Übezeit (nur Anzeige):')) + ' ' + esc(TT('Gesang')) + ' ' + esc(Uebezeit.fmtHM(g)) + (th ? ' · ' + esc(TT('dieses Stück')) + ' ' + esc(Uebezeit.fmtHM(s)) : '') + '</span>'
      + (d.run ? '<span class="msl-uzon">● ' + esc(TT('Übezeit läuft – zählt über „Üben“')) + '</span>' : '<button type="button" class="toggle-btn msl-sm" id="mslUzOn">' + esc(TT('Üben einschalten')) + '</button>')
      + '<span class="caption msl-uzn">' + esc(TT('Diese Seite zählt selbst keine Zeit.')) + '</span>';
  }

  /* ---------- Mitlaufen (nur bei offener Seite und laufender Wiedergabe; „Minimal“: 4× je Sekunde, ohne Zeiger) ---------- */
  let raf = 0, tmo = 0, lastPh = '';
  function startRaf() { stopRaf(); if (isMin()) tmo = setTimeout(tick, 250); else raf = requestAnimationFrame(tick); }
  function stopRaf() { if (raf) cancelAnimationFrame(raf); if (tmo) clearTimeout(tmo); raf = tmo = 0; lastPh = ''; }
  function tick() {
    raf = tmo = 0; if (!P || !info) return;
    const q = posOf(), S = info.S;
    if (q) {
      const ph = q.you ? 'you' : 'hear';
      if (P.kind === 'echo' && ph !== lastPh) { lastPh = ph; const e = $('mslPhase'); e.textContent = q.you ? TT('Jetzt du – nachsingen!') : TT('Hören …'); e.classList.toggle('you', q.you); }
      const cur = $('mslCur');
      if (q.f != null) {
        paintLine(Sing.f2b(q.f, S.src.beats));
        if (!isMin() && info.fB > info.fA) { const w = $('mslWave').clientWidth; cur.style.transform = 'translateX(' + Math.round((q.f - info.fA) / (info.fB - info.fA) * w) + 'px)'; }
      } else { paintLine(null); cur.style.transform = 'translateX(-10px)'; }
    }
    if (isMin()) tmo = setTimeout(tick, 250); else raf = requestAnimationFrame(tick);
  }

  /* ---------- Bedienung ---------- */
  function setDone(n, on) {
    const p = curPiece(), pr = rec(p.k, true), i = pr.d.indexOf(n);
    if (on && i < 0) pr.d.push(n); if (!on && i >= 0) pr.d.splice(i, 1);
    pr.d.sort((a, b) => a - b); pr.e = Date.now(); D.cur = p.k; store();
  }
  function go(n) { sel = Math.max(1, Math.min(8, n)); const p = curPiece(), pr = rec(p.k); if (pr) { pr.s = sel; store(); } paintPlan(); paintStep(); paintKnobs(); }
  function move(d) { if (!info) return; const k = k0 + d * 1; if (k < 0 || k >= info.S.list.length) return; k0 = k; const was = P && P.kind; paintBox(); if (was) play(was); }
  function restart() { if (P) play(P.kind); else if (pend) play(pend); }
  function onPiece() {
    const v = $('mslPiece').value;
    if (v === '+') { $('mslNew').hidden = false; $('mslPiece').value = curPiece().k; $('mslNewN').focus(); return; }
    D.cur = v; store(); k0 = 0; stopPlay(); const pr = rec(v); sel = pr && pr.s ? pr.s : way().s[0]; paint();
  }
  function newPiece() {
    const n = $('mslNewN').value.trim(); if (!n) { $('mslNewN').focus(); return; }
    const k = 'o:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    D.p[k] = { n, d: [], s: 0, h: [], e: Date.now() }; D.cur = k; store();
    $('mslNewN').value = ''; $('mslNew').hidden = true; sel = way().s[0]; paint();
  }
  async function onClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const id = b.id;
    if (b.dataset.s && b.classList.contains('msl-r')) { go(+b.dataset.s); return; }
    if (b.dataset.w) { D.w = b.dataset.w; store(); paintPlan(); paintStep(); return; }
    if (b.dataset.span) { span = +b.dataset.span; paintBox(); restart(); return; }
    if (b.dataset.r) { rate = +b.dataset.r; paintKnobs(); restart(); return; }
    if (b.dataset.v != null && b.closest('#mslVox')) { vox = +b.dataset.v; paintKnobs(); restart(); return; }
    if (b.dataset.mk != null) { const h = markList()[+b.dataset.mk]; if (h) { span = h[3]; k0 = h[2]; paintBox(); play(P ? P.kind : 'loop'); } return; }
    if (b.dataset.mkx != null) { const p = curPiece(), pr = rec(p.k), h = markList()[+b.dataset.mkx]; if (pr && h) { pr.h.splice(pr.h.indexOf(h), 1); store(); paintMarks(); } return; }
    switch (id) {
      case 'mslDone': { const p = curPiece(), pr = rec(p.k), on = !(pr && pr.d.includes(sel)); setDone(sel, on); paintPlan(); paintStep(); if (on) say(TT('Abgehakt.')); return; }
      case 'mslNext': if (b.dataset.s) go(+b.dataset.s); return;
      case 'mslTipsB': { const t = $('mslTips'), o = t.hidden; t.hidden = !o; b.setAttribute('aria-expanded', String(o)); b.classList.toggle('active', o); return; }
      case 'mslNewOk': newPiece(); return;
      case 'mslNewX': $('mslNew').hidden = true; return;
      case 'mslPlay': if ((P && P.kind === 'loop') || pend === 'loop') stopPlay(); else await play('loop'); return;
      case 'mslEcho': if ((P && P.kind === 'echo') || pend === 'echo') stopPlay(); else await play('echo'); return;
      case 'mslPrev': move(-1); return;
      case 'mslNx': move(1); return;
      case 'mslRec': if (R0) recStop(); else await recStart(); return;
      case 'mslTakeP': if (takeP) { takeStop(); paintTake(); } else takePlay(false); return;
      case 'mslTakeS': takePlay(true); return;
      case 'mslTakeI2': await takeSave(); return;
      case 'mslTakeX': takeStop(); take = null; paintTake(); say(TT('Aufnahme verworfen.')); return;
      case 'mslMark': {
        if (!info) return; const p = curPiece(), pr = rec(p.k, true), R = info.R, S = info.S, fk = S.src.id;
        const lab = S.u === 'l' ? S.list[R.k].txt.split(' ').slice(0, 4).join(' ') + (S.list[R.k].w.length > 4 ? ' …' : '') : TT('Takt') + ' ' + (R.k + 1) + (R.n > 1 ? '–' + (R.k + R.n) : '');
        if (!pr.h.some(h => h[0] === fk && h[2] === R.k && h[3] === span)) { pr.h.push([fk, S.u, R.k, span, lab]); if (pr.h.length > 40) pr.h.shift(); pr.e = Date.now(); D.cur = p.k; store(); }
        paintMarks(); say(TT('Stelle gemerkt – antippen springt dorthin.')); return;
      }
      case 'mslSemiD': case 'mslSemiU': case 'mslSemi0': case 'mslKeyD': case 'mslKeyU': case 'mslKey0': semi = /0$/.test(id) ? 0 : Math.max(-5, Math.min(5, semi + (/U$/.test(id) ? 1 : -1))); paintKnobs(); paintX(); restart(); return;
      case 'mslSep': {
        if (tr < 0 || !Looper.sepTrack) return; stopPlay(); b.disabled = true; say(TT('Gesang wird getrennt … (beim ersten Mal mit Rückfrage zum Download, ca. 79 MB)'));
        try { const r = await Looper.sepTrack(tr, { vocTrack: false }); say(r ? TT('Gesang getrennt – jetzt „leise“ oder „aus“ wählen.') : TT('Gesang trennen abgebrochen.')); }
        catch (err) { say(TT('Gesang trennen ging nicht.'), true); }
        b.disabled = false; cache.clear(); paintKnobs(); return;
      }
      case 'mslPreGo': { const pr = STEPS[sel - 1].pre; if (!pr) return; rate = pr.r; const k = tr >= 0 && Looper.kara ? Looper.kara(tr) : null; vox = k ? pr.v : 1; paintKnobs(); await play(pr.m); return; }
      case 'mslUzOn': if (window.Uebezeit) { const d = Uebezeit.load(); if (!d.run) { const p = curPiece(), th = p.sb ? 'sb' + p.sb.id : ''; const t = jget(TKEY, null); Uebezeit.setTopic(th && t && Array.isArray(t.c) && t.c.some(x => x[0] === th) ? th : 'ges'); Uebezeit.on(); } } paintUz(); return;
      case 'mslLoad': { if (window.AppNav) AppNav.show('looper'); const f = $('file0'); if (f) f.click(); return; }
      case 'mslToSing': if (window.AppNav) AppNav.show('singen'); return;
    }
  }
  function markList() { if (!info) return []; const p = curPiece(), pr = rec(p.k); return pr ? pr.h.filter(h => h[0] === info.S.src.id) : []; }
  function stopAll() { stopPlay(true); recStop(); takeStop(); if (worker) { try { worker.terminate(); } catch (e) {} worker = null; Object.keys(wWait).forEach(k => { const w = wWait[k]; delete wWait[k]; w({ err: 'stop' }); }); } paintRec(); paintPlay(); }
  // Fußpedal (v159-Muster): nur bei offener Seite
  function pedal(n) {
    if (!built || !window.AppNav || AppNav.current() !== 'singlernen') return;
    if (n === 'go') { if (P || pend) stopPlay(); else play('loop'); } else if (n === 'next') move(1); else if (n === 'prev') move(-1);
  }
  function open() { build(); }
  document.addEventListener('tabchange', e => { if (e.detail !== 'singlernen') { if (built) stopAll(); } else if (built) { D = load(); paint(); } });
  document.addEventListener('looperrun', e => { if (e.detail && (P || pend)) { stopPlay(); say(TT('Der Looper läuft – Wiedergabe hier angehalten.')); } });
  document.addEventListener('karaoke', () => { if (built && info) { cache.clear(); paintKnobs(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && built) stopAll(); });
  return { open, built: () => built, pedal, load, STEPS, WAYS, _st: () => ({ sel, tr, k0, span, rate, semi, vox, playing: playing(), pend, kind: P && P.kind, rec: !!R0, take: take ? take.l.length : 0, pos: posOf(), len: P && P.len, tot: P && P.tot, xl: P && P.xl, vOk: P && P.vOk, R: info && info.R, u: info && info.S.u, n: info && info.S.list.length, worker: !!worker }), _shift: (x, n, f) => shift(x, n, f) };
})();
