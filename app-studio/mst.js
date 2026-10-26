// ---------- Studio: Mastering (v112, vom Looper übernommen) – Anbindung des Looper-Codes master.js ----------
// master.js erwartet ensureAudio()/audioCtx und optional Looper.stopAll(); als Quelle liefert das Studio den Projekt-Mix.
window.ensureAudio = () => { window.audioCtx = Engine.ac(); Engine.ac().resume && Engine.ac().resume(); return window.audioCtx; };
window.audioCtx = null;
window.Looper = { stopAll: () => { if (Engine.playing) { Engine.stop(); UI.sync(); } } };
window.MasterSource = async v => {
  if (v !== 'mix' && v !== 'cycle') return null;
  const P = Proj.P; if (!P || !P.regions.length) throw new Error('Das Projekt ist noch leer.');
  const cyc = v === 'cycle'; if (cyc && !(P.cycle.on && P.cycle.b > P.cycle.a)) throw new Error('Kein Cycle-Bereich gesetzt – im Arrangement „⟲ Takte loopen“ oder oben im Lineal ziehen.');
  if (Engine.playing) { Engine.stop(); UI.sync(); }
  const bar = document.getElementById('msBar'), pr = document.getElementById('msProg'); pr.hidden = false;
  const x = await Exp.render(Object.assign(cyc ? { a: P.cycle.a, b: P.cycle.b, tail: 0 } : { a: 0, b: Proj.projEnd() }, { noMaster: true }), f => { bar.style.width = Math.round(f * 100) + '%'; });
  pr.hidden = true;
  return { name: P.name + (cyc ? ' (Takt ' + (Math.round(P.cycle.a / Proj.bar()) + 1) + '–' + Math.round(P.cycle.b / Proj.bar()) + ')' : ''), chs: [x.l, x.r], sr: x.sr };
};
