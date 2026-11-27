/* ---------- v165: Songtext schreiben – seit v167 Teil von Song & Gesang › Songwriting (Bereiche „Workflow“, „Leitfaden & Beispiel“, „Ideen“) ----------
   v167: Der Song kommt aus der Songauswahl des Songwritings (LiedApi.song()); die eigene Songwahl ist ausgeblendet, Haken bleiben an derselben Song-Id.
   Geladen von songwriting.js (SW); Bereichswechsel über SW.area/SW.mark.
   Wird erst beim ersten Öffnen geladen (lernen.js lädt mitsingen.css + songtext.css/.js). Drei Bereiche:
   „Workflow“ – Fahrplan in 11 Schritten mit Haken je Song (gleiches Gerüst und dieselben Klassen msl-… wie „Mitsingen lernen“ v163; mitsingen.js
   bleibt unverändert), rechts der Schritt mit „So geht’s“, „Warum“, Tipps, Helfer (Kernsatz, Titel/Hook, Wortfeld-Sammler, Aufbau-Vorlagen,
   Checkliste) und Knöpfen zum passenden Werkzeug; „Leitfaden“ – aufklappbare Grundlagen mit erfundenen Mini-Beispielen; „Ideen-Notizbuch“ –
   Zeilen/Titel/Bilder/Ideen mit Schlagworten, Suche, „In Song …“ (hängt als neue Version an, überschreibt nichts), Export/Import, Schreibimpulse.
   Songs kommen aus dem Songwriting (LiedApi, lied.js): Vorlagen legen Abschnitte nur in einem leeren Song oder als neue Version an.
   Reimwörter über die Text-Werkstatt v164 (TextWerk.loadList/rhymesFor, Liste erst bei Bedarf). Zählt keine Übezeit.
   Speicher: localStorage „3nps-songtext“ – EIN Schlüssel:
     { v: 1, cur: Song-Schlüssel 'l:<Song-id>' | '_' (ohne Song), view: 'wf'|'lf'|'nb',
       p: { Schlüssel: { n: Name, d: [geschaffte Schritte], s: gezeigter Schritt, k: Kernsatz, h: Titel/Hook, wf: { t: Thema, w: [Wörter] }, c: [Checkliste], e } },
       n: [{ id, x: Text, k: 'z'|'t'|'b'|'i', g: [Schlagworte], at }] }
   „Alles sichern“ (App-Sicherung) nimmt den Schlüssel mit (alle „3nps-…“-Schlüssel); dazu eigener Export als JSON („3nps-songtext“). */
