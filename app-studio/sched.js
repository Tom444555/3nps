// ---------- Studio: Zeitplaner (Metronom, Automation, Noten-/Drum-Ereignisse) ----------
// Läuft im Hauptthread mit 0,3 s Vorlauf. Erzeuger bekommen Abschnitte [a, b) der Zeitleiste und die Kontextzeit von a.
const Sched = (() => {
  const LA = 0.3, prods = [];
  let on = false, u0 = 0, t0 = 0, done = 0, timer = null, click = false, cin = false;
  try { click = localStorage.getItem('3nps-studio-click') === '1'; cin = localStorage.getItem('3nps-studio-countin') === '1'; } catch (e) {}
  const sr = () => Engine.sr();
  function cyc() { const c = Proj.P && Proj.P.cycle; return c && c.on && c.b > c.a ? c : null; }
  // unverpackte Zeit u (Bilder seit Start) → Abschnitte der Zeitleiste
  function segs(ua, ub) {
    const out = [], c = cyc(); let u = ua;
    while (u < ub) {
      let p = u0 + u, tl = p; if (c && p >= c.b) tl = c.a + ((p - c.a) % (c.b - c.a));
      let len = ub - u; if (c && tl < c.b) len = Math.min(len, c.b - tl);
      if (len <= 0) break;
      out.push([tl, tl + len, t0 + u / sr()]); u += len;
    }
    return out;
  }
  function pump() {
    if (!on) return; const ac = Engine.ac(), ub = Math.round((ac.currentTime + LA - t0) * sr());
    if (ub <= done) return;
    for (const [a, b, ta] of segs(done, ub)) prods.forEach(f => { try { f(a, b, ta, ac); } catch (e) { console.error(e); } });
    done = ub;
  }
  function start(pos, at) { on = true; u0 = pos; t0 = at; done = 0; autoStart(); pump(); clearInterval(timer); timer = setInterval(pump, 40); }
  function stop() { on = false; clearInterval(timer); timer = null; autoStop(); prods.forEach(f => f.stop && f.stop()); }
  function resync() { if (!on) return; const ac = Engine.ac(); u0 = Engine.curPos(); t0 = ac.currentTime; done = 0; autoStart(); prods.forEach(f => f.stop && f.stop()); }
  // ---- Metronom ----
  let clickOut = null;
  function blip(ac, t, acc) {
    if (!clickOut) { clickOut = ac.createGain(); clickOut.gain.value = 0.5; clickOut.connect(ac.destination); }
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = acc ? 1760 : 1175; o.type = 'square';
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(acc ? 0.5 : 0.3, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(clickOut); o.start(t); o.stop(t + 0.06);
  }
  function clickProd(a, b, ta, ac) {
    if (!click && !(window.Rec && Rec.active())) return; const spb = Proj.spb(), sig = Proj.P.sig;
    for (let k = Math.ceil(a / spb - 1e-6); k * spb < b; k++) blip(ac, ta + (k * spb - a) / sr(), k % sig === 0);
  }
  prods.push(clickProd);
  // ---- Automation (Lautstärke in dB, Panorama −100…100) ----
  function valAt(pts, f) { if (!pts.length) return null; if (f <= pts[0].f) return pts[0].v; for (let i = 1; i < pts.length; i++) if (f < pts[i].f) { const p = pts[i - 1], q = pts[i]; return p.v + (q.v - p.v) * (f - p.f) / (q.f - p.f); } return pts[pts.length - 1].v; }
  const db2g = d => Math.pow(10, d / 20);
  function params(G, P) { const out = []; P.tracks.forEach((t, i) => { const n = G && G.tr[i]; if (!n || !t.auto) return; if (t.auto.vol && t.auto.vol.length) out.push([n.vol.gain, t.auto.vol, db2g]); if (t.auto.pan && t.auto.pan.length) out.push([n.pan.pan, t.auto.pan, v => v / 100]); }); return out; }
  function autoStart() { const G = Engine.graph, P = Proj.P; if (!G || !P) return; const ac = Engine.ac(), now = ac.currentTime; params(G, P).forEach(([p, pts, m]) => { p.cancelScheduledValues(now); p.setValueAtTime(m(valAt(pts, Engine.curPos())), now); }); }
  function autoStop() { const G = Engine.graph; if (!G) return; const now = Engine.ac().currentTime; G.tr.forEach(n => { n.vol.gain.cancelScheduledValues(now); n.pan.pan.cancelScheduledValues(now); }); }
  function autoProd(a, b, ta) {
    const G = Engine.graph, P = Proj.P; if (!G) return; const S = sr(), ps = params(G, P); if (!ps.length) return;
    const step = 2048;
    ps.forEach(([p, pts, m]) => { p.setValueAtTime(m(valAt(pts, a)), ta); for (let f = a + step; f <= b; f += step) p.linearRampToValueAtTime(m(valAt(pts, Math.min(f, b))), ta + (Math.min(f, b) - a) / S); });
  }
  prods.push(autoProd);
  function offlineAuto(oc, G, P, a) {
    const S = oc.sampleRate, e = Proj.projEnd() + S * 2;
    params(G, P).forEach(([p, pts, m]) => { p.setValueAtTime(m(valAt(pts, a)), 0); for (let f = a + 2048; f < e; f += 2048) p.linearRampToValueAtTime(m(valAt(pts, f)), (f - a) / S); });
  }
  return { start, stop, resync, add: f => prods.push(f), offlineAuto, valAt, get click() { return click; }, set click(v) { click = !!v; try { localStorage.setItem('3nps-studio-click', click ? '1' : '0'); } catch (e) {} }, get countIn() { return cin; }, set countIn(v) { cin = !!v; try { localStorage.setItem('3nps-studio-countin', cin ? '1' : '0'); } catch (e) {} }, blip };
})();
window.Sched = Sched;
