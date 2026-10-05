// E-Bass-Synthese (läuft im Hintergrund-Worker): gezupfte Saite als Summe gedämpfter Teiltöne.
// Physikalisch angelehnt: Zupfstelle und Tonabnehmer-Lage formen das Teiltonspektrum (Kammfilter),
// tiefe Teiltöne klingen lange, hohe schnell ab, leichte Saiten-Unharmonizität, kurzer Tonhöhen-Einschwinger,
// zwei Schwingungsebenen mit minimal versetzter Frequenz (lebendiges Sustain), weicher Fingeranschlag.
// Ergebnis: { midi: Float32Array } – Mono, Länge „sec“ Sekunden.
function synthBass(sr, from, to, sec) {
  from = from || 36; to = to || 55; sec = sec || 2.2;
  const n = Math.round(sec * sr), out = {};
  function rng(seed) { let a = (seed * 2654435761) >>> 0 || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; }; }
  for (let midi = from; midi <= to; midi++) {
    const r = rng(midi * 7919 + 3), f0 = 440 * Math.pow(2, (midi - 69) / 12), x = new Float32Array(n);
    const B = 0.00018 * Math.pow(65.4 / f0, 0.5);             // Unharmonizität: dicke Saiten etwas mehr
    const p = 0.185 + 0.01 * r(), q = 0.12;                     // Zupfstelle und Tonabnehmer (Anteil der Saitenlänge vom Steg)
    const fc = 200 + 1.0 * f0;                                  // weicher Finger, Saitendämpfung: Höhen steil abgesenkt
    const tau0 = 3.6;                                           // Ausklingzeit des Grundtons
    const glide = 0.0035, gTau = 0.045;                         // Anschlag dehnt die Saite kurz: Tonhöhe minimal höher
    let maxK = 0; for (let k = 1; k * f0 < Math.min(2600, sr * 0.45); k++) maxK = k;
    for (let k = 1; k <= maxK; k++) {
      const fk = k * f0 * Math.sqrt(1 + B * k * k);
      let a = Math.abs(Math.sin(k * Math.PI * p)) / Math.pow(k, 0.6);     // gezupfte Saite
      a *= 0.2 + 0.8 * Math.abs(Math.sin(k * Math.PI * q));               // Tonabnehmer-Lage
      a /= 1 + Math.pow(fk / fc, 2.4);
      if (a < 0.003) continue;
      const tau = tau0 / (1 + 0.00028 * Math.pow(fk, 1.25));
      const lim = Math.min(n, Math.round(tau * 6 * sr)), lg = Math.min(lim, Math.round(gTau * 7 * sr));
      // zwei Schwingungsebenen: horizontal (Hauptteil) und vertikal (leiser, schneller abklingend, leicht verstimmt)
      for (const [g, det, tm] of (k <= 6 ? [[1, 0, 1], [0.3, 0.18 + 0.12 * r(), 0.7]] : [[1, 0, 1]])) {
        const R = Math.exp(-1 / (sr * tau * tm)), gd = Math.exp(-1 / (sr * gTau));
        let ph = r() * 0.4, amp = a * g, gl = glide, w = 0, cw = 1, sw = 0, c = Math.cos(ph), s = Math.sin(ph);
        let i = 0;
        for (; i < lg; i++) {                                   // Einschwingen: Tonhöhe gleitet auf den Sollwert
          if ((i & 31) === 0) { w = 2 * Math.PI * (fk + det) * (1 + gl) / sr; cw = Math.cos(w); sw = Math.sin(w); }
          const c2 = c * cw - s * sw; s = c * sw + s * cw; c = c2;
          x[i] += amp * s; amp *= R; gl *= gd;
        }
        w = 2 * Math.PI * (fk + det) / sr; cw = Math.cos(w); sw = Math.sin(w);
        for (; i < lim; i++) { const c2 = c * cw - s * sw; s = c * sw + s * cw; c = c2; x[i] += amp * s; amp *= R; }
      }
    }
    // Fingergeräusch: sehr leises, dumpfes Rauschen in den ersten Millisekunden
    { let y = 0, y2 = 0; const m = Math.round(0.012 * sr), lp = Math.exp(-2 * Math.PI * 900 / sr);
      for (let i = 0; i < m; i++) { y = (1 - lp) * (r() * 2 - 1) + lp * y; y2 = (1 - lp) * y + lp * y2; x[i] += y2 * 0.05 * Math.exp(-i / (0.003 * sr)); } }
    // Anschlag: weicher Einsatz (Finger, keine Plektrum-Kante), Ende sanft auslaufen lassen
    const na = Math.round((0.004 + 0.0009 * (65.4 / f0) * 4) * sr);
    for (let i = 0; i < na; i++) x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / na);
    const nf = Math.round(0.25 * sr); for (let i = 0; i < nf; i++) x[n - 1 - i] *= i / nf;
    // Lautheit: gleiches Effektivwert-Niveau in der ersten Sekunde für alle Töne
    let e = 0; const m1 = Math.min(n, sr); for (let i = 0; i < m1; i++) e += x[i] * x[i];
    const g = 0.046 / Math.sqrt(e / m1 + 1e-12);
    for (let i = 0; i < n; i++) x[i] *= g;
    out[midi] = x;
  }
  return out;
}