window.Songtext = (() => {
  const KEY = '3nps-songtext', SBKEY = '3nps-songbook', MSKEY = '3nps-mitsingen', $ = id => document.getElementById(id);
  const EN = () => window.__lang === 'en';
  const tx = a => Array.isArray(a) ? (EN() && a[1] ? a[1] : a[0]) : String(a == null ? '' : a);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LA = () => window.LiedApi || null, LC = () => window.LiedCore || null;
  const NAV = n => { if (window.AppNav) AppNav.show(n); };

  /* ---------- Oberflächentexte ---------- */
  const U = {
    title: ['Songtext schreiben', 'Write lyrics'], wf: ['Workflow', 'Workflow'], lf: ['Leitfaden', 'Guide'], nb: ['Ideen-Notizbuch', 'Idea notebook'],
    song: ['Song', 'Song'], pick: ['Song wählen', 'Choose song'], none: ['– ohne Song (allgemein) –', '– no song (general) –'], newOpt: ['＋ Neuer Song …', '＋ New song …'],
    newN: ['Name des Songs', 'Song name'], create: ['Anlegen', 'Create'], cancel: ['Abbrechen', 'Cancel'], of: ['von', 'of'],
    planNote: ['Haken gelten je Song. Jeder Schritt lässt sich frei antippen. Die Seite zählt keine Übezeit.', 'Ticks are kept per song. Every step can be opened freely. This page does not count practice time.'],
    step: ['Schritt', 'Step'], so: ['So geht’s:', 'How:'], why: ['Warum:', 'Why:'], tips: ['Tipps zu diesem Schritt', 'Tips for this step'],
    done: ['✓ Schritt geschafft', '✓ Step done'], undone: ['✓ Geschafft – zurücknehmen', '✓ Done – undo'], next: ['Nächster Schritt ›', 'Next step ›'], tick: ['Abgehakt.', 'Ticked.'],
    tipH: ['Tipps', 'Tips'], okH: ['Woran merke ich, dass es passt?', 'How do I know it works?'],
    meta0: ['Ohne Song: Haken, Kernsatz und Wortfeld gelten allgemein. Für Vorlagen und Werkzeuge einen Song wählen oder anlegen.', 'Without a song: ticks, core sentence and word field are general. Choose or create a song for templates and tools.'],
    parts: ['Abschnitte', 'sections'], noParts0: ['noch keine Abschnitte', 'no sections yet'], ver: ['Version', 'version'],
    pickSong: ['Wähle zuerst links einen Song (oder lege einen an) – dann öffnet sich das Werkzeug mit dem richtigen Song.', 'Choose a song on the left first (or create one) – then the tool opens with the right song.'],
    noParts: ['Der Song hat noch keine Abschnitte – leg sie in Schritt 4 mit einer Aufbau-Vorlage an.', 'The song has no sections yet – create them in step 4 with a structure template.'],
    noLied: ['Das Songwriting ist nicht verfügbar.', 'Songwriting is not available.'], toStep4: ['Zu Schritt 4', 'Go to step 4'],
    nosave: ['Konnte nicht speichern – Speicher voll oder privates Surfen.', 'Could not save – storage full or private browsing.'],
    kern: ['Kernsatz – worum geht es, in einem Satz?', 'Core sentence – what is it about, in one sentence?'],
    kernPh: ['z. B. Sie räumt seine Tasse weg und merkt, dass sie nicht mehr wartet.', 'e.g. She puts his cup away and notices she is no longer waiting.'],
    kern2: ['Als Thema in den Song', 'Use as song theme'], dice: ['🎲 Schreibimpuls', '🎲 Writing prompt'], diceAgain: ['🎲 Würfeln', '🎲 Roll'], diceSave: ['Als Idee notieren', 'Save as idea'],
    themeSet: ['Kernsatz als Thema im Song gespeichert (Songwriting › Text › Thema).', 'Core sentence saved as song theme (Songwriting › Lyrics › Theme).'],
    themeQ: ['Der Song hat schon ein Thema:\n\n„%s“\n\nDurch den Kernsatz ersetzen?', 'The song already has a theme:\n\n“%s”\n\nReplace it with the core sentence?'],
    themeNo: ['Erst einen Kernsatz schreiben.', 'Write a core sentence first.'],
    hook: ['Titel / Hook', 'Title / hook'], hookPh: ['z. B. Licht im Treppenhaus', 'e.g. Light in the stairwell'],
    hook2nb: ['Ins Notizbuch (als Titel)', 'To notebook (as title)'], nbTitles: ['Titel-Ideen im Notizbuch', 'Title ideas in notebook'], fromNb: ['Aus dem Notizbuch:', 'From the notebook:'],
    saved: ['Im Notizbuch gespeichert.', 'Saved in the notebook.'], empty: ['Erst etwas eintragen.', 'Enter something first.'],
    wfT: ['Thema des Wortfelds', 'Word field topic'], wfTPh: ['z. B. Umzug, Nacht, Bahnhof', 'e.g. moving out, night, station'], wfIn: ['Wort oder Bild hinzufügen', 'Add word or image'],
    wfInPh: ['z. B. Kartons, Echo im Flur (Komma trennt)', 'e.g. boxes, echo in the hall (comma separates)'], add: ['Hinzufügen', 'Add'],
    wfSense: ['Je Sinn zwei Einträge: sehen · hören · riechen · fühlen · schmecken. Wort antippen = Reimwörter.', 'Two entries per sense: see · hear · smell · feel · taste. Tap a word = rhyme words.'],
    wfNone: ['Noch leer – sammle 20 Wörter, Dinge und Erinnerungen.', 'Still empty – collect 20 words, things and memories.'], words: ['Einträge', 'entries'],
    rhLoad: ['Lade Reimwörter … (beim ersten Mal ≈ 0,4 MB, danach offline)', 'Loading rhyme words … (first time ≈ 0.4 MB, then offline)'],
    rhFail: ['Reimwörter konnten nicht geladen werden – bitte einmal mit Internet öffnen.', 'Rhyme words could not be loaded – please open once with internet.'],
    rhH: ['Reimwörter zu', 'Rhyme words for'], rhRein: ['rein', 'perfect'], rhUnrein: ['~ unrein', '~ slant'], rhNone: ['Keine Reimwörter gefunden.', 'No rhyme words found.'],
    rhTap: ['Antippen nimmt das Wort ins Wortfeld.', 'Tap to add the word to the field.'], rhDe: ['(Reimliste nur Deutsch)', '(rhyme list German only)'], del: ['entfernen', 'remove'],
    tplH: ['Aufbau-Vorlage wählen', 'Choose a structure template'], tplNew: ['Neuen Song mit dieser Vorlage anlegen', 'Create a new song with this template'],
    tplFill: ['Abschnitte im Song anlegen', 'Create sections in the song'], tplVer: ['Als neue Version anlegen', 'Create as new version'],
    tplVerN: ['Der Song hat schon Abschnitte – die Vorlage wird eine neue Version (bisherige bleibt unter „Version“ erhalten).', 'The song already has sections – the template becomes a new version (the previous one stays under “Version”).'],
    tplFillN: ['Der Song ist noch leer – die Abschnitte kommen direkt hinein.', 'The song is still empty – the sections go straight in.'],
    tplNewN: ['Ohne Song: es entsteht ein neuer Song im Songwriting.', 'No song selected: a new song is created in Songwriting.'],
    tplName: ['Name des neuen Songs', 'Name of the new song'], tplAkk: ['Akkorde sind Platzhalter (Schritt 8 passt sie an).', 'Chords are placeholders (step 8 adjusts them).'],
    tplOk: ['Angelegt: %n Abschnitte (%p) in „%s“ – %v.', 'Created: %n sections (%p) in “%s” – %v.'], lines: ['Zeilen', 'lines'], rhyme: ['Reim', 'rhyme'],
    newSongDef: ['Neuer Song', 'New song'], vNew: ['neue Version V', 'new version V'], vSame: ['V', 'V'],
    chkH: ['Ist der Song fertig?', 'Is the song finished?'], chkHook: ['Titel/Hook im Refrain:', 'Title/hook in chorus:'], yes: ['gefunden', 'found'], no: ['nicht gefunden', 'not found'],
    chkFill: ['Abschnitte mit Text:', 'Sections with lyrics:'], chkAll: ['Alles abgehakt – Leadsheet, Songbook, Mitsingen lernen!', 'All ticked – lead sheet, songbook, learn to sing along!'],
    sbUpd: ['Dieser Song steht schon im Songbook. Titel, Tonart, Tempo und „Akkorde & Text“ dort aktualisieren?', 'This song is already in the songbook. Update title, key, tempo and “Chords & lyrics” there?'],
    sbOk: ['Im Songbook: „%s“.', 'In songbook: “%s”.'],
    nbIn: ['Zeile, Titel, Bild oder Idee …', 'Line, title, image or idea …'], nbTags: ['Schlagworte, z. B. nacht, stadt', 'Tags, e.g. night, city'], nbAdd: ['＋ Notieren', '＋ Note'],
    nbQ: ['Suchen (Text oder #Schlagwort)', 'Search (text or #tag)'], all: ['alle', 'all'], nbNone: ['Noch keine Notizen – schreib oben die erste Zeile, die dir einfällt.', 'No notes yet – write the first line that comes to mind above.'],
    nbNoHit: ['Nichts gefunden.', 'Nothing found.'], nbCnt: ['Notizen', 'notes'], take: ['In Song …', 'Into song …'], delB: ['Löschen', 'Delete'],
    delQ: ['Diese Notiz löschen?\n\n„%s“', 'Delete this note?\n\n“%s”'], deleted: ['Notiz gelöscht.', 'Note deleted.'],
    tkSong: ['Song', 'Song'], tkPart: ['Abschnitt', 'Section'], tkGo: ['Anhängen (neue Version)', 'Append (new version)'], tkNew: ['Neuer Song mit diesem Titel', 'New song with this title'],
    tkNoSongs: ['Noch kein Song im Songwriting – leg einen an (links „＋ Neuer Song …“ oder Schritt 4).', 'No song in Songwriting yet – create one (“＋ New song …” on the left or step 4).'],
    tkOk: ['Angehängt an „%p“ in „%s“ – %v. Mit „Version“ kommst du zurück.', 'Appended to “%p” in “%s” – %v. “Version” takes you back.'],
    tkNewOk: ['Neuer Song „%s“ angelegt.', 'New song “%s” created.'], emptyPart: ['leer', 'empty'], times: ['. Mal', ' time'],
    exp: ['Notizbuch exportieren', 'Export notebook'], imp: ['Notizbuch importieren', 'Import notebook'],
    expOk: ['Exportiert: %n Notizen und %p Songs (Kernsatz, Wortfeld, Haken).', 'Exported: %n notes and %p songs (core sentence, word field, ticks).'],
    impBad: ['Das ist keine Notizbuch-Datei.', 'This is not a notebook file.'], impOk: ['Importiert: %a neu, %s schon vorhanden, %p Songs ergänzt.', 'Imported: %a new, %s already there, %p songs added.'],
    backup: ['Sichern: „Notizbuch exportieren“ (JSON-Datei, Teilen-Menü) – der Import fügt zusammen, ohne Doppeltes anzulegen. „Alles sichern“ im Looper nimmt das Notizbuch ebenfalls mit.', 'Backup: “Export notebook” (JSON file, share menu) – import merges without duplicates. “Back up everything” in the Looper includes the notebook too.'],
    impH: ['Schreibimpulse', 'Writing prompts'], impD: ['Würfle Thema × Perspektive × Bild und schreib zehn Minuten ohne zu streichen.', 'Roll topic × perspective × image and write for ten minutes without crossing out.'],
    dTopic: ['Thema', 'Topic'], dPersp: ['Perspektive', 'Perspective'], dImg: ['Bild', 'Image'],
    lfIntro: ['Grundlagen in Kürze – jedes Thema mit einem erfundenen Mini-Beispiel. Antippen klappt auf.', 'The basics in brief – each topic with an invented mini example. Tap to expand.'],
    lfAll: ['Alle aufklappen', 'Expand all'], lfNone: ['Alle zuklappen', 'Collapse all'], lfEx: ['Beispiel', 'Example'],
    exAll: ['📖 Beispiel ansehen', '📖 See example'], exCard: ['So sieht das im Beispiel aus', 'How it looks in the example'],
    exHead: ['Beispiel von Anfang bis Ende', 'Example from start to finish'], exSong: ['Beispiel als Song laden', 'Load example as song'], exClose: ['Beispiel schließen', 'Close example'],
    exIntro: ['Ein erfundener Song, an dem alle 11 Schritte vorgeführt werden – mit echten Zwischenständen, Verworfenem und Vorher/Nachher. „Beispiel als Song laden“ legt ihn im Songwriting als neuen Song an (nichts wird überschrieben).',
      'An invented song that walks through all 11 steps – with real in-between drafts, rejected ideas and before/after lines. “Load example as song” creates it as a new song in Songwriting (nothing is overwritten).'],
    exDe: ['', '(The example song itself is in German – it shows the German rhyme check.)'], exToStep: ['Zu Schritt %n ›', 'Go to step %n ›'],
    exWait: ['Lade Beispiel …', 'Loading example …'], exFail: ['Das Beispiel konnte nicht geladen werden – bitte einmal mit Internet öffnen.', 'The example could not be loaded – please open once with internet.'],
    exOk: ['Angelegt: „%s“ – V1 Rohfassung und V2 fertig, %n Abschnitte, %k, %b BPM. Kernsatz, Hook und Wortfeld stehen schon drin; die Haken setzt du selbst.', 'Created: “%s” – V1 rough draft and V2 finished, %n sections, %k, %b BPM. Core sentence, hook and word field are filled in; the ticks are yours to set.'],
    exGo: ['Im Songwriting öffnen ›', 'Open in Songwriting ›'], exV1: ['Rohfassung (nach Schritt 9)', 'Rough draft (after step 9)'], exV2: ['Fertig (nach Schritt 10)', 'Finished (after step 10)'],
    KZ: ['Zeile', 'Line'], KT: ['Titel', 'Title'], KB: ['Bild', 'Image'], KI: ['Idee', 'Idea'], KZs: ['Zeilen', 'Lines'], KTs: ['Titel', 'Titles'], KBs: ['Bilder', 'Images'], KIs: ['Ideen', 'Ideas']
  };
  const u = k => tx(U[k] || k);
  const KINDS = [['z', 'KZ', 'KZs'], ['t', 'KT', 'KTs'], ['b', 'KB', 'KBs'], ['i', 'KI', 'KIs']];

  /* ---------- Werkzeuge (Sprünge) ---------- */
  const TOOL = {
    lied: ['Im Songwriting öffnen', 'Open in Songwriting'], text: ['Text im Songwriting', 'Lyrics in Songwriting'],
    'tw:reim': ['Text-Werkstatt: Reime prüfen', 'Text workshop: check rhymes'], 'tw:wort': ['Text-Werkstatt: Reimwörter', 'Text workshop: rhyme words'],
    'tw:akk': ['Text-Werkstatt: Akkorde nach Stimmung', 'Text workshop: chords by mood'], 'tw:kit': ['Text-Werkstatt: Baukasten', 'Text workshop: building kit'],
    'tw:prompt': ['Text-Werkstatt: Prompt für Claude', 'Text workshop: prompt for Claude'], looper: ['Looper (aufnehmen, Ideen)', 'Looper (record, ideas)'],
    pdf: ['Leadsheet (PDF)', 'Lead sheet (PDF)'], songbook: ['Ins Songbook übernehmen', 'Add to songbook'], singlernen: ['Mitsingen lernen', 'Learn to sing along'], nb: ['Ideen-Notizbuch', 'Idea notebook']
  };

  /* ---------- Workflow: 11 Schritte (eigene Formulierungen, nur erfundene Beispiele) ---------- */
  const STEPS = [
    { t: ['Idee & Kernsatz', 'Idea & core sentence'], c: ['Worum geht es – in einem Satz?', 'What is it about – in one sentence?'], x: 'kern', tools: ['nb'],
      so: ['Schreib in einem einzigen Satz auf, worum es im Song geht – so, als würdest du es einem Freund am Telefon erzählen. Kein Reim, keine schönen Worte, nur der Kern. Fehlt dir die Idee, würfle einen Schreibimpuls oder blättere im Ideen-Notizbuch.',
        'Write down in a single sentence what the song is about – as if you were telling a friend on the phone. No rhyme, no fancy words, just the core. No idea yet? Roll a writing prompt or browse the idea notebook.'],
      why: ['Der Kernsatz ist dein Kompass: Bei jeder Zeile prüfst du später, ob sie ihm dient. Songs ohne klaren Kern zerfasern meist in der zweiten Strophe.',
        'The core sentence is your compass: later you check every line against it. Songs without a clear core usually fall apart in the second verse.'],
      tips: [['Person, Gefühl und Situation reichen: „Er merkt erst beim Umzug, wie lange er schon allein wohnt.“', 'Person, feeling and situation are enough: “Only when he moves out does he notice how long he has lived alone.”'],
        ['Zu allgemein? Frag „Wer? Wo? Wann genau?“, bis ein Bild entsteht.', 'Too general? Ask “Who? Where? When exactly?” until you see a picture.'],
        ['Der Kernsatz muss nicht im Song vorkommen – er ist nur für dich.', 'The core sentence does not have to appear in the song – it is just for you.']],
      ok: ['Du kannst in einem Atemzug sagen, worum es geht – und jemand anders versteht es sofort.', 'You can say in one breath what it is about – and someone else gets it at once.'] },
    { t: ['Titel & Hook', 'Title & hook'], c: ['Die Zeile, die hängen bleibt', 'The line that sticks'], x: 'hook', tools: ['nb'],
      so: ['Sammle fünf bis zehn Titel-Ideen zum Kernsatz: kurze, bildhafte Wendungen, die man mitsingen kann. Wähl die stärkste – sie wird zum Hook und steht im Refrain, meist am Anfang oder am Ende.',
        'Collect five to ten title ideas for the core sentence: short, vivid phrases people can sing along to. Pick the strongest – it becomes the hook and sits in the chorus, usually at the start or the end.'],
      why: ['Der Hook ist das, was Zuhörer behalten und wonach sie den Song benennen. Kennst du ihn früh, schreibst du den Rest gezielt auf ihn zu.',
        'The hook is what listeners remember and what they call the song. Knowing it early lets you write everything else towards it.'],
      tips: [['Gute Hooks sind kurz (2–6 Silben) und haben einen eigenen Rhythmus: „Licht im Treppenhaus“.', 'Good hooks are short (2–6 syllables) with a rhythm of their own: “Light in the stairwell”.'],
        ['Alltagswendung mit Dreh: aus „alles wie immer“ wird „alles wie nie“.', 'Everyday phrase with a twist: “same as always” becomes “same as never”.'],
        ['Sing den Titel auf zwei, drei Melodien – klingt er gesungen gut, ist er gut.', 'Sing the title to two or three melodies – if it sounds good sung, it is good.']],
      ok: ['Der Titel lässt sich singen, passt zum Kernsatz und macht neugierig.', 'The title is singable, fits the core sentence and makes people curious.'] },
    { t: ['Stoff sammeln', 'Collect material'], c: ['Wortfeld, Bilder, Erinnerungen', 'Word field, images, memories'], x: 'wf', tools: ['tw:wort', 'nb'],
      so: ['Sammle, bevor du reimst: Wörter, Orte, Gegenstände, Geräusche, Gerüche und kleine Erinnerungen zum Thema. Schreib alles ungefiltert ins Wortfeld. Tipp ein Wort an, um passende Reimwörter zu finden.',
        'Collect before you rhyme: words, places, objects, sounds, smells and small memories about the topic. Put everything unfiltered into the word field. Tap a word to find rhyme words.'],
      why: ['Mit genug Material musst du beim Reimen nicht das erstbeste Wort nehmen. Konkrete Dinge aus dem Wortfeld machen den Text später lebendig.',
        'With enough material you never have to take the first rhyme that comes. Concrete things from the word field bring the lyrics to life later.'],
      tips: [['Je Sinn mindestens zwei Einträge: sehen, hören, riechen, fühlen, schmecken.', 'At least two entries per sense: see, hear, smell, feel, taste.'],
        ['Lieber „kalter Kaffee auf der Fensterbank“ als „Traurigkeit“.', 'Rather “cold coffee on the windowsill” than “sadness”.'],
        ['Gegensätze notieren (laut/leise, drinnen/draußen) – sie liefern Kontrast für den Refrain.', 'Note opposites (loud/quiet, inside/outside) – they give contrast for the chorus.']],
      ok: ['Du hast mindestens 20 Einträge, und ein paar davon überraschen dich selbst.', 'You have at least 20 entries and a few of them surprise you.'] },
    { t: ['Aufbau festlegen', 'Set the structure'], c: ['Vorlage wählen – Abschnitte anlegen', 'Pick a template – create sections'], x: 'tpl', tools: ['lied'],
      so: ['Entscheide, welche Teile der Song braucht. Eine Vorlage legt die Abschnitte im Songwriting an – mit Zeilenzahl und Reimschema als Hinweis im Textfeld und einfachen Platzhalter-Akkorden. Hat der Song schon Inhalt, entsteht eine neue Version; nichts wird überschrieben.',
        'Decide which parts the song needs. A template creates the sections in Songwriting – with line count and rhyme scheme as a hint in the lyrics field and simple placeholder chords. If the song already has content, a new version is created; nothing is overwritten.'],
      why: ['Ein fester Bauplan nimmt dir Entscheidungen ab und zeigt, wie viel Text du wirklich brauchst.', 'A fixed plan takes decisions off your hands and shows how much text you really need.'],
      tips: [['Strophe–Refrain reicht für die meisten Songs; eine Bridge lohnt sich, wenn nach dem zweiten Refrain etwas Neues kommen soll.', 'Verse–chorus is enough for most songs; a bridge pays off when something new should come after the second chorus.'],
        ['Blues: drei Zeilen je Strophe – die erste wird wiederholt, die dritte antwortet (AAB).', 'Blues: three lines per verse – the first is repeated, the third answers (AAB).'],
        ['Die Akkorde der Vorlage sind Platzhalter – in Schritt 8 passt du sie an die Stimmung an.', 'The template chords are placeholders – in step 8 you match them to the mood.']],
      ok: ['Im Songwriting stehen alle Abschnitte im Ablauf, jedes Textfeld nennt Zeilen und Reimschema.', 'Songwriting shows all sections in the arrangement, every lyrics field names lines and rhyme scheme.'] },
    { t: ['Refrain zuerst', 'Chorus first'], c: ['Kernaussage + Hook', 'Core message + hook'], tools: ['text', 'tw:reim'],
      so: ['Schreib den Refrain, bevor du an die Strophen gehst. Er sagt die Kernaussage am direktesten und enthält den Hook. Halte die Zeilen kurz und einfach – der Refrain wird mehrmals gesungen und muss sofort sitzen.',
        'Write the chorus before the verses. It says the core message most directly and contains the hook. Keep the lines short and simple – the chorus is sung several times and must land at once.'],
      why: ['Der Refrain ist das Ziel, auf das jede Strophe hinarbeitet. Steht er, weißt du, was die Strophen vorbereiten müssen.', 'The chorus is the goal every verse works towards. Once it stands, you know what the verses have to set up.'],
      tips: [['Hook an den Anfang oder ans Ende – am besten beides.', 'Put the hook at the start or the end – ideally both.'],
        ['Weniger Wörter als in der Strophe, dafür längere Töne.', 'Fewer words than in the verse, longer notes instead.'],
        ['Erfunden: „Lass das Licht im Treppenhaus an, / ich find allein nicht mehr nach Haus.“', 'Invented: “Leave the light on in the stairwell, / I can’t find my way home alone.”']],
      ok: ['Du kannst den Refrain nach zweimal Lesen auswendig.', 'You know the chorus by heart after reading it twice.'] },
    { t: ['Strophen', 'Verses'], c: ['Jede bringt etwas Neues', 'Each brings something new'], tools: ['text', 'tw:wort', 'nb'],
      so: ['Die Strophen erzählen: Wer, wo, was passiert? Strophe 1 stellt die Lage vor, Strophe 2 bringt eine Entwicklung, eine neue Sicht oder eine Folge. Nimm Bilder aus dem Wortfeld und zeig, statt zu erklären.',
        'The verses tell the story: who, where, what happens? Verse 1 sets the scene, verse 2 brings a development, a new view or a consequence. Use images from the word field and show instead of explaining.'],
      why: ['Sagt die zweite Strophe nur dasselbe mit anderen Worten, verliert der Zuhörer das Interesse – genau bevor der Refrain wiederkommt.', 'If the second verse only repeats the first in other words, the listener drifts off – right before the chorus returns.'],
      tips: [['Frag dich vor Strophe 2: Was ist seit Strophe 1 passiert?', 'Before verse 2 ask: what has happened since verse 1?'],
        ['Die letzte Strophenzeile führt in den Refrain – inhaltlich und melodisch.', 'The last verse line leads into the chorus – in content and melody.'],
        ['Ein konkretes Detail je Strophe wirkt mehr als drei allgemeine Gefühle.', 'One concrete detail per verse does more than three general feelings.']],
      ok: ['Jede Strophe hat ein eigenes Bild und eine eigene Information – du könntest ihnen Überschriften geben.', 'Each verse has its own image and its own information – you could give them headlines.'] },
    { t: ['Bridge / Wendung', 'Bridge / twist'], c: ['Neue Sicht vor dem letzten Refrain', 'New view before the last chorus'], tools: ['text', 'tw:kit'],
      so: ['Die Bridge bringt eine Wendung: eine andere Perspektive, ein Geständnis, einen Zeitsprung. Sie klingt anders als Strophe und Refrain (andere Akkorde, andere Zeilenlänge) und macht den letzten Refrain stärker.',
        'The bridge brings a twist: another perspective, a confession, a jump in time. It sounds different from verse and chorus (other chords, other line length) and makes the last chorus stronger.'],
      why: ['Nach zwei Durchgängen kennt der Zuhörer das Muster – die Bridge überrascht, damit der Schluss wieder wirkt.', 'After two rounds the listener knows the pattern – the bridge surprises so the ending works again.'],
      tips: [['Die Bridge darf kurz sein: zwei bis vier Zeilen.', 'The bridge may be short: two to four lines.'],
        ['Probier, was du bisher verschwiegen hast: den Grund, die Gegenseite, die Zukunft.', 'Try what you have kept quiet so far: the reason, the other side, the future.'],
        ['Kein Platz für eine Bridge? Ein leicht veränderter letzter Refrain kann dasselbe leisten.', 'No room for a bridge? A slightly changed last chorus can do the same job.']],
      ok: ['Nach der Bridge klingt der Refrain anders als vorher – er bedeutet mehr.', 'After the bridge the chorus sounds different – it means more.'] },
    { t: ['Stimmung & Akkorde', 'Mood & chords'], c: ['Akkorde je Abschnitt', 'Chords per section'], tools: ['tw:akk', 'lied'],
      so: ['Beschreib die Stimmung je Abschnitt in einfachen Worten und hol dir in der Text-Werkstatt unter „Akkorde nach Stimmung“ passende Folgen. Übernimm sie als neue Version und hör sie im Songwriting mit „▶“ an.',
        'Describe the mood of each section in simple words and get matching progressions in the text workshop under “Chords by mood”. Take them over as a new version and listen with “▶” in Songwriting.'],
      why: ['Text und Musik sollen dasselbe erzählen: Ein hoffnungsvoller Refrain über schweren Mollakkorden klingt anders als gemeint – manchmal gewollt, oft aus Versehen.', 'Lyrics and music should tell the same story: a hopeful chorus over heavy minor chords sounds different than meant – sometimes on purpose, often by accident.'],
      tips: [['Refrain gern eine Spur heller oder höher als die Strophe.', 'Make the chorus a touch brighter or higher than the verse.'],
        ['Spannung vor dem Refrain: die Strophe auf der V (Dominante) enden lassen.', 'Tension before the chorus: end the verse on the V (dominant).'],
        ['Moll ist nicht automatisch traurig – Tempo und Rhythmus zählen mit.', 'Minor is not automatically sad – tempo and rhythm count too.']],
      ok: ['Beim Anhören passt die Stimmung jedes Abschnitts zum Text.', 'Listening back, the mood of every section fits its lyrics.'] },
    { t: ['Auf den Takt & probesingen', 'Fit to the beat & try singing'], c: ['Zur Begleitung singen, aufnehmen', 'Sing to the backing, record'], tools: ['lied', 'looper'],
      so: ['Sprich den Text im Rhythmus der Begleitung, dann sing ihn. Betonte Silben gehören auf betonte Schläge. Nimm einen Durchgang im Looper auf und hör ihn mit etwas Abstand an – gute Melodie-Schnipsel als Idee sichern.',
        'Speak the lyrics in the rhythm of the backing, then sing them. Stressed syllables belong on strong beats. Record a take in the Looper and listen back with some distance – save good melody snippets as an idea.'],
      why: ['Auf Papier klingt vieles gut, was gesungen holpert. Erst mit Begleitung merkst du, wo Silben fehlen oder zu viele sind.', 'Much looks fine on paper that stumbles when sung. Only with the backing do you notice where syllables are missing or too many.'],
      tips: [['Zu viele Silben? Füllwörter streichen („doch“, „halt“, „so“). Zu wenige? Einen Ton dehnen statt ein Wort einzuschieben.', 'Too many syllables? Cut filler words. Too few? Stretch a note instead of squeezing in a word.'],
        ['Die Silbenzahl je Zeile steht links neben dem Text im Songwriting.', 'The syllable count of each line is shown left of the lyrics in Songwriting.'],
        ['Aufnahme mit Kopfhörern, damit die Begleitung nicht doppelt drauf ist.', 'Record with headphones so the backing is not recorded twice.']],
      ok: ['Du singst den ganzen Song ohne Stolpern zur Begleitung.', 'You sing the whole song to the backing without stumbling.'] },
    { t: ['Überarbeiten', 'Revise'], c: ['Reime prüfen, laut lesen, kürzen', 'Check rhymes, read aloud, cut'], tools: ['tw:reim', 'tw:prompt'],
      so: ['Lies den Text laut, prüf die Reime in der Text-Werkstatt und markier schwache Zeilen. Ersetze Allgemeines durch Bilder und streich alles Doppelte. Für knifflige Zeilen holst du dir mit „Prompt für Claude“ Vorschläge und übernimmst sie als neue Version.',
        'Read the lyrics aloud, check the rhymes in the text workshop and mark weak lines. Replace the general with images and cut anything doubled. For tricky lines get suggestions with “Prompt for Claude” and take them over as a new version.'],
      why: ['Gute Texte entstehen meist beim Überarbeiten, nicht beim ersten Schreiben. Jede Version bleibt erhalten – du kannst also mutig kürzen.', 'Good lyrics are mostly made in revision, not in the first draft. Every version is kept – so cut boldly.'],
      tips: [['Eine Nacht liegen lassen, dann laut lesen – schwache Zeilen fallen sofort auf.', 'Sleep on it, then read aloud – weak lines stand out at once.'],
        ['Kommt ein Wort ohne Absicht zweimal in einem Abschnitt vor? Tauschen.', 'Does a word appear twice in a section without intent? Swap it.'],
        ['Klischee-Test: Schon hundertmal gehört? Dann ersetzen.', 'Cliché test: heard it a hundred times? Replace it.']],
      ok: ['Keine Zeile steht nur wegen des Reims da – jede sagt etwas.', 'No line is there just for the rhyme – each one says something.'] },
    { t: ['Fertig', 'Finished'], c: ['Checkliste, Leadsheet, Songbook', 'Checklist, lead sheet, songbook'], x: 'chk', tools: ['pdf', 'songbook', 'singlernen'],
      so: ['Geh die Checkliste durch. Ist alles abgehakt, mach ein Leadsheet als PDF, übernimm den Song ins Songbook und übe ihn mit „Mitsingen lernen“ ein.',
        'Go through the checklist. When everything is ticked, make a lead sheet PDF, add the song to the songbook and practise it with “Learn to sing along”.'],
      why: ['Ein Song ist fertig, wenn du ihn vorspielen kannst – nicht, wenn er perfekt ist. Die Checkliste verhindert endloses Feilen und dass Wichtiges fehlt.', 'A song is finished when you can play it to someone – not when it is perfect. The checklist stops endless polishing and missing essentials.'],
      tips: [['Fertig heißt spielbar. Verbesserungen kommen später als neue Version.', 'Finished means playable. Improvements come later as a new version.'],
        ['Im Songbook stehen Akkorde und Text groß am Notenständer.', 'The songbook shows chords and lyrics large on the music stand.'],
        ['„Mitsingen lernen“ findet den Song über das Songbook.', '“Learn to sing along” finds the song via the songbook.']],
      ok: ['Alle Punkte der Checkliste sind abgehakt und du hast den Song einmal ganz gesungen.', 'All checklist items are ticked and you have sung the whole song once.'] }
  ];
  const NS = STEPS.length;

  /* ---------- Leitfaden (eigene Formulierungen, erfundene Beispiele) ---------- */
  const GUIDE = [
    { t: ['Aufbau eines Songs', 'Song structure'],
      p: ['Jeder Teil hat eine Aufgabe. Die Strophe erzählt und bringt Details. Der Pre-Chorus hebt an und baut Spannung auf. Der Refrain sagt die Kernaussage mit dem Hook und bleibt (fast) gleich. Die Bridge bringt eine Wendung, bevor der Refrain ein letztes Mal kommt. Intro und Outro rahmen das Ganze.',
        'Every part has a job. The verse tells and brings details. The pre-chorus lifts and builds tension. The chorus states the core message with the hook and stays (almost) the same. The bridge brings a twist before the chorus comes one last time. Intro and outro frame it all.'],
      ex: [[['Strophe', 'Verse'], ['„Der Bus fährt ohne mich, ich steh im Regen“', '“The bus leaves without me, I stand in the rain”']], [['Pre-Chorus', 'Pre-chorus'], ['„und irgendwas in mir sagt: lauf“', '“and something inside me says: run”']],
        [['Refrain', 'Chorus'], ['„Ich bin schon unterwegs“', '“I’m already on my way”']], [['Bridge', 'Bridge'], ['„Vielleicht war’s nie der Bus, auf den ich wartete“', '“Maybe it was never the bus I was waiting for”']]], go: 'lied' },
    { t: ['Eine Kernaussage je Song', 'One core message per song'],
      p: ['Ein Song erzählt eine Sache, nicht drei. Fass sie in einen Satz. Jede Zeile wird daran gemessen: Dient sie dem Kern oder lenkt sie ab?', 'A song tells one thing, not three. Put it into one sentence. Every line is measured against it: does it serve the core or distract?'],
      ex: [[['Kernsatz', 'Core'], ['„Sie räumt seine Tasse weg und merkt, dass sie nicht mehr wartet.“', '“She puts his cup away and notices she is no longer waiting.”']], [['Gehört nicht hinein', 'Does not belong'], ['eine Strophe über das Wetter im letzten Urlaub', 'a verse about the weather on last year’s holiday']]] },
    { t: ['Titel und Hook', 'Title and hook'],
      p: ['Der Hook ist die kürzeste, einprägsamste Zeile – meist zugleich der Titel. Er steht im Refrain an betonter Stelle (Anfang oder Ende) und kommt mehrmals. Gute Hooks haben einen eigenen Rhythmus und lassen sich ohne Begleitung summen.',
        'The hook is the shortest, catchiest line – usually also the title. It sits at a strong spot in the chorus (start or end) and comes back several times. Good hooks have a rhythm of their own and can be hummed without backing.'],
      ex: [[['Hook', 'Hook'], ['„Licht im Treppenhaus“ – vier Silben, ein Bild, eine Stimmung', '“Light in the stairwell” – few syllables, one image, one mood']]] },
    { t: ['Zeigen statt behaupten', 'Show, don’t tell'],
      p: ['Gefühle wirken stärker, wenn man sie sieht, statt sie genannt zu bekommen. Ersetze Gefühlswörter durch Dinge, Handlungen und Sinneseindrücke.', 'Feelings hit harder when they are seen rather than named. Replace feeling words with objects, actions and sensations.'],
      ex: [[['Statt', 'Instead of'], ['„Ich bin so einsam ohne dich“', '“I’m so lonely without you”']], [['Besser', 'Better'], ['„Zwei Teller im Schrank, ich nehm immer nur einen“', '“Two plates in the cupboard, I only ever take one”']]] },
    { t: ['Perspektive und Zeitform', 'Point of view and tense'],
      p: ['Leg fest, wer erzählt (ich, du, er/sie, wir) und wann (jetzt oder damals). Wechsle nur mit Absicht – etwa in der Bridge. Ungewollte Sprünge verwirren.', 'Decide who is telling (I, you, he/she, we) and when (now or back then). Only switch on purpose – in the bridge, say. Unplanned jumps confuse.'],
      ex: [[['Statt', 'Instead of'], ['„Ich geh zur Tür, du warst schon weg, er sieht mich an“', '“I walk to the door, you were gone, he looks at me”']], [['Besser', 'Better'], ['„Ich geh zur Tür, du bist schon weg, im Flur brennt noch dein Licht“', '“I walk to the door, you’re already gone, your light still burns in the hall”']]] },
    { t: ['Reimarten', 'Kinds of rhyme'],
      p: ['Reiner Reim: gleicher Klang ab dem betonten Vokal. Unreiner Reim: ähnlich, aber nicht gleich (Vokal lang/kurz, verwandte Endkonsonanten). Unreine Reime klingen oft besser als ein gezwungener reiner – gesungen fallen kleine Unterschiede kaum auf. Übliche Schemata: AABB, ABAB, XAXA (nur Zeile 2 und 4 reimen).',
        'Perfect rhyme: same sound from the stressed vowel on. Slant rhyme: similar but not the same (long/short vowel, related end consonants). A slant rhyme often sounds better than a forced perfect one – sung, small differences hardly show. Common schemes: AABB, ABAB, XAXA (only lines 2 and 4 rhyme).'],
      ex: [[['rein', 'perfect'], ['Nacht – gelacht · Glück – zurück', 'night – light · back – track']], [['unrein', 'slant'], ['Straße – Nase · Mond – gewohnt', 'home – alone · mind – time']], [['Klischee', 'Cliché'], ['Herz – Schmerz: rein, aber abgenutzt', 'heart – apart: perfect but worn out']]], go: 'tw:reim' },
    { t: ['Silben und Betonung', 'Syllables and stress'],
      p: ['Die betonte Silbe eines Wortes gehört auf einen betonten Schlag (meist 1 und 3). Sonst klingt es falsch. Zähl die Silben paralleler Zeilen – ähnlich lange Zeilen passen auf dieselbe Melodie.',
        'The stressed syllable of a word belongs on a strong beat (usually 1 and 3). Otherwise it sounds wrong. Count the syllables of parallel lines – lines of similar length fit the same melody.'],
      ex: [[['Holpert', 'Stumbles'], ['„Ich warte auf den Mor-GEN“ (Betonung auf der Endsilbe)', '“I’m waiting for to-MOR-row-OH” (stress forced on the wrong syllable)']], [['Sitzt', 'Fits'], ['„Ich WAR-te auf den MOR-gen“ – betonte Silben auf 1 und 3', '“I’m WAIT-ing for the MOR-ning” – stresses on 1 and 3']]] },
    { t: ['Kontrast Strophe ↔ Refrain', 'Contrast verse ↔ chorus'],
      p: ['Der Refrain hebt sich ab: kürzere Zeilen, höhere Lage, weniger Wörter mit längeren Tönen, oft direkter. Die Strophe ist dichter und erzählt.', 'The chorus stands out: shorter lines, higher range, fewer words with longer notes, often more direct. The verse is denser and tells the story.'],
      ex: [[['Strophe', 'Verse'], ['„Der Wecker blinkt, die Heizung tickt, im Flur liegt noch dein Schal“', '“The clock blinks, the heater ticks, your scarf still lies in the hall”']], [['Refrain', 'Chorus'], ['„Bleib – nur heut“', '“Stay – just tonight”']]] },
    { t: ['Wiederholung gezielt', 'Repetition on purpose'],
      p: ['Wiederholung macht Zeilen einprägsam – im Refrain gewollt, in der Strophe meist Füllstoff. Wiederhole den Hook bewusst und verändere ihn beim letzten Mal leicht, wenn sich die Geschichte gedreht hat.',
        'Repetition makes lines stick – wanted in the chorus, mostly filler in the verse. Repeat the hook deliberately and change it slightly the last time if the story has turned.'],
      ex: [[['Refrain 1 und 2', 'Chorus 1 and 2'], ['„Ich bleib noch hier“', '“I’m staying here”']], [['Letzter Refrain', 'Last chorus'], ['„Ich bleib nicht hier“', '“I’m not staying here”']]] },
    { t: ['Kürzen', 'Cutting'],
      p: ['Was man weglassen kann, ohne dass etwas fehlt, gehört weg. Füllwörter (ja, doch, halt, so, einfach), doppelte Bilder und Erklärungen nach einem Bild schwächen den Text.', 'Whatever can go without anything missing should go. Filler words, doubled images and explanations after an image weaken the lyrics.'],
      ex: [[['Statt', 'Instead of'], ['„Und ich steh da einfach so ganz allein im Regen und bin traurig“', '“And I just stand there all alone in the rain and I am sad”']], [['Besser', 'Better'], ['„Ich steh im Regen“', '“I stand in the rain”']]] },
    { t: ['Stimmung, Tonart und Akkorde', 'Mood, key and chords'],
      p: ['Dur klingt meist offen, Moll nachdenklich – aber Tempo, Rhythmus und Lage zählen genauso. Ein Refrain wirkt größer, wenn er auf der IV oder höher beginnt. Die Text-Werkstatt schlägt unter „Akkorde nach Stimmung“ Folgen zu einer kurzen Beschreibung vor.',
        'Major usually sounds open, minor thoughtful – but tempo, rhythm and range count just as much. A chorus feels bigger when it starts on the IV or higher. The text workshop suggests progressions for a short description under “Chords by mood”.'],
      ex: [[['Beschreibung', 'Description'], ['„traurig, im Refrain Hoffnung“', '“sad, hope in the chorus”']], [['Idee', 'Idea'], ['Strophe in Moll, Refrain beginnt auf der IV in Dur', 'verse in minor, chorus starts on the IV in major']]], go: 'tw:akk' }
  ];

  /* ---------- Schreibimpulse (erfundene Listen) ---------- */
  const DICE = {
    t: [['ein Umzug', 'moving out'], ['der letzte Bus', 'the last bus'], ['ein vergessener Geburtstag', 'a forgotten birthday'], ['die erste Bandprobe', 'the first band rehearsal'], ['ein Streit, der keiner war', 'a fight that wasn’t one'],
      ['Nachtschicht', 'night shift'], ['ein Brief, nie abgeschickt', 'a letter never sent'], ['Heimkommen nach langer Zeit', 'coming home after a long time'], ['ein alter Freund am Bahnsteig', 'an old friend on the platform'], ['Sonntagmorgen ohne Plan', 'Sunday morning without a plan'],
      ['ein kaputtes Radio', 'a broken radio'], ['der Garten der Großeltern', 'the grandparents’ garden'], ['Stromausfall in der Stadt', 'a city blackout'], ['die Straße, in der man aufwuchs', 'the street you grew up on'], ['ein Versprechen', 'a promise'], ['Fernweh im Büro', 'wanderlust at the office']],
    p: [['ich, jetzt', 'I, now'], ['ich erinnere mich (damals)', 'I remember (back then)'], ['du-Ansprache', 'talking to “you”'], ['er/sie – von außen beobachtet', 'he/she – watched from outside'], ['wir', 'we'], ['ein Gegenstand erzählt', 'an object tells the story'],
      ['ein Brief an mich in zehn Jahren', 'a letter to me in ten years'], ['zwei Stimmen im Wechsel', 'two voices taking turns']],
    b: [['Kaffeeduft', 'smell of coffee'], ['eine flackernde Straßenlaterne', 'a flickering street lamp'], ['Regen auf dem Autodach', 'rain on the car roof'], ['ein Schlüsselbund', 'a bunch of keys'], ['Möwen über dem Parkplatz', 'gulls over the car park'], ['kalte Hände', 'cold hands'],
      ['das Brummen des Kühlschranks', 'the hum of the fridge'], ['ein Kalender voller Kreuze', 'a calendar full of crosses'], ['Staub im Sonnenlicht', 'dust in the sunlight'], ['nasser Asphalt', 'wet asphalt'], ['eine Jacke, die nach Lagerfeuer riecht', 'a jacket that smells of campfire'],
      ['Kreidestriche auf dem Gehweg', 'chalk marks on the pavement'], ['ein Funkloch', 'no signal'], ['ein Zug, der nicht hält', 'a train that doesn’t stop'], ['ein Streichholz', 'a match'], ['offene Umzugskartons', 'open moving boxes']]
  };

  /* ---------- Checkliste „Ist der Song fertig?“ ---------- */
  const CHECK = [['Die Kernaussage passt in einen Satz.', 'The core message fits in one sentence.'], ['Titel/Hook steht im Refrain (Anfang oder Ende).', 'Title/hook is in the chorus (start or end).'],
    ['Jede Strophe bringt etwas Neues.', 'Every verse brings something new.'], ['Perspektive und Zeitform sind durchgehalten.', 'Point of view and tense are consistent.'],
    ['Singbar: betonte Silben auf betonten Schlägen, genug Luft.', 'Singable: stressed syllables on strong beats, enough breath.'], ['Nichts doppelt, keine Füllzeilen.', 'Nothing doubled, no filler lines.'],
    ['Einmal ganz zur Begleitung gesungen (oder aufgenommen).', 'Sung (or recorded) once all the way through with the backing.']];

  /* ---------- Aufbau-Vorlagen: Teile mit Zeilenzahl/Reimschema und Platzhalter-Akkorden (Stufe 0–6 der Tonart, je 1 Takt) ---------- */
  const PN = { verse: ['Strophe', 'Verse'], pre: ['Pre-Chorus', 'Pre-chorus'], chorus: ['Refrain', 'Chorus'], bridge: ['Bridge', 'Bridge'], blues: ['Blues-Strophe', 'Blues verse'] };
  const VERSE = { y: 'verse', n: 4, r: 'ABAB', ch: [0, 4, 5, 3, 0, 4, 5, 3] }, CHORUS = { y: 'chorus', n: 4, r: 'AABB', ch: [3, 0, 4, 5, 3, 0, 4, 4] };
  const TPL = [
    { id: 'vr', n: ['Strophe – Refrain', 'Verse – chorus'], d: ['Der Klassiker: Strophe erzählt, Refrain wiederholt die Kernaussage.', 'The classic: the verse tells, the chorus repeats the core message.'], parts: [VERSE, CHORUS], order: [0, 1, 0, 1, 1] },
    { id: 'pre', n: ['Mit Pre-Chorus', 'With pre-chorus'], d: ['Zwei Zeilen Anlauf vor dem Refrain – baut Spannung auf.', 'Two lines of run-up before the chorus – builds tension.'], parts: [VERSE, { y: 'pre', n: 2, r: 'AA', ch: [1, 3, 4, 4] }, CHORUS], order: [0, 1, 2, 0, 1, 2, 2] },
    { id: 'br', n: ['Mit Bridge', 'With bridge'], d: ['Nach dem zweiten Refrain eine Wendung, dann der letzte Refrain.', 'A twist after the second chorus, then the last chorus.'], parts: [VERSE, CHORUS, { y: 'bridge', n: 4, r: 'XAXA', ch: [5, 4, 3, 4] }], order: [0, 1, 0, 1, 2, 1] },
    { id: 'blues', n: ['12-Takt-Blues (AAB)', '12-bar blues (AAB)'], d: ['Drei Strophen à drei Zeilen: Zeile 1 wird wiederholt, Zeile 3 antwortet.', 'Three verses of three lines: line 1 is repeated, line 3 answers.'],
      parts: [{ y: 'blues', n: 3, r: 'AAB', ch: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], b7: true }], order: [0, 0, 0] }
  ];
  const SEMI = [[0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10]], QUAL = [['', 'm', 'm', '', '', 'm', 'dim'], ['m', 'dim', '', 'm', 'm', '', '']];
  function chordOf(k, deg, b7) {
    const mi = k && k.major === false ? 1 : 0, pc = k ? +k.pc || 0 : 0;
    let t = QUAL[mi][deg];
    if (b7) t = mi && (deg === 0 || deg === 3) ? 'm7' : '7';
    return { r: ((pc + SEMI[mi][deg]) % 12 + 12) % 12, t, beats: 4 };
  }
  function tplParts(T0, key) {
    const C = LC();
    const parts = T0.parts.map(x => ({ id: C.newId('p'), name: tx(PN[x.y]), type: x.y === 'blues' ? 'verse' : x.y, chords: x.ch.map(d => chordOf(key, d, x.b7)), audio: null, plan: { n: x.n, r: x.r } }));
    return { parts, order: T0.order.map(i => ({ p: parts[i].id, reps: 1 })) };
  }

  /* ---------- Speicher ---------- */
  const blank = () => ({ v: 1, cur: '_', view: 'wf', p: {}, n: [] });
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && typeof d === 'object') { const b = Object.assign(blank(), d); if (!b.p || typeof b.p !== 'object') b.p = {}; if (!Array.isArray(b.n)) b.n = []; return b; }
    } catch (e) {}
    return blank();
  }
  function store() { try { localStorage.setItem(KEY, JSON.stringify(D)); if (window.SW && SW.tiles) SW.tiles(); return true; } catch (e) { say(u('nosave'), true); return false; } }
  let storeT = 0; const storeSoon = () => { clearTimeout(storeT); storeT = setTimeout(store, 400); };
  let lastK = null;   // v167: zuletzt gezeigter Song (für sync)
  let D = load(), built = false, sel = 1, takeId = '', tkSong = '', tpl = 'vr', dice = null, rhW = '', nbKind = '', nbF = '', openG = {};

  /* ---------- Songs (aus dem Songwriting) ---------- */
  function songs() { const A = LA(); try { return A && A.songs ? A.songs() : []; } catch (e) { return []; } }
  const newest = s => s.versions[s.versions.length - 1];
  const verOf = s => s ? s.versions[s.cur] || newest(s) : null;
  function curKey() {
    const A = LA(); if (A && A.song) { const s = A.song(); return s && songs().some(x => x.id === s.id) ? 'l:' + s.id : '_'; }   // v167: eine Songauswahl für alles
    const k = D.cur; return k && k.startsWith('l:') && songs().some(s => 'l:' + s.id === k) ? k : '_'; }
  function curSong() { const k = curKey(); return k === '_' ? null : songs().find(s => 'l:' + s.id === k) || null; }
  function rec(k, make) {
    k = k || curKey(); let r = D.p[k];
    if (!r && make) { const s = curSong(); r = D.p[k] = { n: s && k === 'l:' + s.id ? s.name : '', d: [], s: 0, k: '', h: '', wf: { t: '', w: [] }, c: [], e: Date.now() }; }
    if (r) { if (!Array.isArray(r.d)) r.d = []; if (!r.wf || !Array.isArray(r.wf.w)) r.wf = { t: '', w: [] }; if (!Array.isArray(r.c)) r.c = []; }
    return r || null;
  }
  const touch = r => { r.e = Date.now(); const s = curSong(); if (s) r.n = s.name; };

  /* ---------- Gerüst ---------- */
  function say(t, warn) { document.querySelectorAll('#stxRoot .stx-msg').forEach(m => { m.textContent = t || ''; m.classList.toggle('warn', !!warn); }); }
  function navHtml() {
    return '<div class="stx-nav" role="tablist" aria-label="' + esc(u('title')) + '">' + ['wf', 'lf', 'nb'].map(v => '<button type="button" class="toggle-btn" role="tab" data-view="' + v + '">' + esc(u(v)) + '</button>').join('') + '</div>';
  }
  // Fahrplan-Karte und Schritt-Karte: dasselbe Gerüst und dieselben Klassen wie planCard()/stepCard() in mitsingen.js (v163)
  function planCard() {
    return '<div class="card msl-plan"><div class="card-head msl-head"><h2>' + esc(u('title')) + '</h2><span class="caption" id="stxCnt"></span></div>'
      + '<label class="msl-pc"><span class="caption">' + esc(u('song')) + '</span><select id="stxSong" aria-label="' + esc(u('pick')) + '"></select></label>'
      + '<p class="caption msl-meta" id="stxMeta"></p>'
      + '<div class="msl-new" id="stxNew" hidden><input type="text" id="stxNewN" maxlength="40" placeholder="' + esc(u('newN')) + '" aria-label="' + esc(u('newN')) + '">'
      + '<button type="button" class="toggle-btn" id="stxNewOk">' + esc(u('create')) + '</button><button type="button" class="toggle-btn" id="stxNewX">' + esc(u('cancel')) + '</button></div>'
      + '<div class="msl-rows" id="stxL" role="list"></div><p class="caption stx-pn">' + esc(u('planNote')) + '</p>'
      + '<button type="button" class="toggle-btn stx-exb" id="stxExAll" aria-expanded="false" aria-controls="stxExW">' + esc(u('exAll')) + '</button></div>';   // v166
  }
  function stepCard() {
    return '<div class="card msl-step" id="stxS"><div class="card-head msl-head"><h2 id="stxH"></h2><span class="caption msl-min" id="stxC"></span></div>'
      + '<p class="msl-so" id="stxSo"></p><p class="caption msl-why" id="stxWhy"></p><div id="stxX"></div><div class="stx-tools" id="stxTools"></div>'
      + '<button type="button" class="toggle-btn stx-exs" id="stxExB" aria-expanded="false" aria-controls="stxExS"></button><div class="stb stx-exc" id="stxExS" hidden></div>'   // v166
      + '<p class="caption msl-msg stx-msg" role="status"></p>'
      + '<div class="msl-foot"><button type="button" class="toggle-btn msl-done" id="stxDone"></button><button type="button" class="toggle-btn" id="stxTipsB" aria-expanded="false" aria-controls="stxTips">' + esc(u('tips')) + '</button>'
      + '<button type="button" class="toggle-btn msl-nx" id="stxNext"></button></div><div class="msl-tips" id="stxTips" hidden></div></div>';
  }
  function build() {
    const r = $('stxRoot'); if (!r) return;
    if (!built) {
      r.innerHTML = '<div class="stx" translate="no">' + navHtml() + '<div class="msl-wrap stx-wf" id="stxWf">' + planCard() + stepCard() + '</div><div class="card stb stx-exw" id="stxExW" hidden></div><div id="stxLf" hidden></div><div class="stx-nbw" id="stxNb" hidden></div></div>';
      r.addEventListener('click', onClick); r.addEventListener('input', onInput); r.addEventListener('change', onChange); r.addEventListener('keydown', onKey);
      built = true;
    }
    const pr = rec(); sel = pr && pr.s ? pr.s : 1;
    paint();
  }
  function paint() {
    const v = ['wf', 'lf', 'nb'].includes(D.view) ? D.view : 'wf';
    document.querySelectorAll('#stxRoot .stx-nav [data-view]').forEach(b => { const on = b.dataset.view === v; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
    $('stxWf').hidden = v !== 'wf'; $('stxLf').hidden = v !== 'lf'; $('stxNb').hidden = v !== 'nb';
    if (v === 'wf') { paintPlan(); paintStep(); } else if (v === 'lf') paintLf(); else paintNb();
    paintExAll();   // v166
  }
  function setView(v) { D.view = v; store(); if (window.SW && SW.mark) SW.mark(v); say(''); paint(); const r = $('stxRoot'); if (r && r.scrollIntoView && r.getBoundingClientRect().top < 0) r.scrollIntoView({ block: 'start' }); }

  /* ---------- Workflow ---------- */
  function songOpts(selK, withNew) {
    return '<option value="_"' + (selK === '_' ? ' selected' : '') + '>' + esc(u('none')) + '</option>'
      + songs().map(s => '<option value="l:' + esc(s.id) + '"' + ('l:' + s.id === selK ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('')
      + (withNew ? '<option value="+">' + esc(u('newOpt')) + '</option>' : '');
  }
  function paintPlan() {
    const k = curKey(), pr = rec(k), done = pr ? pr.d : [], s = curSong(); lastK = k;
    const html = songOpts(k, true), el = $('stxSong'); if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; } el.value = k;
    if (s) { const v = verOf(s), n = v.parts.length; $('stxMeta').textContent = (n ? n + ' ' + u('parts') : u('noParts0')) + ' · ' + u('ver') + ' V' + (v.n || s.cur + 1) + (pr && pr.k ? ' · „' + pr.k.slice(0, 60) + '“' : ''); }
    else $('stxMeta').textContent = u('meta0');
    $('stxCnt').textContent = done.length + ' ' + u('of') + ' ' + NS;
    $('stxL').innerHTML = STEPS.map((S, i) => {
      const n = i + 1, ok = done.includes(n);
      return '<button type="button" role="listitem" class="msl-r' + (ok ? ' ok' : '') + (n === sel ? ' on' : '') + '" data-s="' + n + '" aria-current="' + (n === sel ? 'step' : 'false') + '">'
        + '<i aria-hidden="true">' + (ok ? '✓' : n) + '</i><span><b>' + esc(tx(S.t)) + '</b><small>' + esc(tx(S.c)) + '</small></span>' + (ok ? '<em class="sr">' + (EN() ? 'done' : 'geschafft') + '</em>' : '') + '</button>';
    }).join('');
  }
  function paintStep() {
    const S = STEPS[sel - 1], pr = rec(), ok = !!(pr && pr.d.includes(sel));
    $('stxH').textContent = u('step') + ' ' + sel + ' · ' + tx(S.t);
    $('stxC').textContent = tx(S.c);
    $('stxSo').innerHTML = '<b>' + esc(u('so')) + '</b> ' + esc(tx(S.so));
    $('stxWhy').textContent = u('why') + ' ' + tx(S.why);
    const d = $('stxDone'); d.textContent = ok ? u('undone') : u('done'); d.classList.toggle('active', ok); d.setAttribute('aria-pressed', String(ok));
    const nb = $('stxNext'); nb.hidden = sel >= NS; nb.textContent = u('next');
    $('stxTips').innerHTML = '<b>' + esc(u('tipH')) + '</b><ul>' + S.tips.map(t => '<li>' + esc(tx(t)) + '</li>').join('') + '</ul><b>' + esc(u('okH')) + '</b><p>' + esc(tx(S.ok)) + '</p>';
    $('stxTools').innerHTML = (S.tools || []).map(a => '<button type="button" class="toggle-btn stx-tool" data-go="' + a + '">' + esc(tx(TOOL[a])) + ' ›</button>').join('');
    paintX(); paintEx();
  }
  function paintX() {
    const S = STEPS[sel - 1], x = $('stxX'), pr = rec() || {}, s = curSong();
    if (S.x === 'kern') {
      x.innerHTML = '<div class="msl-xbox stx-x"><label class="stx-f"><span class="caption">' + esc(u('kern')) + '</span><textarea id="stxKern" rows="2" maxlength="200" placeholder="' + esc(u('kernPh')) + '">' + esc(pr.k || '') + '</textarea></label>'
        + '<div class="stx-row"><button type="button" class="toggle-btn" data-a="kern2" ' + (s ? '' : 'disabled') + '>' + esc(u('kern2')) + '</button><button type="button" class="toggle-btn" data-a="dice">' + esc(u('dice')) + '</button></div><div class="stx-dice" id="stxDice"></div></div>';
      paintDice();
    } else if (S.x === 'hook') {
      const ts = D.n.filter(n => n.k === 't').slice(0, 6);
      x.innerHTML = '<div class="msl-xbox stx-x"><label class="stx-f"><span class="caption">' + esc(u('hook')) + '</span><input type="text" id="stxHook" maxlength="80" value="' + esc(pr.h || '') + '" placeholder="' + esc(u('hookPh')) + '"></label>'
        + '<div class="stx-row"><button type="button" class="toggle-btn" data-a="hook2nb">' + esc(u('hook2nb')) + '</button><button type="button" class="toggle-btn" data-a="nbTitles">' + esc(u('nbTitles')) + '</button></div>'
        + (ts.length ? '<p class="caption">' + esc(u('fromNb')) + '</p><div class="stx-chips">' + ts.map(n => '<button type="button" class="toggle-btn stx-chip" data-a="hookPick" data-id="' + esc(n.id) + '">' + esc(n.x.slice(0, 60)) + '</button>').join('') + '</div>' : '') + '</div>';
    } else if (S.x === 'wf') {
      const w = (pr.wf && pr.wf.w) || [];
      x.innerHTML = '<div class="msl-xbox stx-x"><div class="stx-row"><label class="stx-f stx-g"><span class="caption">' + esc(u('wfT')) + '</span><input type="text" id="stxWfT" maxlength="60" value="' + esc(pr.wf ? pr.wf.t : '') + '" placeholder="' + esc(u('wfTPh')) + '"></label></div>'
        + '<div class="stx-row"><label class="stx-f stx-g"><span class="caption">' + esc(u('wfIn')) + '</span><input type="text" id="stxWfIn" maxlength="200" placeholder="' + esc(u('wfInPh')) + '" autocapitalize="off"></label><button type="button" class="toggle-btn active stx-end" data-a="wfAdd">' + esc(u('add')) + '</button></div>'
        + '<p class="caption">' + esc(u('wfSense')) + ' · <b id="stxWfN">' + w.length + '</b> ' + esc(u('words')) + '</p>'
        + '<div class="stx-chips" id="stxWfL">' + (w.length ? w.map(t => '<span class="stx-wc"><button type="button" class="toggle-btn stx-chip' + (t === rhW ? ' active' : '') + '" data-a="wfRh" data-w="' + esc(t) + '">' + esc(t) + '</button><button type="button" class="toggle-btn stx-x1" data-a="wfDel" data-w="' + esc(t) + '" aria-label="' + esc(t + ' ' + u('del')) + '">×</button></span>').join('') : '<p class="caption">' + esc(u('wfNone')) + '</p>') + '</div>'
        + '<div class="stx-rh" id="stxRh"></div></div>';
      if (rhW) rhymes(rhW);
    } else if (S.x === 'tpl') {
      const T0 = TPL.find(t => t.id === tpl) || TPL[0], has = s && verOf(s).parts.length, key = s ? newest(s).key : { pc: 0, major: true }, C = LC();
      const prev = T0.parts.map(p => '<li><b>' + esc(tx(PN[p.y])) + '</b> · ' + p.n + ' ' + esc(u('lines')) + ' · ' + esc(u('rhyme')) + ' ' + p.r + ' · <span class="stx-ch">' + esc(p.ch.map(d => C ? C.cname(chordOf(key, d, p.b7), key) : '').join(' ')) + '</span></li>').join('');
      const flow = T0.order.map(i => tx(PN[T0.parts[i].y])).join(' → ');
      x.innerHTML = '<div class="msl-xbox stx-x"><p class="caption">' + esc(u('tplH')) + '</p><div class="stx-tpls">' + TPL.map(t => '<button type="button" class="toggle-btn stx-tpl' + (t.id === T0.id ? ' active' : '') + '" data-tpl="' + t.id + '" aria-pressed="' + (t.id === T0.id) + '"><b>' + esc(tx(t.n)) + '</b><small>' + esc(tx(t.d)) + '</small></button>').join('') + '</div>'
        + '<p class="stx-flow">' + esc(flow) + '</p><ul class="stx-prev">' + prev + '</ul><p class="caption">' + esc(u('tplAkk')) + '</p>'
        + (s ? '<p class="caption">' + esc(u(has ? 'tplVerN' : 'tplFillN')) + '</p><button type="button" class="toggle-btn active" id="stxTplGo" data-a="tplGo">' + esc(u(has ? 'tplVer' : 'tplFill')) + '</button>'
          : '<p class="caption">' + esc(u('tplNewN')) + '</p><div class="stx-row"><label class="stx-f stx-g"><span class="caption">' + esc(u('tplName')) + '</span><input type="text" id="stxTplN" maxlength="40" value="' + esc(pr.h || '') + '" placeholder="' + esc(u('newSongDef')) + '"></label><button type="button" class="toggle-btn active stx-end" id="stxTplGo" data-a="tplGo">' + esc(u('tplNew')) + '</button></div>') + '</div>';
    } else if (S.x === 'chk') {
      const c = pr.c || [], all = c.length >= CHECK.length;
      let auto = '';
      if (s) {
        const v = verOf(s), A = LA(), sl = A && v.parts.length ? A.textSlots(v) : [], fill = sl.filter(z => String((z.p.lyrics || [])[z.n] || '').trim()).length;
        const ct = v.parts.filter(p => p.type === 'chorus').map(p => (p.lyrics || []).join('\n')).join('\n').replace(/\[[^\]]*\]/g, '').toLowerCase();
        const h = String(pr.h || s.name || '').toLowerCase().replace(/[^\p{L}\d ]/gu, '').trim();
        auto = '<p class="caption stx-auto">' + esc(u('chkHook')) + ' <b>' + esc(h && ct.replace(/[^\p{L}\d\n ]/gu, '').includes(h) ? u('yes') : u('no')) + '</b> · ' + esc(u('chkFill')) + ' <b>' + fill + ' / ' + sl.length + '</b></p>';
      }
      x.innerHTML = '<div class="msl-xbox stx-x"><p class="stx-ckh"><b>' + esc(u('chkH')) + '</b></p>' + auto + '<div class="stx-cks">' + CHECK.map((t, i) => { const on = c.includes(i);
        return '<button type="button" class="stx-ck' + (on ? ' on' : '') + '" data-ck="' + i + '" aria-pressed="' + on + '"><i aria-hidden="true">' + (on ? '✓' : '') + '</i><span>' + esc(tx(t)) + '</span></button>'; }).join('') + '</div>'
        + (all ? '<p class="stx-allok">' + esc(u('chkAll')) + '</p>' : '') + '</div>';
    } else if (sel === 9 && window.SW && SW.raster) { x.innerHTML = '<div class="msl-xbox stx-x" id="stxRaster"></div>'; SW.raster($('stxRaster')); }   // v167: Silben-Raster
    else x.innerHTML = '';
  }
  function setDone(n, on) { const pr = rec(null, true), i = pr.d.indexOf(n); if (on && i < 0) pr.d.push(n); if (!on && i >= 0) pr.d.splice(i, 1); pr.d.sort((a, b) => a - b); touch(pr); D.cur = curKey(); store(); }
  function goStep(n) { sel = Math.max(1, Math.min(NS, n)); const pr = rec(); if (pr) { pr.s = sel; store(); } rhW = ''; say(''); paintPlan(); paintStep(); }

  /* ---------- Schreibimpulse ---------- */
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function roll() { dice = { t: pick(DICE.t), p: pick(DICE.p), b: pick(DICE.b) }; paintDice(); }
  function diceText() { return dice ? u('dTopic') + ': ' + tx(dice.t) + ' · ' + u('dPersp') + ': ' + tx(dice.p) + ' · ' + u('dImg') + ': ' + tx(dice.b) : ''; }
  function paintDice() {
    ['stxDice', 'stxDice2'].forEach(id => { const el = $(id); if (!el) return;
      el.innerHTML = dice ? '<div><span class="caption">' + esc(u('dTopic')) + '</span><b>' + esc(tx(dice.t)) + '</b></div><div><span class="caption">' + esc(u('dPersp')) + '</span><b>' + esc(tx(dice.p)) + '</b></div><div><span class="caption">' + esc(u('dImg')) + '</span><b>' + esc(tx(dice.b)) + '</b></div>'
        + (id === 'stxDice' ? '<button type="button" class="toggle-btn" data-a="diceSave">' + esc(u('diceSave')) + '</button>' : '') : ''; });
    const s2 = $('stxDiceS'); if (s2) s2.disabled = !dice;
  }

  /* ---------- Wortfeld + Reimwörter (Text-Werkstatt v164, Liste erst bei Bedarf) ---------- */
  function wfAdd() {
    const inp = $('stxWfIn'); if (!inp) return; const pr = rec(null, true);
    const add = inp.value.split(/[,;\n]+/).map(t => t.trim().slice(0, 40)).filter(Boolean);
    if (!add.length) { inp.focus(); return; }
    add.forEach(t => { if (!pr.wf.w.some(x => x.toLowerCase() === t.toLowerCase()) && pr.wf.w.length < 300) pr.wf.w.push(t); });
    touch(pr); D.cur = curKey(); store(); inp.value = ''; paintX(); const i2 = $('stxWfIn'); if (i2) i2.focus();
  }
  function rhymes(w) {
    const box = $('stxRh'); if (!box) return; rhW = w;
    const word = String(w).trim().split(/\s+/).pop();
    const show = () => {
      if (rhW !== w || !$('stxRh')) return;
      const r = window.TextWerk ? TextWerk.rhymesFor(word, 60) : { rein: [], unrein: [] };
      const have = new Set(((rec() || {}).wf || { w: [] }).w.map(x => x.toLowerCase()));
      const ch = (l, cls) => l.map(t => { const on = have.has(t.toLowerCase()); return '<button type="button" class="toggle-btn stx-chip ' + cls + (on ? ' active' : '') + '" data-a="wfTake" data-w="' + esc(t) + '"' + (on ? ' disabled' : '') + '>' + esc(t) + '</button>'; }).join('');
      $('stxRh').innerHTML = '<p class="caption"><b>' + esc(u('rhH')) + ' „' + esc(word) + '“</b> ' + (EN() ? esc(u('rhDe')) + ' ' : '') + '· ' + esc(u('rhTap')) + '</p>'
        + (r.rein.length || r.unrein.length ? (r.rein.length ? '<p class="caption">' + esc(u('rhRein')) + '</p><div class="stx-chips">' + ch(r.rein.slice(0, 30), '') + '</div>' : '')
          + (r.unrein.length ? '<p class="caption">' + esc(u('rhUnrein')) + '</p><div class="stx-chips">' + ch(r.unrein.slice(0, 16), 'stx-un') + '</div>' : '') : '<p class="caption">' + esc(u('rhNone')) + '</p>');
    };
    const fail = () => { if (rhW === w && $('stxRh')) $('stxRh').innerHTML = '<p class="caption warn">' + esc(u('rhFail')) + '</p>'; };
    const run = () => TextWerk.loadList().then(show, fail);
    if (window.TextWerk && TextWerk.list) { show(); return; }
    box.innerHTML = '<p class="caption">' + esc(u('rhLoad')) + '</p>';
    const A = LA(); if (window.TextWerk) run(); else if (A && A.twLoad) A.twLoad(() => { if (window.TextWerk) run(); else fail(); }); else fail();
  }

  /* ---------- Aufbau-Vorlagen: nur leerer Song oder neue Version (nichts überschreiben) ---------- */
  function applyTpl() {
    const T0 = TPL.find(t => t.id === tpl) || TPL[0], A = LA(), C = LC(); if (!A || !C || !A.newSong) { say(u('noLied'), true); return; }
    let s = curSong(), how;
    if (!s) {
      const nm = (($('stxTplN') && $('stxTplN').value) || '').trim() || u('newSongDef');
      s = A.newSong(nm.slice(0, 40)); if (!s) return;
      const old = rec('_'), k = 'l:' + s.id; D.cur = k; const r = rec(k, true); r.n = s.name;
      if (old) { r.k = old.k || ''; r.h = old.h || ''; r.wf = { t: old.wf.t || '', w: old.wf.w.slice() }; }   // Kernsatz/Titel/Wortfeld von „ohne Song“ mitnehmen
      how = 'new';
    }
    A.select(s.id);
    const last = newest(s), built0 = tplParts(T0, last.key);
    if (!last.parts.length) { last.parts = built0.parts; last.order = built0.order; s.cur = s.versions.length - 1; A.save(); how = how || 'fill'; }
    else { s.cur = s.versions.length - 1; const nv = C.clone(last); nv.parts = built0.parts; nv.order = built0.order; A.pushVersion(nv, (EN() ? 'Template: ' : 'Vorlage: ') + tx(T0.n)); how = 'ver'; }
    const v = newest(s), pr = rec('l:' + s.id, true); touch(pr); store();
    const names = [...new Set(built0.parts.map(p => p.name))].join(', ');
    paintPlan(); paintStep();
    say(u('tplOk').replace('%n', built0.parts.length).replace('%p', names).replace('%s', s.name).replace('%v', (how === 'ver' ? u('vNew') : u('vSame')) + v.n));
    return how;
  }

  /* ---------- Sprünge in die Werkzeuge ---------- */
  function go(a) {
    if (a === 'nb') { setView('nb'); return; }
    if (a === 'looper') { NAV('looper'); return; }
    if (a === 'singlernen') { toSing(); return; }
    const A = LA(); if (!A || !A.select) { say(u('noLied'), true); return; }
    const s = curSong(); if (!s) { say(u('pickSong'), true); return; }
    const v = verOf(s), has = v && v.parts.length;
    if (a !== 'lied' && !has) { noParts(); return; }
    if (a === 'songbook') { toSongbook(s); return; }
    A.select(s.id); NAV('lied');
    const SW = window.SW;   // v167: Ziele liegen im Songwriting – passender Bereich
    if (SW && a.startsWith('tw:')) {
      const pane = a.slice(3);
      SW.area('tw', () => { const box = $('ldTwBox'); if (!box) return; const b = box.querySelector('[data-pane="' + pane + '"]'); if (b && !b.classList.contains('active')) b.click(); if (box.scrollIntoView) box.scrollIntoView({ block: 'start' }); });
      return;
    }
    if (SW) SW.area('song');
    if (a === 'lied') { const r = $('panel-lied'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'start' }); return; }
    if (a === 'text') { const c = $('ldTextCard'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'start' }); return; }
    if (a === 'pdf') { const b = $('ldPdf'); if (b) { b.scrollIntoView({ block: 'center' }); b.classList.add('stx-flash'); try { b.focus({ preventScroll: true }); } catch (e) {} setTimeout(() => b.classList.remove('stx-flash'), 2600); } return; }
    if (a.startsWith('tw:')) {
      const pane = a.slice(3);
      A.twLoad(() => {
        if (!window.AppNav || AppNav.current() !== 'lied') return;
        const box = $('ldTwBox'), tb = $('ldTw'); if (!box || !tb) return;
        if (box.hidden) tb.click();
        const b = box.querySelector('[data-pane="' + pane + '"]'); if (b && !b.classList.contains('active')) b.click();
        if (box.scrollIntoView) box.scrollIntoView({ block: 'start' });
      });
    }
  }
  function noParts() { say(u('noParts'), true); const m = document.querySelector('#stxWf .stx-msg'); if (m && sel !== 4) m.insertAdjacentHTML('beforeend', ' <button type="button" class="toggle-btn stx-sm" data-a="to4">' + esc(u('toStep4')) + '</button>'); }
  function sbText(s, v) {
    const C = LC(), A = LA(), out = [];
    A.textSlots(v).forEach(z => {
      const p = z.p, ly = String((p.lyrics || [])[z.n] || '').trim();
      out.push('[' + p.name + (z.multi ? ' ' + (z.n + 1) : '') + ']');
      const ch = p.chords.map(c => C.cname(c, v.key)).join(' '); if (ch) out.push(ch);
      if (ly) out.push(ly.replace(/\[[^\]]*\]/g, ''));
      out.push('');
    });
    return out.join('\n').trim();
  }
  function waitFor(f, ms) { return new Promise(r => { const t0 = Date.now(); (function w() { if (f()) return r(true); if (Date.now() - t0 > ms) return r(false); setTimeout(w, 60); })(); }); }
  function toSongbook(s) {
    const v = verOf(s), now = Date.now(), id = 'lt' + s.id;
    const it = { id, t: s.name.slice(0, 80), r: v.key.pc, m: v.key.major === false ? 'Äolisch (Moll)' : 'Ionisch (Dur)', b: Math.round(v.bpm), ts: '4/4', x: sbText(s, v), c: now, e: now };
    NAV('songbook');
    waitFor(() => window.Songbook && Songbook.built && Songbook.built(), 8000).then(ok => {
      if (!ok) return;
      const d = Songbook.load(), ex = (d.s || []).find(x => x.id === id);
      if (ex) { if (!confirm(u('sbUpd'))) { d.sel = id; Songbook.store(d); Songbook.open(); return; } Songbook.merge([Object.assign({}, ex, { t: it.t, r: it.r, m: it.m, b: it.b, x: it.x, e: now })]); }
      else Songbook.merge([it]);
      const d2 = Songbook.load(); d2.sel = id; Songbook.store(d2); Songbook.open();
    });
  }
  function toSing() {
    const s = curSong();
    if (s) {   // steht der Song im Songbook, wählt „Mitsingen lernen“ ihn vor (nur „cur“ setzen)
      try {
        const sb = JSON.parse(localStorage.getItem(SBKEY) || 'null');
        if (sb && Array.isArray(sb.s) && sb.s.some(x => x.id === 'lt' + s.id)) {
          let m = null; try { m = JSON.parse(localStorage.getItem(MSKEY) || 'null'); } catch (e) {}
          if (!m || typeof m !== 'object' || !m.p) m = { v: 1, w: 'g', cur: '', p: {} };
          m.cur = 'sb:lt' + s.id; localStorage.setItem(MSKEY, JSON.stringify(m));
        }
      } catch (e) {}
    }
    NAV('singlernen');
  }

  /* ---------- Ideen-Notizbuch ---------- */
  const fmtD = t => { const d = new Date(t); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getFullYear()).slice(2); };
  function tagsOf(str, text) {
    const g = String(str || '').split(/[,;]+|\s+(?=#)/).map(t => t.trim().replace(/^#+/, '').toLowerCase().slice(0, 24)).filter(Boolean);
    (String(text || '').match(/#[\p{L}\d-]+/gu) || []).forEach(t => g.push(t.slice(1).toLowerCase().slice(0, 24)));
    return [...new Set(g)].slice(0, 8);
  }
  function addNote(x, k, g) {
    x = String(x || '').trim().slice(0, 600); if (!x) return null;
    const n = { id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), x, k: ['z', 't', 'b', 'i'].includes(k) ? k : 'z', g: g || [], at: Date.now() };
    D.n.unshift(n); store(); return n;
  }
  function paintNb() {
    const w = $('stxNb');
    if (!w.dataset.b) {
      w.dataset.b = '1';
      w.innerHTML = '<div class="card stx-nbc"><div class="card-head msl-head"><h2>' + esc(u('nb')) + '</h2><span class="caption" id="stxNbCnt"></span></div>'
        + '<div class="stx-in"><textarea id="stxNbX" rows="2" maxlength="600" placeholder="' + esc(u('nbIn')) + '" aria-label="' + esc(u('nbIn')) + '"></textarea>'
        + '<div class="stx-row"><div class="stx-seg" id="stxNbK" role="group">' + KINDS.map(k => '<button type="button" class="toggle-btn" data-nk="' + k[0] + '">' + esc(u(k[1])) + '</button>').join('') + '</div>'
        + '<input type="text" id="stxNbG" class="stx-g" maxlength="120" placeholder="' + esc(u('nbTags')) + '" aria-label="' + esc(u('nbTags')) + '" autocapitalize="off"><button type="button" class="toggle-btn active" data-a="nbAdd" id="stxNbAdd">' + esc(u('nbAdd')) + '</button></div></div>'
        + '<div class="stx-row"><input type="search" id="stxNbQ" class="stx-g" placeholder="' + esc(u('nbQ')) + '" aria-label="' + esc(u('nbQ')) + '"><div class="stx-seg" id="stxNbF" role="group"><button type="button" class="toggle-btn" data-nf="">' + esc(u('all')) + '</button>'
        + KINDS.map(k => '<button type="button" class="toggle-btn" data-nf="' + k[0] + '">' + esc(u(k[2])) + '</button>').join('') + '</div></div>'
        + '<div class="stx-chips stx-tags" id="stxNbT"></div><p class="caption msl-msg stx-msg" role="status"></p><div class="stx-list" id="stxNbL"></div>'
        + '<div class="stx-row stx-io"><button type="button" class="toggle-btn" data-a="nbExp" id="stxExp">' + esc(u('exp')) + '</button><button type="button" class="toggle-btn" data-a="nbImp" id="stxImp">' + esc(u('imp')) + '</button>'
        + '<input type="file" id="stxFile" accept=".json,application/json" hidden></div><p class="caption">' + esc(u('backup')) + '</p></div>'
        + '<div class="card stx-impc"><div class="card-head msl-head"><h2>' + esc(u('impH')) + '</h2></div><p class="caption">' + esc(u('impD')) + '</p><div class="stx-dice" id="stxDice2"></div>'
        + '<div class="stx-row"><button type="button" class="toggle-btn active" data-a="dice">' + esc(u('diceAgain')) + '</button><button type="button" class="toggle-btn" data-a="diceSave" id="stxDiceS">' + esc(u('diceSave')) + '</button></div></div>';
      $('stxFile').addEventListener('change', onImport);
    }
    if (!nbKind) nbKind = 'z';
    document.querySelectorAll('#stxNbK [data-nk]').forEach(b => { const on = b.dataset.nk === nbKind; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    document.querySelectorAll('#stxNbF [data-nf]').forEach(b => { const on = b.dataset.nf === nbF; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    paintDice(); paintNbList();
  }
  function hits() {
    const q = (($('stxNbQ') && $('stxNbQ').value) || '').trim().toLowerCase();
    return D.n.filter(n => (!nbF || n.k === nbF) && (!q || (q.startsWith('#') ? n.g.includes(q.slice(1)) : n.x.toLowerCase().includes(q) || n.g.some(g => g.includes(q)))));
  }
  function paintNbList() {
    const L = $('stxNbL'); if (!L) return;
    $('stxNbCnt').textContent = D.n.length + ' ' + u('nbCnt');
    const tc = {}; D.n.forEach(n => n.g.forEach(g => { tc[g] = (tc[g] || 0) + 1; }));
    const q = (($('stxNbQ') && $('stxNbQ').value) || '').trim().toLowerCase();
    $('stxNbT').innerHTML = Object.keys(tc).sort((a, b) => tc[b] - tc[a] || a.localeCompare(b)).slice(0, 14).map(g => '<button type="button" class="toggle-btn stx-chip' + (q === '#' + g ? ' active' : '') + '" data-tag="' + esc(g) + '">#' + esc(g) + ' <small>' + tc[g] + '</small></button>').join('');
    const h = hits();
    L.innerHTML = !D.n.length ? '<p class="caption">' + esc(u('nbNone')) + '</p>' : !h.length ? '<p class="caption">' + esc(u('nbNoHit')) + '</p>' : h.slice(0, 200).map(n => {
      const kk = KINDS.find(k => k[0] === n.k) || KINDS[0];
      return '<div class="stx-ni k-' + n.k + '" data-id="' + esc(n.id) + '"><div class="stx-nh"><span class="stx-kind">' + esc(u(kk[1])) + '</span><span class="caption">' + fmtD(n.at) + '</span>'
        + (n.g.length ? '<span class="stx-tg">' + n.g.map(g => '#' + esc(g)).join(' ') + '</span>' : '') + '</div><p class="stx-nt">' + esc(n.x) + '</p>'
        + '<div class="stx-row"><button type="button" class="toggle-btn' + (takeId === n.id ? ' active' : '') + '" data-a="nbTake" data-id="' + esc(n.id) + '">' + esc(u('take')) + '</button><button type="button" class="toggle-btn" data-a="nbDel" data-id="' + esc(n.id) + '">' + esc(u('delB')) + '</button></div>'
        + (takeId === n.id ? takeHtml(n) : '') + '</div>';
    }).join('');
  }
  function takeHtml(n) {
    const ss = songs();
    if (!ss.length) return '<div class="stx-take"><p class="caption">' + esc(u('tkNoSongs')) + '</p>' + (n.k === 't' ? '<button type="button" class="toggle-btn" data-a="tkNew">' + esc(u('tkNew')) + '</button>' : '') + '</div>';
    if (!ss.some(s => s.id === tkSong)) { const c = curSong(); tkSong = c ? c.id : ss[ss.length - 1].id; }
    const s = ss.find(x => x.id === tkSong), v = newest(s), A = LA(), sl = v.parts.length && A ? A.textSlots(v) : [];
    return '<div class="stx-take"><div class="stx-row"><label class="stx-f stx-g"><span class="caption">' + esc(u('tkSong')) + '</span><select id="stxTkS">' + ss.map(x => '<option value="' + esc(x.id) + '"' + (x.id === tkSong ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>'
      + (sl.length ? '<label class="stx-f stx-g"><span class="caption">' + esc(u('tkPart')) + '</span><select id="stxTkP">' + sl.map((z, i) => { const t = String((z.p.lyrics || [])[z.n] || '').trim(), nl = t ? t.split('\n').filter(Boolean).length : 0;
        return '<option value="' + i + '">' + esc(z.p.name + (z.multi ? ' · ' + (z.n + 1) + u('times') : '') + ' (' + (nl ? nl + ' ' + u('lines') : u('emptyPart')) + ')') + '</option>'; }).join('') + '</select></label>' : '') + '</div>'
      + (sl.length ? '' : '<p class="caption">' + esc(u('noParts')) + '</p>')
      + '<div class="stx-row">' + (sl.length ? '<button type="button" class="toggle-btn active" data-a="tkGo">' + esc(u('tkGo')) + '</button>' : '<button type="button" class="toggle-btn" data-a="to4s">' + esc(u('toStep4')) + '</button>')
      + (n.k === 't' ? '<button type="button" class="toggle-btn" data-a="tkNew">' + esc(u('tkNew')) + '</button>' : '') + '<button type="button" class="toggle-btn" data-a="tkX">' + esc(u('cancel')) + '</button></div></div>';
  }
  function takeGo() {
    const n = D.n.find(x => x.id === takeId), A = LA(), C = LC(); if (!n || !A || !C) return;
    const s = songs().find(x => x.id === ($('stxTkS') ? $('stxTkS').value : tkSong)); if (!s) return;
    const last = newest(s), sl = A.textSlots(last), z = sl[+($('stxTkP') ? $('stxTkP').value : -1)]; if (!z) return;
    const nv = C.clone(last), p = C.partById(nv, z.p.id); if (!p) return;
    const L = (p.lyrics || []).slice(); while (L.length <= z.n) L.push('');
    const old = String(L[z.n] || '').replace(/\s+$/, ''); L[z.n] = (old ? old + '\n' : '') + n.x; p.lyrics = L;
    A.select(s.id); s.cur = s.versions.length - 1; A.pushVersion(nv, EN() ? 'Note added' : 'Notiz übernommen');
    takeId = ''; paintNbList();
    say(u('tkOk').replace('%p', z.p.name + (z.multi ? ' · ' + (z.n + 1) + u('times') : '')).replace('%s', s.name).replace('%v', u('vNew') + newest(s).n));
  }
  function takeNew() {
    const n = D.n.find(x => x.id === takeId), A = LA(); if (!n || !A || !A.newSong) return;
    const s = A.newSong(n.x.split('\n')[0].slice(0, 40)); if (!s) return;
    D.cur = 'l:' + s.id; const r = rec(D.cur, true); r.n = s.name; if (!r.h) r.h = s.name; store();
    takeId = ''; tkSong = s.id; paintNbList(); say(u('tkNewOk').replace('%s', s.name));
  }
  async function exportFile() {
    const keys = Object.keys(D.p), json = JSON.stringify({ app: '3nps-songtext', v: 1, at: new Date().toISOString(), n: D.n, p: D.p }, null, 1);
    const dt = new Date(), name = 'songtext-' + dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0') + '.json';
    const file = new File([json], name, { type: 'application/json' }); window.__stxExport = { name, json };
    say(u('expOk').replace('%n', D.n.length).replace('%p', keys.length));
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: u('nb') }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  // Zusammenführen ohne Doppeltes: gleiche id oder gleicher Text = schon vorhanden; Songs: fehlende ergänzen, Wortfeld-Wörter vereinigen
  function merge(j) {
    let add = 0, same = 0, pa = 0;
    (Array.isArray(j.n) ? j.n : []).forEach(x => {
      if (!x || typeof x !== 'object' || !String(x.x || '').trim()) return;
      const id = String(x.id || ''), t = String(x.x).trim().slice(0, 600);
      if ((id && D.n.some(y => y.id === id)) || D.n.some(y => y.x === t)) { same++; return; }
      D.n.push({ id: id || 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), x: t, k: ['z', 't', 'b', 'i'].includes(x.k) ? x.k : 'z', g: Array.isArray(x.g) ? x.g.map(g => String(g).toLowerCase().slice(0, 24)).slice(0, 8) : [], at: +x.at || Date.now() }); add++;
    });
    if (j.p && typeof j.p === 'object') Object.keys(j.p).forEach(k => {
      const r = j.p[k]; if (!r || typeof r !== 'object' || !/^(l:|_$)/.test(k)) return;
      if (!D.p[k]) { D.p[k] = { n: String(r.n || ''), d: Array.isArray(r.d) ? r.d.filter(n => n >= 1 && n <= NS) : [], s: +r.s || 0, k: String(r.k || '').slice(0, 200), h: String(r.h || '').slice(0, 80),
        wf: { t: String(r.wf && r.wf.t || '').slice(0, 60), w: r.wf && Array.isArray(r.wf.w) ? r.wf.w.map(String).slice(0, 300) : [] }, c: Array.isArray(r.c) ? r.c.filter(i => i >= 0 && i < CHECK.length) : [], e: +r.e || Date.now() }; pa++; return; }
      const o = rec(k); (r.wf && Array.isArray(r.wf.w) ? r.wf.w : []).forEach(t => { t = String(t); if (!o.wf.w.some(x => x.toLowerCase() === t.toLowerCase())) o.wf.w.push(t); });
    });
    D.n.sort((a, b) => b.at - a.at);
    return store() ? { add, same, pa } : null;
  }
  function onImport() {
    const f = $('stxFile').files[0]; $('stxFile').value = ''; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let j = null; try { j = JSON.parse(rd.result); } catch (e) { j = null; }
      if (!j || j.app !== '3nps-songtext') { say(u('impBad'), true); return; }
      const r = merge(j); if (!r) return; paintNbList();
      say(u('impOk').replace('%a', r.add).replace('%s', r.same).replace('%p', r.pa));
    };
    rd.readAsText(f);
  }

  /* ---------- Leitfaden ---------- */
  function paintLf() {
    const w = $('stxLf');
    w.innerHTML = '<div class="card stx-lfc"><div class="card-head msl-head"><h2>' + esc(u('lf')) + '</h2><button type="button" class="toggle-btn stx-sm" data-a="lfAll">' + esc(u(Object.keys(openG).length >= GUIDE.length ? 'lfNone' : 'lfAll')) + '</button></div>'
      + '<div class="stx-row stx-lfex"><button type="button" class="toggle-btn stx-exb" data-a="exAllLf" aria-expanded="' + exAll + '" aria-controls="stxExW">' + esc(u('exAll')) + '</button>' + exBtn() + '</div>'   // v167: Beispiel hier
      + '<p class="caption">' + esc(u('lfIntro')) + '</p><div class="stx-topics">' + GUIDE.map((G, i) => {
        const on = !!openG[i];
        return '<div class="stx-t' + (on ? ' on' : '') + '"><button type="button" class="stx-th" data-g="' + i + '" aria-expanded="' + on + '" aria-controls="stxG' + i + '"><span>' + (i + 1) + '. ' + esc(tx(G.t)) + '</span><i aria-hidden="true">' + (on ? '−' : '+') + '</i></button>'
          + '<div class="stx-tb" id="stxG' + i + '"' + (on ? '' : ' hidden') + '><p>' + esc(tx(G.p)) + '</p><div class="stx-ex"><b>' + esc(u('lfEx')) + '</b>' + G.ex.map(e => '<p><span class="stx-el">' + esc(tx(e[0])) + ':</span> ' + esc(tx(e[1])) + '</p>').join('') + '</div>'
          + (G.go ? '<button type="button" class="toggle-btn stx-tool" data-go="' + G.go + '">' + esc(tx(TOOL[G.go])) + ' ›</button>' : '') + '</div></div>';
      }).join('') + '</div><p class="caption msl-msg stx-msg" role="status"></p></div>';
  }

  /* ---------- Bedienung ---------- */
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.view) { setView(b.dataset.view); return; }
    if (b.dataset.s && b.classList.contains('msl-r')) { goStep(+b.dataset.s); return; }
    if (b.dataset.go) { go(b.dataset.go); return; }
    if (b.dataset.tpl) { tpl = b.dataset.tpl; paintX(); return; }
    if (b.dataset.ck != null) { const pr = rec(null, true), i = +b.dataset.ck, k = pr.c.indexOf(i); if (k < 0) pr.c.push(i); else pr.c.splice(k, 1); touch(pr); D.cur = curKey(); store(); paintX(); return; }
    if (b.dataset.g != null) { const i = +b.dataset.g; if (openG[i]) delete openG[i]; else openG[i] = 1; paintLf(); const t = document.querySelector('#stxLf [data-g="' + i + '"]'); if (t) t.focus(); return; }
    if (b.dataset.nk) { nbKind = b.dataset.nk; paintNb(); return; }
    if (b.dataset.nf != null) { nbF = b.dataset.nf; paintNb(); return; }
    if (b.dataset.tag) { const q = $('stxNbQ'), t = '#' + b.dataset.tag; q.value = q.value.trim().toLowerCase() === t ? '' : t; paintNbList(); return; }
    const a = b.dataset.a;
    switch (b.id || a) {
      case 'stxDone': { const pr = rec(), on = !(pr && pr.d.includes(sel)); setDone(sel, on); paintPlan(); paintStep(); if (on) say(u('tick')); return; }
      case 'stxNext': goStep(sel + 1); return;
      case 'stxTipsB': { const t = $('stxTips'), o = t.hidden; t.hidden = !o; b.setAttribute('aria-expanded', String(o)); b.classList.toggle('active', o); return; }
      case 'stxNewOk': newSong(); return;
      case 'stxNewX': $('stxNew').hidden = true; return;
      case 'stxExB': exOpen = !exOpen; paintEx(); return;
      case 'stxExAll': case 'exAllLf': exAll = !exAll; paintExAll(); if (exAll) { const w = $('stxExW'); if (w && w.scrollIntoView) w.scrollIntoView({ block: 'start' }); } return;
    }
    if (a === 'exAllLf') { exAll = !exAll; paintExAll(); if (exAll) { const w = $('stxExW'); if (w && w.scrollIntoView) w.scrollIntoView({ block: 'start' }); } return; }   // v167
    switch (a) {
      case 'kern2': {
        const pr = rec(), s = curSong(), A = LA(); if (!s || !A) return; const k = pr && pr.k ? pr.k.trim() : ''; if (!k) { say(u('themeNo'), true); return; }
        const v = verOf(s); if (v.theme && v.theme.trim() && v.theme.trim() !== k && !confirm(u('themeQ').replace('%s', v.theme))) return;
        v.theme = k.slice(0, 200); A.save(); say(u('themeSet')); return;
      }
      case 'dice': roll(); return;
      case 'diceSave': if (dice) { addNote(diceText(), 'i', [EN() ? 'prompt' : 'impuls']); say(u('saved')); if (D.view === 'nb') paintNbList(); } return;
      case 'hook2nb': { const h = (($('stxHook') || {}).value || '').trim(); if (!h) { say(u('empty'), true); return; } addNote(h, 't', []); say(u('saved')); paintX(); return; }
      case 'nbTitles': nbF = 't'; setView('nb'); return;
      case 'hookPick': { const n = D.n.find(x => x.id === b.dataset.id); if (!n) return; const pr = rec(null, true); pr.h = n.x.slice(0, 80); touch(pr); D.cur = curKey(); store(); paintX(); return; }
      case 'wfAdd': wfAdd(); return;
      case 'wfDel': { const pr = rec(); if (!pr) return; const i = pr.wf.w.indexOf(b.dataset.w); if (i >= 0) pr.wf.w.splice(i, 1); if (rhW === b.dataset.w) rhW = ''; touch(pr); store(); paintX(); return; }
      case 'wfRh': { const w = b.dataset.w; if (rhW === w) { rhW = ''; paintX(); return; } rhW = w; document.querySelectorAll('#stxWfL [data-a="wfRh"]').forEach(x => x.classList.toggle('active', x.dataset.w === w)); rhymes(w); return; }
      case 'wfTake': { const pr = rec(null, true), w = b.dataset.w; if (!pr.wf.w.some(x => x.toLowerCase() === w.toLowerCase()) && pr.wf.w.length < 300) pr.wf.w.push(w); touch(pr); D.cur = curKey(); store(); paintX(); return; }
      case 'tplGo': applyTpl(); return;
      case 'exSong': exSong(); return;
      case 'exGo': go('lied'); return;
      case 'exX': exAll = false; paintExAll(); { const r = $('stxRoot'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'start' }); } return;
      case 'exStep': exOpen = true; goStep(+b.dataset.n); { const c = $('stxS'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'start' }); } return;
      case 'to4': case 'to4s': if (D.view !== 'wf') setView('wf'); if (a === 'to4s' && tkSong) { D.cur = 'l:' + tkSong; store(); const A = LA(); if (A && A.select) A.select(tkSong); } goStep(4); return;
      case 'nbAdd': {
        const t = $('stxNbX'); if (!t.value.trim()) { t.focus(); say(u('empty'), true); return; }
        addNote(t.value, nbKind || 'z', tagsOf($('stxNbG').value, t.value)); t.value = ''; $('stxNbG').value = ''; say(u('saved')); paintNbList(); t.focus(); return;
      }
      case 'nbTake': takeId = takeId === b.dataset.id ? '' : b.dataset.id; paintNbList(); return;
      case 'tkX': takeId = ''; paintNbList(); return;
      case 'tkGo': takeGo(); return;
      case 'tkNew': takeNew(); return;
      case 'nbDel': { const n = D.n.find(x => x.id === b.dataset.id); if (!n) return; if (!confirm(u('delQ').replace('%s', n.x.slice(0, 120)))) return; D.n.splice(D.n.indexOf(n), 1); if (takeId === n.id) takeId = ''; store(); paintNbList(); say(u('deleted')); return; }
      case 'nbExp': exportFile(); return;
      case 'nbImp': $('stxFile').click(); return;
      case 'lfAll': { if (Object.keys(openG).length >= GUIDE.length) openG = {}; else GUIDE.forEach((g, i) => { openG[i] = 1; }); paintLf(); return; }
    }
  }
  function onInput(e) {
    const t = e.target;
    if (t.id === 'stxKern' || t.id === 'stxHook' || t.id === 'stxWfT') {
      const pr = rec(null, true);
      if (t.id === 'stxKern') pr.k = t.value.slice(0, 200); else if (t.id === 'stxHook') pr.h = t.value.slice(0, 80); else pr.wf.t = t.value.slice(0, 60);
      touch(pr); D.cur = curKey(); storeSoon(); return;
    }
    if (t.id === 'stxNbQ') paintNbList();
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'stxSong') {
      const v = t.value;
      if (v === '+') { $('stxNew').hidden = false; t.value = curKey(); $('stxNewN').focus(); return; }
      D.cur = v; store(); const pr = rec(); sel = pr && pr.s ? pr.s : 1; rhW = ''; say(''); paintPlan(); paintStep(); return;
    }
    if (t.id === 'stxTkS') { tkSong = t.value; paintNbList(); }
  }
  function onKey(e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'stxWfIn') { e.preventDefault(); wfAdd(); } else if (e.target.id === 'stxNewN') { e.preventDefault(); newSong(); }
    else if (e.target.id === 'stxNbX' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const b = $('stxNbAdd'); if (b) b.click(); }
  }
  function newSong() {
    const n = $('stxNewN').value.trim(), A = LA(); if (!n) { $('stxNewN').focus(); return; } if (!A || !A.newSong) { say(u('noLied'), true); return; }
    const s = A.newSong(n.slice(0, 40)); if (!s) return;
    const k = 'l:' + s.id; D.cur = k; const r = rec(k, true); r.n = s.name; store();
    $('stxNewN').value = ''; $('stxNew').hidden = true; sel = 1; paintPlan(); paintStep();
  }
  /* ---------- v166: Durchgehendes Beispiel (Daten in songtext-beispiel.js, erst bei Bedarf geladen) ---------- */
  let exOpen = false, exAll = false, exBusy = false, exCb = null;
  function exLoad(cb) {
    if (window.SongtextBeispiel) { cb(); return; }
    exCb = cb; if (exBusy) return; exBusy = true;
    const sc = document.createElement('script'); sc.src = 'songtext-beispiel.js';
    sc.onload = () => { exBusy = false; const f = exCb; exCb = null; if (f && window.SongtextBeispiel) f(); };
    sc.onerror = () => { exBusy = false; exCb = null; sc.remove(); document.querySelectorAll('#stxRoot .stx-exwait').forEach(p => { p.textContent = u('exFail'); p.classList.add('warn'); }); };
    document.head.appendChild(sc);
  }
  const exWait = () => '<p class="caption stx-exwait">' + esc(u('exWait')) + '</p>';
  const exBtn = () => '<button type="button" class="toggle-btn active" data-a="exSong">' + esc(u('exSong')) + '</button>';
  function paintEx() {
    const b = $('stxExB'), c = $('stxExS'); if (!b || !c) return;
    b.textContent = (exOpen ? '▾ ' : '▸ ') + u('exCard'); b.setAttribute('aria-expanded', String(exOpen)); b.classList.toggle('active', exOpen);
    c.hidden = !exOpen; if (!exOpen) return;
    if (!window.SongtextBeispiel) { c.innerHTML = exWait(); exLoad(paintEx); return; }
    const E = window.SongtextBeispiel;
    c.innerHTML = '<p class="caption stb-hd">„' + esc(E.META.title) + '“ · ' + esc(E.META.key) + ' · ' + E.META.bpm + ' BPM' + (EN() ? ' ' + esc(u('exDe')) : '') + '</p>' + E.step(sel)
      + (sel === 4 || sel === NS ? '<div class="stx-row">' + exBtn() + '</div>' : '');
  }
  function paintExAll() {
    const w = $('stxExW'), b = $('stxExAll'); if (!w) return;
    if (b) { b.setAttribute('aria-expanded', String(exAll)); b.classList.toggle('active', exAll); }
    document.querySelectorAll('#stxRoot [data-a="exAllLf"]').forEach(x => { x.setAttribute('aria-expanded', String(exAll)); x.classList.toggle('active', exAll); });   // v167
    const lf = D.view === 'lf', anchor = $(lf ? 'stxLf' : 'stxWf'); if (anchor && anchor.nextElementSibling !== w) anchor.after(w);
    w.hidden = !exAll || (D.view !== 'wf' && !lf); if (w.hidden) return;
    if (!window.SongtextBeispiel) { w.innerHTML = exWait(); exLoad(paintExAll); return; }
    const E = window.SongtextBeispiel, M = E.META, row = '<div class="stx-row">' + exBtn() + '<button type="button" class="toggle-btn" data-a="exX">' + esc(u('exClose')) + '</button></div>';
    w.innerHTML = '<div class="card-head msl-head"><h2>' + esc(u('exHead')) + ': „' + esc(M.title) + '“</h2><span class="caption">' + esc(M.key + ' · ' + M.bpm + ' BPM · 4/4') + '</span></div>'
      + '<p class="caption">' + esc(u('exIntro')) + (EN() ? ' ' + esc(u('exDe')) : '') + '</p>' + row + '<p class="caption msl-msg stx-msg" role="status"></p>'
      + STEPS.map((S, i) => '<section class="stb-sec" data-ex="' + (i + 1) + '"><h3>' + esc(u('step') + ' ' + (i + 1) + ' · ' + tx(S.t)) + '</h3>' + E.step(i + 1)
        + '<button type="button" class="toggle-btn stx-sm" data-a="exStep" data-n="' + (i + 1) + '">' + esc(u('exToStep').replace('%n', i + 1)) + '</button></section>').join('') + row;
  }
  // „Beispiel als Song laden“: immer ein NEUER Song (Name mit „(2)“ usw., nie überschreiben); V1 Rohfassung, V2 fertig – über LiedApi wie die Vorlagen
  function exSong() {
    const A = LA(), X = window.LiedText, E = window.SongtextBeispiel;
    if (!A || !A.newSong || !A.pushVersion || !X || !E) { say(u('noLied'), true); return null; }
    const r1 = X.fromCode(E.code(true)), r2 = r1.ok ? X.fromCode(E.code(false), r1.v) : r1;
    if (!r1.ok || !r2.ok) { say(u('exFail'), true); return null; }
    const base = (EN() ? 'Example – ' : 'Beispiel – ') + E.META.title, names = new Set(songs().map(s => s.name));
    let nm = base; for (let i = 2; names.has(nm); i++) nm = base + ' (' + i + ')';
    const s = A.newSong(nm.slice(0, 60)); if (!s) return null;
    Object.assign(s.versions[0], r1.v, { note: u('exV1') }); s.cur = 0; A.save();
    A.pushVersion(r2.v, u('exV2'));
    const k = 'l:' + s.id; D.cur = k; const pr = rec(k, true);
    pr.n = s.name; pr.k = E.META.kern; pr.h = E.META.hook; pr.wf = { t: E.META.wfT, w: E.META.wf.slice() }; touch(pr); store();
    paintPlan(); paintStep();
    say(u('exOk').replace('%s', s.name).replace('%n', r2.v.parts.length).replace('%k', E.META.key).replace('%b', E.META.bpm));
    document.querySelectorAll('#stxRoot .stx-msg').forEach(m => m.insertAdjacentHTML('beforeend', ' <button type="button" class="toggle-btn stx-sm" data-a="exGo">' + esc(u('exGo')) + '</button>'));
    return s;
  }
  function open() { build(); }
  // v167: Bereich zeigen (SW-Leiste) und nach einem Songwechsel im Songwriting nachziehen
  function show(v) { if (['wf', 'lf', 'nb'].includes(v) && D.view !== v) { D.view = v; store(); } say(''); build(); }
  function reload() { if (storeT) { clearTimeout(storeT); storeT = 0; store(); } D = load(); lastK = null; }   // v167: beim Öffnen des Songwritings frisch lesen (wie früher beim Öffnen der Seite)
  function sync() { if (!built) return; const k = curKey(); if (k === lastK) return; const pr = rec(k); sel = pr && pr.s ? pr.s : 1; rhW = ''; takeId = ''; paint(); }
  document.addEventListener('tabchange', () => { if (built && storeT) { clearTimeout(storeT); storeT = 0; store(); } });
  return { open, show, sync, reload, go, view: () => D.view, built: () => built, load, merge, STEPS, GUIDE, TPL, CHECK, DICE, exSong, _st: () => ({ sel, cur: curKey(), view: D.view, tpl, takeId, rhW, notes: D.n.length, exOpen, exAll }) };
})();
