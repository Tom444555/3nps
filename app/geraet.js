/* ---------- v142: Geräte-Profil „Automatisch · Neues iPad · Altes iPad · Minimal“ (in „Leistung ▾“) ----------
   Gespeichert in localStorage 3nps-device (auto|new|old|min; die v24 kennt den Schlüssel nicht). Das wirksame Profil steht in
   window.__dev (new|old|min) und als Klassen dev-old (bei Altes iPad UND Minimal) / dev-min am <html> – beides setzt schon
   das frühe Skript im Kopf (kein Aufblitzen). Wechsel melden ein Ereignis „devchange“ auf document.
   „Automatisch“ misst vorsichtig (Rechenkerne, Speicher, kurze Bildzeit-Messungen nach dem Start) und wählt höchstens „Altes iPad“,
   nie „Minimal“; den großen Audio-Puffer setzt nur die ausdrückliche Wahl (sonst bleibt die Latenz wie bisher). */
(() => {
  const $ = id => document.getElementById(id), root = document.documentElement;
  const KEY = '3nps-device', KA = '3nps-device-auto';
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  let sel = /^(auto|new|old|min)$/.test(get(KEY) || '') ? get(KEY) : 'auto';
  let det = get(KA) === 'old' ? 'old' : 'new', why = get(KA + '-why') || '';
  const eff = () => sel === 'auto' ? det : sel;
  const NAME = { auto: 'Automatisch', new: 'Neues iPad', old: 'Altes iPad', min: 'Minimal' };
  const DESC = {
    new: 'Neues iPad: volle Darstellung wie bisher.',
    old: 'Altes iPad: ruhige Anzeigen (etwa 16 Bilder/s), grobe, flache Pegel, keine Schatten, Verläufe, Texturen und Übergänge, Wellenform in geringerer Auflösung, die Drone bleibt vorgerechnet. Der Klang der Spuren bleibt gleich.',
    min: 'Minimal: nur der Looper-Kern. Statt Kreisen und Pegeln Takt und Schlag als Zahl, je Spur ein Lämpchen für Aufnahme und eines für Übersteuern, Wellenform als stehendes Bild, Systemschrift ohne Optik. In „Minimal“ aus: Was passt, Akkord-Mitlauf, Live-Analyse, Signalweg, Hall/Echo – deine Einstellungen bleiben gespeichert und gelten beim Zurückschalten wieder.'
  };
  function paint() {
    document.querySelectorAll('.dev-b').forEach(b => { const on = String(b.dataset.dev === sel); if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on); });
    const info = $('devInfo'); if (!info) return;
    const d = eff();
    let t = sel === 'auto' ? 'Automatisch gewählt: „' + NAME[det] + '“' + (why ? ' (' + why + ')' : '') + '. ' + DESC[d] : DESC[d];
    const big = sel === 'old' || sel === 'min', pf = get('3nps-perf') || '';
    if (big && window.__audioHint !== 'playback') t += ' Großer Audio-Puffer: greift nach dem nächsten Start der App.';
    else if (!big && window.__audioHint === 'playback' && !/^(lite|stable)$/.test(pf)) t += ' Der normale Audio-Puffer gilt wieder ab dem nächsten Start der App.';
    if (info.textContent !== t) info.textContent = t;
  }
  function apply() {
    const d = eff(), prev = window.__dev;
    window.__dev = d;
    root.classList.toggle('dev-old', d !== 'new'); root.classList.toggle('dev-min', d === 'min');
    paint();
    if (prev !== d) document.dispatchEvent(new CustomEvent('devchange', { detail: { dev: d, prev } }));
  }
  function set(v) {
    if (!/^(auto|new|old|min)$/.test(v)) return;
    sel = v; put(KEY, v); apply();
  }
  // ---- vorsichtige Erkennung (nur bei „Automatisch“): wählt höchstens „Altes iPad“ ----
  function decide(d, w) {
    det = d; why = w; put(KA, d); put(KA + '-why', w);
    if (sel === 'auto') apply();
  }
  // Zwei kurze Messfenster (4 s und 15 s nach dem Laden, je 90 Bilder, nur sichtbar): „Altes iPad“ nur, wenn BEIDE langsam
  // waren (ein einzelner Hänger beim Laden zählt nicht); „Neues iPad“, sobald ein Fenster flüssig war.
  function detect() {
    if (sel !== 'auto') return;
    const hc = navigator.hardwareConcurrency || 0, dm = navigator.deviceMemory || 0, weak = (hc && hc <= 2) || (dm && dm <= 2);
    const hw = (hc ? hc + ' Rechenkerne' : '') + (dm ? (hc ? ', ' : '') + dm + ' GB' : '');
    let slowN = 0;
    const measure = (delay, last) => setTimeout(() => {
      if (sel !== 'auto') return;
      if (document.hidden) { if (!last) measure(5000, true); return; }
      const ft = []; let prev = 0;
      const f = t => {
        if (prev) { const dt = t - prev; if (dt < 400) ft.push(dt); }
        prev = t;
        if (ft.length < 90 && !document.hidden) { requestAnimationFrame(f); return; }
        if (ft.length < 60) return;
        const s = ft.slice().sort((a, b) => a - b), med = s[Math.floor(s.length / 2)], slow = ft.filter(x => x > 40).length / ft.length;
        const isSlow = med > 28 || slow >= 0.35 || (weak && (med > 20 || slow >= 0.15));
        const w = (hw ? hw + ', ' : '') + 'Bildzeit ' + Math.round(med) + ' ms';
        if (!isSlow) { decide('new', w); return; }
        if (++slowN >= 2) decide('old', w); else if (!last) measure(11000, true);
      };
      requestAnimationFrame(f);
    }, delay);
    measure(4000, false);
  }
  document.querySelectorAll('.dev-b').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); set(b.dataset.dev); }));
  window.Geraet = { get: eff, sel: () => sel, set, detected: () => ({ dev: det, why }), name: v => NAME[v] };
  apply();
  if (document.readyState === 'complete') detect(); else window.addEventListener('load', detect, { once: true });
})();
