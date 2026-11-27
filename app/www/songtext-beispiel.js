/* ---------- v166: Durchgehendes Beispiel „von Anfang bis Ende“ für Lernen › Songtext schreiben ----------
   Erst geladen, wenn man „Beispiel ansehen“ oder „So sieht das im Beispiel aus“ antippt (songtext.js exLoad); in der Offline-Liste von sw.js.
   Ein komplett erfundener Song (kein Bezug zu echten Liedern, Künstlern oder Titeln) – an ihm werden alle 11 Schritte mit echtem Zwischenstand
   vorgeführt, auch Verworfenes und Vorher/Nachher. Akkordfolgen und Begründungen stammen aus „Akkorde nach Stimmung“ der Text-Werkstatt v164
   (TextWerk.suggest in a-Moll), die Reime sind mit deren Reim-Prüfung abgeglichen (test/v166beispiel.py).
   Der Song-Text selbst bleibt deutsch; die Oberfläche (Knöpfe, Überschriften) ist zweisprachig.
   „Beispiel als Song laden“ (songtext.js) liest code(true) = Rohfassung (Stand nach Schritt 9) und code(false) = fertige Fassung über LiedText.fromCode. */
(function () {
  const TITLE = 'Die erste Bahn zurück', KEY = 'a-Moll', BPM = 84;
  const KERN = 'Sie kommt nach der Nachtschicht in der Bäckerei heim, wenn ihr Freund gerade zur Arbeit fährt – bis sie eines Morgens früher aussteigt und auf ihn wartet.';
  const HOOK = 'Die erste Bahn zurück';
  const WF_T = 'Nachtschicht, Heimweg, erste Bahn';
  // Wortfeld je Sinn; ✓ = hat es in den Text geschafft
  const WF = [
    ['sehen', [['Mehl im Haar', 1], ['Rücklichter', 0], ['volle Gegenbahn', 0], ['Zettel', 1], ['Jacke an der Garderobe', 1]]],
    ['hören', [['Summen am Werkstor', 1], ['Türpiepen der Bahn', 0], ['Wecker nebenan', 0]]],
    ['riechen', [['warmes Brot', 1], ['Kaffee', 1], ['nasser Asphalt', 0]]],
    ['fühlen', [['warme Hände vom Ofen', 1], ['kalter Haltegriff', 0], ['Sand in den Augen', 0]]],
    ['schmecken', [['Kruste', 0], ['lauwarmer Kaffee', 1]]],
    ['Dinge & Erinnerungen', [['seit einem Jahr Nachtschicht', 1], ['Zettel statt Gespräche', 1], ['sein Bus um 6:10', 1], ['Bordstein vor dem Haus', 1]]]
  ];
  // Fertiger Text, Akkorde direkt über der Silbe, auf der sie wechseln (betonte Silbe auf Schlag 1). Je Zeile 2 Takte à 4/4.
  const S1 = ['Um [Am]fünf fällt hinter [C]mir das Tor', 'noch [G]warm vom Ofen, [Dm]Mehl im Haar', 'die [Am]Straßen gähnen [C]sich was vor', 'so [G]geht das jetzt seit [Dm]einem Jahr'];
  const S2 = ['Die [Am]Jacke weg, dein [C]Brot am Tisch', 'ein [G]Zettel sagt: „Bis [Dm]heute Nacht“', 'die [Am]Tasse warm, der [C]Kaffee frisch', 'der [G]eine schläft, der [Dm]andre wacht'];
  const R = ['Ich [F]nehm die erste [C]Bahn zurück', 'vom [G]Morgen seh ich [Am]nur ein Stück', 'die [F]Stadt fährt rein, ich [C]fahre raus', 'und [G]trag ihn müde [Am]mit nach Haus'];
  const B = ['Heut [Dm]steig ich früher aus', 'zwei [F]Brötchen in der Hand', 'ich [C]wart an deinem Bus', '[E]Frühstück am Bordsteinrand'];
  const RS = ['Die [F]erste Bahn fährt [C]leer zurück', 'vom [G]Morgen kriegen [Am]wir ein Stück', 'die [F]Stadt fährt rein, wir [G]steigen aus', 'und [C]tragen ihn zu zweit nach Haus'];
  // Teile: Name, Typ (Song-Code), Akkorde je Takt, Texte (1. und 2. Mal), Stimmung + Begründung aus „Akkorde nach Stimmung“
  const PARTS = [
    { n: 'Strophe', y: 'Strophe', ch: 'Am C G Dm Am C G Dm', t: [S1, S2], r: 'ABAB' },
    { n: 'Refrain', y: 'Refrain', ch: 'F C G Am F C G Am', t: [R], r: 'AABB' },
    { n: 'Bridge', y: 'Bridge', ch: 'Dm:2 F:2 C:2 E:2', t: [B], r: 'XAXA' },
    { n: 'Schluss-Refrain', y: 'Refrain', ch: 'F C G Am F G C:2', t: [RS], r: 'AABB' }
  ];
  const ORDER = ['Strophe', 'Refrain', 'Strophe', 'Refrain', 'Bridge', 'Schluss-Refrain'];
  // Schritt 10: Vorher → Nachher (Teil, Text-Nr., Zeile, vorher, nachher, warum). Die Rohfassung (Version 1) enthält die Vorher-Zeilen.
  const VN = [
    ['Strophe', 0, 2, 'die ganze Stadt ist müde so wie ich', 'die [Am]Straßen gähnen [C]sich was vor',
      'Bild statt Behauptung (gähnende Straßen statt „müde“), reimt jetzt rein auf „Tor“, 8 statt 10 Silben.'],
    ['Strophe', 1, 3, 'wir sehen uns halt eigentlich fast nie', 'der [G]eine schläft, der [Dm]andre wacht',
      'Füllwörter „halt“ und „eigentlich“ raus (die Reim-Prüfung hat sie angemerkt); zeigt den Grund statt nur das Ergebnis; reimt auf „Nacht“.'],
    ['Refrain', 0, 3, 'und nehm ihn müde mit nach Haus', 'und [G]trag ihn müde [Am]mit nach Haus',
      '„nehm“ stand schon in Zeile 1 – fällt erst beim lauten Lesen auf. „Tragen“ ist körperlicher und bereitet den Schluss vor („tragen ihn zu zweit“).'],
    ['Bridge', 0, 3, 'dann sind wir endlich mal zusammen', '[E]Frühstück am Bordsteinrand',
      'Ein Bild statt des Gefühlsworts, 6 Silben wie die anderen Bridge-Zeilen (vorher 9 – die Prüfung meldete „wird eng“), reimt auf „Hand“. Die Zeile beginnt ohne Auftakt direkt auf der Eins: die Wendung ist auch im Rhythmus zu spüren.']
  ];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const strip = s => String(s).replace(/\[[^\]]*\]/g, '');
  // Song-Code (Format aus lied-text.js); rough = Rohfassung mit den Vorher-Zeilen aus Schritt 10
  function code(rough) {
    const out = ['=== 3NPS SONG-CODE v1 ===', 'Titel: ' + TITLE, 'Tonart: ' + KEY, 'Tempo: ' + BPM, 'Thema: ' + KERN, 'Ablauf: ' + ORDER.join(' | ')];
    PARTS.forEach(p => {
      out.push('', '## ' + p.n + ' [' + p.y + ']', 'Akkorde: ' + p.ch);
      p.t.forEach((L, i) => {
        const lines = L.slice();
        if (rough) VN.forEach(v => { if (v[0] === p.n && v[1] === i) lines[v[2]] = v[3]; });
        out.push('Text ' + (i + 1) + ':'); lines.forEach(l => out.push(l));
      });
    });
    out.push('', 'Notiz:', rough ? 'Rohfassung (Stand nach Schritt 9)' : 'Fertig (nach Schritt 10)', '=== ENDE ===');
    return out.join('\n');
  }
  // Akkorde über dem Text (Monospace): „Um [Am]fünf …“ → zwei Zeilen
  function chordLine(raw) {
    let top = '', text = '';
    String(raw).replace(/\[([^\]]*)\]|([^[]+)/g, (m, c, t) => {
      if (c != null) { if (top.length > text.length) text += ' '.repeat(top.length - text.length + 1); top += ' '.repeat(Math.max(0, text.length - top.length)) + c; }
      else text += t;
      return '';
    });
    return '<span class="stb-c">' + esc(top || ' ') + '</span>\n<span>' + esc(text) + '</span>';
  }
  const sheet = (name, L) => '<div class="stb-sheet"><b>[' + esc(name) + ']</b><pre>' + L.map(chordLine).join('\n') + '</pre></div>';
  const plain = (L, mark) => '<div class="stb-lines">' + L.map((l, i) => '<p' + (mark && mark.includes(i) ? ' class="stb-m"' : '') + '>' + esc(strip(l)) + (mark && mark.includes(i) ? ' <small>' + esc(mark.note || '') + '</small>' : '') + '</p>').join('') + '</div>';
  const bad = (t, why) => '<div class="stb-x"><span class="stb-k">✗</span><div><b>' + esc(t) + '</b><p>' + esc(why) + '</p></div></div>';
  const good = (t, why) => '<div class="stb-ok"><span class="stb-k">✓</span><div><b>' + esc(t) + '</b><p>' + esc(why) + '</p></div></div>';
  const vn = (a, b, why, lab) => '<div class="stb-vn">' + (lab ? '<p class="caption">' + esc(lab) + '</p>' : '') + '<p class="stb-v"><span>vorher</span> ' + esc(strip(a)) + '</p><p class="stb-n"><span>nachher</span> ' + esc(strip(b)) + '</p><p class="stb-w">' + esc(why) + '</p></div>';
  const p = t => '<p>' + t + '</p>';
  const h = t => '<h4>' + esc(t) + '</h4>';
  const tbl = (head, rows) => '<div class="stb-tw"><table class="stb-t"><thead><tr>' + head.map(x => '<th>' + esc(x) + '</th>').join('') + '</tr></thead><tbody>'
    + rows.map(r => '<tr>' + r.map((x, i) => '<td' + (i === 0 ? ' class="stb-l"' : '') + '>' + x + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  const mk = mk0 => { const m = mk0.slice(0, -1); m.note = mk0[mk0.length - 1]; return m; };
  const roughS1 = S1.slice(), roughS2 = S2.slice(), roughR = R.slice(), roughB = B.slice();
  roughS1[2] = VN[0][3]; roughS2[3] = VN[1][3]; roughR[3] = VN[2][3]; roughB[3] = VN[3][3];
  const L10 = '→ Schritt 10';

  // Inhalt je Schritt (1–11) – Zwischenstand genau an dieser Stelle
  const STEP = [
    () => p('Ausgangspunkt war ein Bild aus dem Ideen-Notizbuch: <i>„Mehl am Ärmel in der ersten Bahn“</i>. Der Kernsatz brauchte drei Anläufe:')
      + bad('Ein Song über Schichtarbeit.', 'Zu allgemein – wer, wo, wann? Daraus entsteht kein Bild.')
      + bad('Nachtschicht ist hart, und die Liebe leidet darunter.', 'Besser, aber nur Behauptungen – und es passiert nichts.')
      + good(KERN, 'Person, Ort, Zeit und eine Wendung – in einem Atemzug erzählbar.')
      + p('Der Satz kommt als Thema in den Song („Als Thema in den Song“). Im Text selbst steht er nicht – er ist der Kompass für jede Zeile.'),
    () => p('Zehn Minuten Titel gesammelt, ohne zu werten. Vier blieben in der engeren Wahl:')
      + bad('Mehl im Haar', 'Starkes Bild, aber nur ein Detail – erzählt nicht, worum es geht. Wandert in Strophe 1.')
      + bad('Gegenverkehr', 'Trifft das Gegeneinander, klingt aber nach Verkehrsfunk – kalt und schwer warm zu singen.')
      + bad('Der eine schläft, der andre wacht', 'Schöne Zeile, als Titel zu lang. Wird die Schlusszeile von Strophe 2.')
      + good(HOOK, 'Konkretes Bild mit Richtung: alle fahren hin, sie fährt zurück. Lässt sich im letzten Refrain umdrehen („fährt leer zurück“). Betont auf ER-ste und zu-RÜCK – gut zu singen.')
      + p('Hook = erste Zeile des Refrains: <b>„Ich nehm die erste Bahn zurück“</b>.'),
    () => p('Thema des Wortfelds: <b>' + esc(WF_T) + '</b>. Je Sinn ein paar Einträge, dazu Dinge und Erinnerungen. ✓ = hat es in den Text geschafft – etwa die Hälfte, das ist normal.')
      + '<div class="stb-wf">' + WF.map(([s, w]) => '<div><b>' + esc(s) + '</b><p>' + w.map(([x, u]) => esc(x) + (u ? ' <span class="stb-u">✓</span>' : '')).join(' · ') + '</p></div>').join('') + '</div>'
      + p('Tipp aus dem Wortfeld: „Tor“ und „Hand“ antippen zeigt Reimwörter – so kamen „vor“ und „Rand“ (Bordsteinrand) ins Spiel.'),
    () => p('Gewählt: Vorlage <b>„Mit Bridge“</b> – Strophe (4 Zeilen · ABAB) · Refrain (4 · AABB) · Bridge (4 · XAXA).')
      + p('<b>Ablauf:</b> Strophe 1 → Refrain → Strophe 2 → Refrain → Bridge → Schluss-Refrain')
      + p('Eine Änderung an der Vorlage: Der letzte Refrain wird ein eigener Abschnitt „Schluss-Refrain“, weil er anderen Text und am Ende andere Akkorde bekommt.')
      + bad('Strophe – Refrain', 'Ohne Bridge gäbe es keinen Ort für die Wendung – der Song würde nur den Zustand beschreiben.')
      + bad('12-Takt-Blues (AAB)', 'Passt zum Klagen, aber die Form wiederholt Zeilen; hier soll sich etwas verändern.'),
    () => p('Rohfassung nach 15 Minuten – der Hook steht vorn, der Rest erzählt die Lage in vier Zeilen:')
      + plain(['Ich nehm die erste Bahn zurück', 'vom Morgen seh ich nur ein Stück', 'die andern fahren rein, ich fahr hinaus', 'und nehm ihn müde mit nach Haus'], mk([2, '(10 Silben)']))
      + vn('die andern fahren rein, ich fahr hinaus', 'die Stadt fährt rein, ich fahre raus', '„Die Stadt“ ist ein Bild statt einer Menge; 8 Silben wie die anderen; „rein/raus“ als klarer Gegensatz.', 'Sofort korrigiert – Zeile 3 war auf dieselbe Melodie zu eng:')
      + p('Stand nach Schritt 5:') + plain(roughR, mk([3, '(„nehm“ doppelt – fällt erst in Schritt 10 auf)'])),
    () => h('Strophe 1 – stellt die Lage vor') + p('Wer, wann, wie lange. Keine Gefühlswörter, nur Dinge: Tor, Ofen, Mehl, ein Jahr.')
      + plain(roughS1, mk([2, L10]))
      + h('Strophe 2 – bringt Neues') + p('Jetzt gibt es einen Menschen, den sie verpasst – gezeigt über Spuren: Jacke weg, Brot, Zettel, warme Tasse. „Warm“ kommt bewusst wieder: sie warm vom Ofen, seine Tasse noch warm – zwei Wärmen, die sich nicht treffen.')
      + plain(roughS2, mk([3, L10]))
      + bad('Die Bahn ist voll, die Bahn ist leer / ich bin so müde, mir fällt es schwer', 'Verworfene Idee für Strophe 2: wiederholt nur Strophe 1 und den Refrain, dazu Behauptung („müde“) statt Bild.'),
    () => p('Bis hier beschreibt der Song einen Zustand. Die Bridge ist der Moment, in dem sie handelt: aus „ich“ wird „ich und du“, die Zeilen werden kürzer (6 statt 8 Silben), die Akkorde wechseln seltener.')
      + plain(roughB, mk([3, L10]))
      + p('Zeile 1 und 3 reimen bewusst nicht (Vorlage XAXA) – die Bridge soll anders klingen als der Rest.')
      + bad('Ich kündige und such mir einen Job am Tag', 'Zu groß und zu vernünftig – löst das Problem wie ein Ratgeber. Eine kleine Geste zeigt mehr.')
      + h('Der Schluss-Refrain trägt die Wendung') + p('Dieselben Reimwörter, neue Bedeutung:')
      + vn('Ich nehm die erste Bahn zurück', RS[0], 'Sie sitzt nicht mehr drin – die Bahn fährt ohne sie.')
      + vn('vom Morgen seh ich nur ein Stück', RS[1], 'Aus „ich seh“ wird „wir kriegen“.')
      + vn('die Stadt fährt rein, ich fahre raus', RS[2], 'Beide steigen aus – aus der Bahn und aus dem Takt der Stadt.')
      + vn('und nehm ihn müde mit nach Haus', RS[3], 'Aus „müde“ wird „zu zweit“.'),
    () => p('Tonart <b>a-Moll</b>: nur offene Griffe (Am, C, G, Dm, F, E), kein Kapodaster. Tempo <b>84 BPM</b> – ruhiges Gehen, wie der Heimweg nach der Schicht.')
      + p('In der Text-Werkstatt unter „Akkorde nach Stimmung“ eingegeben: <i>„Strophe melancholisch, Refrain sehnsüchtig, Bridge Kontrast“</i>, danach für den Schluss <i>„Refrain hoffnungsvoll, Spannung löst sich“</i>. Gewählt aus den Vorschlägen:')
      + tbl(['Abschnitt', 'Stimmung', 'Akkorde', 'Begründung der Werkstatt', 'Warum genau diese'], [
        ['Strophe', 'melancholisch', '<b>Am C G Dm</b> ×2<br><small>i III VII iv</small>', '„Moll mit Dur-Parallele III – Erinnerung mit Licht und Schatten.“', 'Zweiter Vorschlag. Der erste (Am F C G) ist fast der Refrain – dann gäbe es keinen Kontrast.'],
        ['Refrain', 'sehnsüchtig', '<b>F C G Am</b> ×2<br><small>IV I V vi (über C-Dur)</small>', '„Beginnt auf IV (offen) und endet auf vi – Sehnen ohne Ankommen.“', 'Hellere Farbe als die Strophe, endet trotzdem auf Am – sie kommt nicht an, genau wie im Text.'],
        ['Bridge', 'Kontrast', '<b>Dm F C E</b><br><small>iv VI III V · je 2 Takte</small>', '„Startet auf der Subdominante (öffnet) und endet auf V – führt zurück in den Refrain.“', 'Halb so viele Wechsel = mehr Luft. Das E zieht in den Schluss-Refrain.'],
        ['Schluss-Refrain', 'hoffnungsvoll · löst sich', '<b>F C G Am · F G C</b><br><small>2. Hälfte VI VII III</small>', '„Dur-Ziel im Moll: VI–VII führen zur Dur-Parallele III – das Dunkle hellt auf.“', 'Erste Hälfte wie der Refrain, dann endet der Song auf C statt Am: er kommt an.']])
      + bad('C Em F Fm (erster Vorschlag für „sehnsüchtig“)', 'Klingt schön, aber das Fm ist ein Barré-Griff und für diesen Refrain zu weich.'),
    () => p('Raster: 4/4, jede Zeile <b>2 Takte</b>, ein Akkord je Takt (Bridge: einer je Zeile). GROSS = betonte Silbe; die betonten Silben fallen auf Schlag 1 und 3. Der Akkord wechselt auf der betonten Silbe.')
      + tbl(['Zeile', 'Silben', 'Betonung'], [
        ['Strophe 1', '8', 'um FÜNF fällt HIN-ter MIR das TOR'], ['', '8', 'noch WARM vom O-fen, MEHL im HAAR'],
        ['', '<b>10</b>', 'die GAN-ze STADT ist MÜ-de SO wie ICH <small>– passt nicht ins Raster, „so“ landet auf der Eins ' + L10 + '</small>'],
        ['', '8', 'so GEHT das JETZT seit EI-nem JAHR'],
        ['Refrain', '8', 'ich NEHM die ER-ste BAHN zu-RÜCK'], ['', '8', 'vom MOR-gen SEH ich NUR ein STÜCK'], ['', '8', 'die STADT fährt REIN, ich FAH-re RAUS'], ['', '8', 'und NEHM ihn MÜ-de MIT nach HAUS'],
        ['Strophe 2', '8 · 8 · 8', 'gleiches Muster wie Strophe 1 – parallele Zeilen, gleiche Melodie'],
        ['Bridge', '6', 'heut STEIG ich FRÜ-her AUS <small>– 3 Betonungen auf 2 Takte, das letzte Wort klingt aus</small>'],
        ['', '<b>9</b>', 'dann SIND wir END-lich MAL zu-SAM-men <small>– zu viel für die kurze Bridge-Melodie ' + L10 + '</small>']])
      + p('Strophe und Refrain haben gleich viele Silben – der Kontrast kommt aus Tonhöhe und Akkorden: Strophe tief und fast gesprochen, Refrain höher, das letzte Wort jeder Refrain-Zeile lang gehalten.')
      + p('Kleiner Kompromiss, der bleibt: In „die Straßen gähnen <u>sich</u> was vor“ fällt das kleine Wort „sich“ auf die Eins – leicht angesungen klingt es wie ein Augenzwinkern.')
      + p('Probesingen: Strophen- und Refrain-Akkorde als Schleife im Looper (Knopf „Looper ›“), einmal aufnehmen und anhören.'),
    () => p('Laut gelesen, mit „Reime prüfen“ der Text-Werkstatt geprüft und vier Zeilen ersetzt. Die Prüfung zeigte vorher: Strophe 1 <b>ABCB</b> (Zeile 1 und 3 ohne Reim), Strophe 2 <b>ABAC</b> mit dem Hinweis auf „halt“ und „eigentlich“, Bridge <b>ABCD</b> mit „Zeile 4 hat 9 Silben, die anderen meist 6“. Den doppelten „nehm“ im Refrain findet keine Prüfung – nur das eigene Ohr.')
      + VN.map(v => vn(v[3], v[4], v[5], v[0] + (v[0] === 'Strophe' ? ' ' + (v[1] + 1) : '') + ', Zeile ' + (v[2] + 1))).join('')
      + p('Nachher: Strophe 1 und 2 <b>ABAB</b>, Refrain und Schluss-Refrain <b>AABB</b>, alle Reime rein. In der Bridge zeigt die Prüfung <b>ABCB</b> – Zeile 1 und 3 (aus/Bus) sind ohne Reim, das ist die gewollte XAXA-Form.')
      + p('Als Song geladen sind beide Stände da: <b>V1 Rohfassung</b> (vor Schritt 10) und <b>V2 fertig</b> – im Songwriting mit „Version“ umschalten.'),
    () => '<div class="stb-ck">' + [
        ['Die Kernaussage passt in einen Satz.', 'Schritt 1'], ['Titel/Hook steht im Refrain.', 'erste Refrain-Zeile, im Schluss umgedreht'],
        ['Jede Strophe bringt etwas Neues.', 'Strophe 1: sie und die Schicht · Strophe 2: er und seine Spuren · Bridge: sie handelt'],
        ['Perspektive und Zeitform sind durchgehalten.', 'Ich-Erzählerin, Gegenwart; ab der Bridge „wir“ – gewollt'],
        ['Singbar: betonte Silben auf betonten Schlägen, genug Luft.', '8 · 8 · 6 Silben, Betonung auf 1 und 3'],
        ['Nichts doppelt, keine Füllzeilen.', '„nehm“ ersetzt, Füllwörter raus'], ['Einmal ganz zur Begleitung gesungen.', 'zur Schleife im Looper']
      ].map(([a, b]) => '<p><span class="stb-u">✓</span> ' + esc(a) + ' <small>' + esc(b) + '</small></p>').join('') + '</div>'
      + h('Fertiger Text mit Akkorden') + p(esc(KEY) + ' · ' + BPM + ' BPM · 4/4 · je Zeile 2 Takte')
      + sheet('Strophe 1', S1) + sheet('Refrain', R) + sheet('Strophe 2', S2) + sheet('Refrain', R) + sheet('Bridge', B) + sheet('Schluss-Refrain', RS)
      + p('Weiter: „Leadsheet (PDF)“, „Ins Songbook übernehmen“ und „Mitsingen lernen“ – mit dem geladenen Beispiel-Song ausprobieren.')
  ];
  const META = { title: TITLE, key: KEY, bpm: BPM, kern: KERN, hook: HOOK, wfT: WF_T, wf: WF.reduce((a, x) => a.concat(x[1].map(y => y[0])), []).slice(0, 30), order: ORDER };
  const API = { META, PARTS, ORDER, VN, code, step: n => STEP[n - 1] ? STEP[n - 1]() : '', steps: STEP.length, text: () => ({ S1, S2, R, B, RS }) };
  if (typeof window !== 'undefined') window.SongtextBeispiel = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
