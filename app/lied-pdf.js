// ---- Leadsheet als PDF (A4, Helvetica, Akkorde über dem Text). Eigener kleiner PDF-Schreiber, keine fremden Bibliotheken. ----
const LiedPdf = (() => {
  const PDFW = {"H":[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,761,222,556,333,1000,556,556,333,1000,667,333,1000,761,611,761,761,222,222,333,333,350,556,1000,333,1000,500,333,944,761,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],"B":[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,761,278,556,500,1000,556,556,333,1000,667,333,1000,761,611,761,761,278,278,500,500,350,556,1000,333,1000,556,333,944,761,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]};
  // Unicode → Windows-1252 (Standardkodierung der PDF-Grundschriften)
  const SPEC = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
  const REPL = { '♭': 'b', '♯': '#', '→': '->', '×': 'x', '½': '1/2' };
  function codes(s) {
    const out = [];
    for (const ch of String(s)) {
      if (REPL[ch] && ch !== '×' && ch !== '½') { for (const c of REPL[ch]) out.push(c.charCodeAt(0)); continue; }
      const u = ch.codePointAt(0);
      if (u >= 32 && u < 127) out.push(u); else if (SPEC[ch]) out.push(SPEC[ch]); else if (u >= 160 && u < 256) out.push(u);
      else if (REPL[ch]) for (const c of REPL[ch]) out.push(c.charCodeAt(0)); else out.push(63);
    }
    return out;
  }
  const width = (s, f, size) => codes(s).reduce((a, c) => a + (PDFW[f][c - 32] || 556), 0) * size / 1000;
  const pstr = s => '(' + codes(s).map(c => c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c < 127 ? String.fromCharCode(c) : '\\' + c.toString(8).padStart(3, '0')).join('') + ')';
  // Zeile umbrechen; Akkord-Positionen (Zeichenindex) wandern mit
  function wrapRow(row, maxW, size) {
    const out = []; let text = row.text, chords = row.chords.slice(), off = 0;
    while (width(text, 'H', size) > maxW && text.includes(' ')) {
      let cut = text.length; while (cut > 0 && width(text.slice(0, cut), 'H', size) > maxW) cut = text.lastIndexOf(' ', cut - 1);
      if (cut <= 0) break;
      out.push({ text: text.slice(0, cut), chords: chords.filter(c => c.i - off < cut).map(c => ({ i: c.i - off, n: c.n })) });
      chords = chords.filter(c => c.i - off >= cut); off += cut + 1; text = text.slice(cut + 1);
    }
    out.push({ text, chords: chords.map(c => ({ i: Math.max(0, c.i - off), n: c.n })) });
    return out;
  }
  function build(ls) {
    const PW = 595.28, PH = 841.89, M = 54, maxW = PW - 2 * M, pages = []; let ops = [], y = PH - M;
    const T = (x, yy, s, f, size, rgb) => ops.push((rgb ? rgb.join(' ') + ' rg ' : '0 0 0 rg ') + 'BT /' + f + ' ' + size + ' Tf ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td ' + pstr(s) + ' Tj ET');
    const Ln = (x1, yy, x2, rgb) => ops.push((rgb || [0.75, 0.75, 0.75]).join(' ') + ' RG 0.6 w ' + x1.toFixed(2) + ' ' + yy.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + yy.toFixed(2) + ' l S');
    const page = () => { if (ops.length) pages.push(ops); ops = []; y = PH - M; T(M, M - 24, ls.title + ' – Seite ' + (pages.length + 1), 'H', 8, [0.5, 0.5, 0.5]); };
    const need = h => { if (y - h < M) page(); };
    page();
    // Kopf
    T(M, y - 22, ls.title, 'B', 22); y -= 34;
    T(M, y - 10, ls.info, 'H', 10, [0.3, 0.3, 0.3]); y -= 16;
    if (ls.theme) { wrapRow({ text: 'Thema: ' + ls.theme, chords: [] }, maxW, 10).forEach(r => { T(M, y - 10, r.text, 'H', 10, [0.3, 0.3, 0.3]); y -= 14; }); }
    wrapRow({ text: 'Ablauf: ' + ls.order, chords: [] }, maxW, 10).forEach(r => { T(M, y - 10, r.text, 'H', 10, [0.3, 0.3, 0.3]); y -= 14; });
    y -= 6; Ln(M, y, PW - M, [0.2, 0.2, 0.2]); y -= 14;
    const CS = 10.5, TS = 11.5, ACC = [0.75, 0.25, 0.05];
    ls.sections.forEach(s => {
      const rows = s.rows ? [].concat(...s.rows.map(r => r.text ? wrapRow(r, maxW, TS) : [r])) : [];
      const h = 22 + (s.grid ? 18 : 0) + rows.reduce((a, r) => a + (r.text ? (r.chords.length ? 28 : 16) : 8), 0);
      need(Math.min(h, 22 + 3 * 28)); // Überschrift nie allein unten
      T(M, y - 12, s.head, 'B', 12.5, [0.1, 0.2, 0.45]);
      if (s.chordLine && !s.same) { const w = width(s.chordLine, 'H', 9); T(PW - M - w, y - 12, s.chordLine, 'H', 9, [0.5, 0.5, 0.5]); }
      y -= 22;
      if (s.grid) {
        need(18); let x = M; const bw = Math.min(110, maxW / Math.min(8, s.grid.length));
        s.grid.forEach((b, i) => { if (i && i % 8 === 0) { y -= 18; need(18); x = M; } T(x, y - 11, '|', 'H', 11, [0.6, 0.6, 0.6]); T(x + 8, y - 11, b, 'B', CS, ACC); x += bw; });
        T(x, y - 11, '|', 'H', 11, [0.6, 0.6, 0.6]); y -= 22;
      }
      rows.forEach(r => {
        if (!r.text && !r.chords.length) { y -= 8; return; }
        need(r.chords.length ? 28 : 16);
        if (r.chords.length) {
          let end = -1e9;
          r.chords.forEach(c => { let x = M + width(r.text.slice(0, c.i), 'H', TS); x = Math.max(x, end + 5); T(x, y - 10, c.n, 'B', CS, ACC); end = x + width(c.n, 'B', CS); });
          y -= 12;
        }
        if (r.text) T(M, y - 12, r.text, 'H', TS);
        y -= 16;
      });
      y -= 8;
    });
    pages.push(ops);
    // Datei zusammensetzen
    const objs = [], add = s => { objs.push(s); return objs.length; };
    const cat = add(''), pgs = add(''), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = pages.map(o => { const st = o.join('\n'); const c = add('<< /Length ' + st.length + ' >>\nstream\n' + st + '\nendstream'); return add('<< /Type /Page /Parent ' + pgs + ' 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /Font << /H ' + f1 + ' 0 R /B ' + f2 + ' 0 R >> >> /Contents ' + c + ' 0 R >>'); });
    objs[cat - 1] = '<< /Type /Catalog /Pages ' + pgs + ' 0 R >>';
    objs[pgs - 1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
    const info = add('<< /Title ' + pstr(ls.title) + ' /Producer (3nps) >>');
    let out = '%PDF-1.4\n', offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
    return { bytes, pages: pages.length };
  }
  return { build, width, codes };
})();
if (typeof window !== 'undefined') window.LiedPdf = LiedPdf;
if (typeof module !== 'undefined') module.exports = LiedPdf;
