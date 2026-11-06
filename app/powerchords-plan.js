// v131: Üben mit Plan – Hör-Training (Dur, Moll, sus, Maj7, 7, 9, b9, #9 mit Ampel), Selbstkontrolle und Übungsplan mit
// Tempo-Stufen je Kapitel, Technik-Vorübungen (Überstrecken, Dämpfen), Stimmungen (Drop D, Cis, C, H) mit konkreten Griffen.
// Speicher: powerchords.progress.v1 → kurs["ear"], kurs["plan-k<n>"], kurs["tv-<n>"], kurs["opt-tune"] (Objekte, keine Häkchen-true).
(function () {
  const md = x => ((x % 12) + 12) % 12;
  const L0 = s => (window.__lang === 'en' && window.__EN_PCW && window.__EN_PCW[s]) || s;
  let A = null, host = null;
  const kp = () => { const P = A.PR(); P.kurs = P.kurs || {}; return P.kurs; };
  // ---------- Hör-Training ----------
  const EAR = [['dur', 'Dur', [0, 4, 7]], ['moll', 'Moll', [0, 3, 7]], ['sus', 'sus (2 oder 4)', null], ['maj7', 'Maj7', [0, 4, 7, 11]], ['7', '7', [0, 4, 7, 10]], ['9', '9', [0, 4, 10, 14]], ['b9', 'b9', [0, 4, 10, 13]], ['s9', '#9', [0, 4, 10, 15]]];
  const EQ = { q: null };
  function earVoicing(k, root) {
    const e = EAR.find(x => x[0] === k); let iv = e[2]; if (k === 'sus') iv = Math.random() < 0.5 ? [0, 2, 7] : [0, 5, 7];
    return [root - 12].concat(iv.map(n => root + n));
  }
  function ampel(st) { if (!st || st[1] < 3) return 'grau'; const r = st[0] / st[1]; return r >= 0.8 ? 'gruen' : r >= 0.5 ? 'gelb' : 'rot'; }
  function earDraw() {
    const b = host.querySelector('#pcKT5 .pc-sec-b'); if (!b) return; const st = kp().ear || {}, q = EQ.q;
    let h = '<div class="pc-ampel">' + EAR.map(([k, n]) => { const s = st[k]; return '<span class="pc-amp ' + ampel(s) + '" data-ek="' + k + '"><i></i><b>' + n + '</b><small>' + (s ? s[0] + '/' + s[1] : '–') + '</small></span>'; }).join('') + '</div>' +
      '<p class="caption" translate="no">Ampel: grün ab 80 %, gelb ab 50 %, rot darunter (ab 3 Versuchen). Erst hören, dann den Akkordtyp antippen.</p>';
    if (!q) h += '<button class="toggle-btn active" data-ear="start">' + PcSkin.btn(L0('▶ Runde starten')) + '</button>';
    else {
      h += '<div class="pc-row"><button class="toggle-btn" data-ear="again">' + PcSkin.btn(L0('▶ Nochmal hören')) + '</button></div><div class="pc-row">' + EAR.map(([k, n]) => '<button class="toggle-btn" data-ea="' + k + '"' + (q.ans != null ? ' disabled' : '') + ' translate="no">' + n + '</button>').join('') + '</div>';
      if (q.fb) h += '<p class="pc-wfb ' + (q.ans ? 'ok' : 'no') + '" translate="no">' + q.fb + '</p>';
      h += '<div class="pc-row"><b class="pc-wcnt">' + L0('Aufgabe') + ' ' + (q.i + 1) + ' ' + L0('von') + ' 10 · ' + L0('Treffer') + ': ' + q.hits + '</b>' + (q.ans != null ? '<button class="toggle-btn active" data-ear="next">' + PcSkin.btn(q.end ? L0('Neue Runde') : L0('Weiter ▶')) + '</button>' : '') + '</div>';
    }
    b.innerHTML = h;
  }
  function earNew() { const q = EQ.q; q.k = EAR[Math.floor(Math.random() * EAR.length)][0]; q.root = 52 + Math.floor(Math.random() * 8); q.ms = earVoicing(q.k, q.root); q.ans = null; q.fb = ''; setTimeout(() => A.strumNow(q.ms), 120); }
  // ---------- Übungsplan je Kapitel ----------
  const STEPS = [60, 70, 80, 90, 100];
  const SELF = [   // Selbstkontrolle je Kapitel: „Woran erkenne ich, dass ich es kann?“ (ergänzt, aus dem Ziel des Kapitels abgeleitet)
    ['Ich sage zu jeder Zahl 1–13, ob sie einmal oder zweimal vorkommt.', 'Ich spreche B und B-flat ohne zu stolpern.'],
    ['Ich greife den Powerchord auf E-, A-, D-Saite ohne Hinsehen.', 'Ich nenne jeden Stammton der E- und A-Saite sofort.'],
    ['Ich finde jedes Intervall von A aus in unter 5 Sekunden.', 'Ich höre große und kleine Terz sicher heraus.'],
    ['Ich mache aus E, A und D sofort Moll.', 'Ich greife F als Barré, alle Saiten klingen.'],
    ['Ich nenne die Stufenakkorde in C-Dur in der richtigen Reihenfolge.', 'Ich spiele I-IV-V-I und VI-IV-V-VI ohne Pause.'],
    ['Ich mache aus jedem offenen Dur-Akkord Sus2 und Sus4.', 'Ich sage, auf welchen Stufen Sus2/Sus4 nicht passen.'],
    ['Ich weiß, auf welchen Stufen die große 7 liegt.', 'Ich spiele Autumn Leaves (Anfang) ohne Pause.'],
    ['Ich leite Drop 2 aus einem Closed Voicing ab.', 'Ich spiele Am7 – D7 – Gmaj7 – Cmaj7 in einer Lage.'],
    ['Ich spiele C-Dur in allen drei Umkehrungen auf G-B-e.', 'Ich verbinde C – G – Am – F mit kleinen Schritten.'],
    ['Ich weiß vorher, ob auf einer Stufe 9, 11 oder Major 7 passt.', 'Ich ersetze im Dreiklang die 1 durch die 9.'],
    ['Ich baue D7 → D7sus2 → D7(9) ab.', 'Ich erkenne E7#9 am Klang.'],
    ['Ich spiele E-, G-, C- und A-Griff als Arpeggio ohne Lücke.', 'Ich halte 3er- und 4er-Gruppen am Metronom.'],
    ['Ich baue in jedes Arpeggio die richtige 7 ein.', 'Ich spiele ein Arpeggio überspringend (1→5, 3→1).'],
    ['Ich greife den Dur-Powerchord und D/F# sauber.', 'Ich halte beim Wechsel gleiche Töne liegen.'],
    ['Ich stimme Drop D ohne Hilfe.', 'Ich passe einen Powerchord an eine tiefere Stimmung an.']
  ];
  function planHtml(ci) {
    const st = kp()['plan-k' + (ci + 1)] || {}, best = st.bpm || 0, ch = st.ch || [];
    return '<div class="pc-kplan" data-kplan="' + ci + '"><h4>' + L0('Übungsplan & Selbstkontrolle') + '</h4>' +
      '<p class="caption" translate="no">(ergänzt) Übe die Übungen dieses Kapitels in Tempo-Stufen. Tippe die Stufe an, die du drei Mal sauber geschafft hast.</p>' +
      '<div class="pc-row pc-tempi">' + STEPS.map(b => '<button class="toggle-btn' + (b <= best ? ' active' : '') + '" data-pbpm="' + b + '" aria-pressed="' + (b <= best ? 'true' : 'false') + '">' + b + ' BPM</button>').join('') + '<span class="caption pc-pbest">' + (best ? L0('geschafft bis') + ' ' + best + ' BPM' : '') + '</span></div>' +
      '<div class="pc-kself" translate="no">' + SELF[ci].map((t, i) => '<label class="check pc-kchk"><input type="checkbox" data-pself="' + i + '"' + (ch[i] ? ' checked' : '') + '> <span>' + t + '</span></label>').join('') + '</div></div>';
  }
  function planSave(ci, f) { const st = kp(), k = 'plan-k' + (ci + 1); st[k] = Object.assign({ bpm: 0, ch: [] }, st[k] || {}); f(st[k]); A.saveProg(); }
  // ---------- Technik-Vorübungen ----------
  const TV = [
    ['Spinne 1-2-3-4', 'Vier Finger nebeneinander auf einer Saite (Bund 5–8), jeder Ton einzeln. Dann eine Saite höher. Locker bleiben, Daumen hinten in der Mitte.', 'Dehnen vorbereiten'],
    ['Spinne gespreizt', 'Wie oben, aber Zeigefinger Bund 5, kleiner Finger Bund 9 (ein Bund mehr). Langsam, nur so weit, wie es ohne Schmerz geht.', 'Überstrecken (Kap. 11–15)'],
    ['Powerchord mit überstrecktem kleinen Finger', 'A-Saite Bund 2 (Zeigefinger), D-Saite Bund 5 (kleiner Finger) – der Dur-Powerchord aus Kapitel 14. Erst nur greifen, dann anschlagen.', 'Kap. 14'],
    ['Quinte unten', 'Powerchord auf der A-Saite (Bund 3) und mit dem Zeigefinger die tiefe E-Saite im selben Bund mitgreifen (Kap. 14). Klingen alle vier Töne?', 'Kap. 14'],
    ['Saiten-Kontrolle', 'Nach jedem Griff alle sechs Saiten einzeln anschlagen: Klingen genau die gewollten? Die anderen müssen still sein.', 'Kap. 4'],
    ['Tiefe Saite antippen', 'Powerchord auf der A-Saite: die Fingerkuppe des Zeigefingers berührt leicht die tiefe E-Saite und dämpft sie.', 'Kap. 2/4'],
    ['A-Saite blockieren', 'D/F#: Daumen oder Zeigefinger greift F# auf der tiefen E-Saite und legt sich leicht an die A-Saite – sie darf nicht klingen.', 'Kap. 14'],
    ['Palm Mute', 'Handballen locker am Steg. Achtel auf E5, erst gedämpft, dann offen. Der Ton bleibt klar, nur kürzer.', 'Kap. 2']
  ];
  // ---------- Stimmungen ----------
  const TUNES = [['E', 'Standard (E)', 40], ['dD', 'Drop D', 38], ['dCis', 'Drop Cis', 37], ['dC', 'Drop C', 36], ['dB', 'Drop H (B)', 35]];
  const P5 = [['D5', 2], ['E5', 4], ['F5', 5], ['G5', 7], ['A5', 9], ['C5', 0]];
  function tuneGrips(low) { return P5.map(([n, p]) => { const fA = md(p + 7 - 9), fL = fA + (38 - low); return { n, fr: [fL, fA, fA, null, null, null] }; }); }
  function card(id, title, sub) { return '<details class="card pc-sec pc-ktool" id="' + id + '"><summary><h3>' + title + '</h3></summary><p class="caption pc-ktsub" translate="no">' + sub + '</p><div class="pc-sec-b"></div></details>'; }
  function build(h, api) {
    if (host) return; host = h; A = api;
    const box = h.querySelector('.pc-ktools'); if (!box) return;
    box.querySelector('.pc-ktoolbar').insertAdjacentHTML('beforeend', [['pcKT5', 'Hör-Training'], ['pcKT6', 'Technik-Vorübungen'], ['pcKT7', 'Stimmungen: Drop D, Cis, C, H']].map(([id, t]) => '<button class="toggle-btn" data-ktool="' + id + '">' + L0(t) + '</button>').join(''));
    box.insertAdjacentHTML('beforeend', card('pcKT5', L0('Hör-Training'), '(ergänzt) Dur, Moll, sus, Maj7, 7, 9, b9 und #9 am Klang erkennen – die Lücke „Gehörbildung“ des Kurses. 10 Akkorde je Runde.') +
      card('pcKT6', L0('Technik-Vorübungen'), '(ergänzt) Vorübungen zum Überstrecken und Dämpfen, die der Kurs voraussetzt. Nie mit Schmerz üben.') +
      card('pcKT7', L0('Stimmungen: Drop D, Cis, C, H'), 'Kapitel 15: Nur die tiefe Saite wird tiefer gestimmt. Wähle die Stimmung – alle Griffbilder im Kurs schalten um.'));
    box.querySelectorAll('#pcKT5, #pcKT6, #pcKT7').forEach(d => d.addEventListener('toggle', () => { if (d.open) fill(d); }));
    h.addEventListener('click', onClick); h.addEventListener('change', onChange);
  }
  function fill(d) {
    if (d.id === 'pcKT5') { earDraw(); return; }
    if (d._f) return; d._f = true; const b = d.querySelector('.pc-sec-b');
    if (d.id === 'pcKT6') { const st = kp(); b.innerHTML = '<div class="pc-kex" translate="no">' + TV.map(([t, x, k], i) => '<label class="check pc-kchk"><input type="checkbox" data-tv="' + i + '"' + (st['tv-' + i] && st['tv-' + i].done ? ' checked' : '') + '> <span><i>(ergänzt)</i> <b>' + t + '</b> – ' + x + ' <small class="caption">(' + k + ')</small></span></label>').join('') + '</div>' +
      '<div class="pc-row"><button class="toggle-btn active" data-tvloop="1">' + PcSkin.btn(L0('▶ Loop starten')) + '</button><span class="caption" translate="no">E5 mit Klick, 60 BPM – zum Mitspielen der Vorübungen</span></div>'; }
    if (d.id === 'pcKT7') tuneDraw();
  }
  function tuneDraw() {
    const b = host.querySelector('#pcKT7 .pc-sec-b'), cur = window.PcKurs ? PcKurs.tuning() : 'E', T = TUNES.find(t => t[0] === cur);
    b.innerHTML = '<div class="seg pc-seg" id="pcTuneSel">' + TUNES.map(([k, n]) => '<button class="toggle-btn' + (k === cur ? ' active' : '') + '" data-tune="' + k + '">' + n + '</button>').join('') + '</div>' +
      '<p class="caption" translate="no">' + (cur === 'E' ? 'Standardstimmung: alle Griffe wie im Kurs.' : 'Tiefe Saite: ' + T[1].replace('Drop ', '') + '. „Um denselben Ton zu spielen“, greifst du auf der tiefen Saite ' + (40 - T[2]) + ' Bünde höher; alle anderen Saiten bleiben gleich. Die Griffbilder im Kurs sind umgestellt.') + '</p>' +
      (cur === 'E' ? '' : '<div class="pc-tbl"><table translate="no"><thead><tr><th>Powerchord</th><th>Griff (tief → hoch)</th><th>Töne</th></tr></thead><tbody>' + tuneGrips(T[2]).map(g => '<tr><td><b>' + g.n + '</b></td><td class="pc-mono">' + g.fr.map(f => f == null ? 'x' : f > 9 ? '(' + f + ')' : f).join('') + '</td><td>' + [T[2] + g.fr[0], 45 + g.fr[1], 50 + g.fr[2]].map(m => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'][md(m)]).join(' ') + '</td></tr>').join('') + '</tbody></table></div>' +
        '<p class="caption" translate="no">' + (cur === 'dD' ? 'Drop D: alle drei Töne im selben Bund – „ein Finger“.' : 'Die tiefe Saite liegt ' + (38 - T[2]) + ' Bund' + (38 - T[2] > 1 ? 'e' : '') + ' höher als die beiden anderen Töne („einen Bund höher“, Kap. 15).') + '</p>');
  }
  function onChange(e) {
    const s = e.target.closest('[data-pself]'); if (s) { const ci = +s.closest('[data-kplan]').dataset.kplan; planSave(ci, p => { p.ch[+s.dataset.pself] = s.checked; }); return; }
    const t = e.target.closest('[data-tv]'); if (t) { kp()['tv-' + t.dataset.tv] = { done: t.checked }; A.saveProg(); }
  }
  function onClick(e) {
    const pb = e.target.closest('[data-pbpm]'); if (pb) { const pl = pb.closest('[data-kplan]'), ci = +pl.dataset.kplan, v = +pb.dataset.pbpm; planSave(ci, p => { p.bpm = p.bpm === v ? STEPS[STEPS.indexOf(v) - 1] || 0 : v; }); pl.outerHTML = planHtml(ci); return; }
    const ea = e.target.closest('[data-ea]'); if (ea) { const q = EQ.q; if (!q || q.ans != null) return; const ok = ea.dataset.ea === q.k, name = EAR.find(x => x[0] === q.k)[1]; q.ans = ok; if (ok) q.hits++;
      const st = kp(); st.ear = st.ear || {}; const c = st.ear[q.k] = st.ear[q.k] || [0, 0]; c[1]++; if (ok) c[0]++;
      q.fb = (ok ? '✓ Richtig! ' : '✗ Das war ') + name + '.'; if (q.i === 9) { q.end = true; st['ear-best'] = { best: Math.max((st['ear-best'] || {}).best || 0, q.hits), last: q.hits }; } A.saveProg(); earDraw(); return; }
    const er = e.target.closest('[data-ear]'); if (er) { const v = er.dataset.ear;
      if (v === 'start' || (v === 'next' && EQ.q.end)) { EQ.q = { i: 0, hits: 0 }; earNew(); } else if (v === 'next') { EQ.q.i++; earNew(); } else if (v === 'again') A.strumNow(EQ.q.ms);
      earDraw(); return; }
    if (e.target.closest('[data-tvloop]')) { if (window.PcKurs) PcKurs.loopNow(['E5'], 60, 'click', { E5: [0, 2, 2, null, null, null] }); return; }
    const tu = e.target.closest('[data-tune]'); if (tu) { if (window.PcKurs) PcKurs.setTuning(tu.dataset.tune); tuneDraw(); }
  }
  window.PcPlan = { build, planHtml, tuneGrips, EAR, earVoicing, ampel, TUNES, _ear: () => EQ.q && { k: EQ.q.k, i: EQ.q.i, hits: EQ.q.hits, ans: EQ.q.ans } };
})();
