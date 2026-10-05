/* ---------- Song-Player: dekodiert und über die Audio-Engine abgespielt (flüssig auf dem iPad) ---------- */
const fileInput = document.getElementById('audioFile');
const fileNameEl = document.getElementById('fileName');
const musicControlsRow = document.getElementById('musicControlsRow');
const musicStatus = document.getElementById('musicStatus');
const musicPlayBtn = document.getElementById('musicPlayBtn');
const musicSeek = document.getElementById('musicSeek');
const musicTime = document.getElementById('musicTime');
const musicVolume = document.getElementById('musicVolume');
const musicLoop = document.getElementById('musicLoop');

const Song = (() => {
  let lp = false, buf = null, src = null, gain = null, t0 = 0, offset = 0, playing = false, timer = null, seeking = false, token = 0;
  const dur = () => buf ? buf.duration : 0;
  function pos() {
    if (!buf) return 0;
    if (!playing) return offset;
    const p = audioCtx.currentTime - t0;
    return lp ? p % dur() : Math.min(p, dur());
  }
  function ensureGain() {
    if (!gain) { gain = audioCtx.createGain(); gain.connect(ensureMasterBus()); }
    gain.gain.value = musicVolume.value / 100;
  }
  function play() {
    if (!buf) return;
    ensureAudio(); ensureGain();
    stopSrc();
    if (offset >= dur() - 0.05) offset = 0;
    const s = audioCtx.createBufferSource();
    s.buffer = buf; s.loop = lp = musicLoop.checked;
    s.connect(gain);
    const my = ++token;
    s.onended = () => { if (my === token && playing && !s.loop) { playing = false; offset = 0; ui(); } };
    s.start(audioCtx.currentTime + 0.03, offset);
    t0 = audioCtx.currentTime + 0.03 - offset;
    src = s; playing = true; ui();
    clearInterval(timer); timer = setInterval(tickUi, 200);
  }
  function stopSrc() { if (src) { token++; try { src.stop(); } catch (e) {} src.disconnect(); src = null; } }
  function pause() { offset = pos(); stopSrc(); playing = false; clearInterval(timer); ui(); }
  function seek(sec) { const was = playing; offset = Math.max(0, Math.min(dur(), sec)); if (was) play(); else ui(); }
  function tickUi() {
    if (!seeking && buf) musicSeek.value = (pos() / dur()) * 100;
    musicTime.textContent = formatTime(pos()) + ' / ' + formatTime(dur());
  }
  function ui() {
    musicPlayBtn.classList.toggle('playing', playing);
    musicPlayBtn.textContent = playing ? '❚❚' : '▶';
    tickUi();
  }
  async function load(file) {
    pause(); buf = null;
    fileNameEl.textContent = file.name;
    musicStatus.textContent = 'Lade „' + file.name + '“ …';
    ensureAudio();
    try { buf = await audioCtx.decodeAudioData(await file.arrayBuffer()); }
    catch (err) {
      musicControlsRow.style.display = 'none';
      musicStatus.textContent = '„' + file.name + '“ kann das iPad nicht öffnen. Wandle die Datei in MP3, WAV oder M4A um.';
      return;
    }
    offset = 0; musicControlsRow.style.display = 'flex'; ui();
    musicStatus.textContent = 'Bereit. Tonart und Tempo werden im Hintergrund erkannt …';
    analyse(buf);
  }
  async function analyse(b) {
    const chans = []; for (let c = 0; c < b.numberOfChannels; c++) chans.push(b.getChannelData(c));
    const r = await Analyzer.key(chans, b.sampleRate);
    let keyMsg;
    if (r.error) keyMsg = 'Tonart konnte nicht erkannt werden.';
    else { Analyzer.apply(r); keyMsg = 'Tonart erkannt: ' + Analyzer.label(r) + '.'; }
    // Tempo-Erkennung erst nach einer kurzen Pause, damit die Wiedergabe ungestört startet
    await new Promise(res => setTimeout(res, 150));
    let beatMsg = '';
    try {
      const beatResult = detectBeatFromBuffer(b);
      const precise = await Analyzer.beat(chans, b.sampleRate);
      if (precise && precise.confidence > 2.5) beatResult.bpm = Math.round(precise.bpm * 10) / 10;
      const bpmEl = document.getElementById('bpm');
      bpmEl.value = beatResult.bpm; bpmEl.dispatchEvent(new Event('input'));
      if (typeof Rhythm !== 'undefined' && beatResult.pattern) Rhythm.setDetected(beatResult.pattern, beatResult.bpm);
      beatMsg = ' Tempo: ' + String(beatResult.bpm).replace('.', ',') + ' BPM (Drum-Muster aus dem Song als Vorlage „Aus dem Song“ gewählt).';
    } catch (err) { beatMsg = ' Tempo konnte nicht erkannt werden.'; }
    musicStatus.textContent = keyMsg + beatMsg + ' Näherungswerte, bei Bedarf oben korrigieren.';
  }
  return { load, play, pause, seek, isPlaying: () => playing, dur, setVolume: () => { if (gain) gain.gain.value = musicVolume.value / 100; }, setLoop: () => { if (playing) { offset = pos(); play(); } }, startSeek: () => { seeking = true; }, endSeek: () => { seeking = false; } };
})();

fileInput.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) Song.load(f); });
musicPlayBtn.addEventListener('click', () => { if (Song.isPlaying()) Song.pause(); else Song.play(); });
musicSeek.addEventListener('input', () => Song.startSeek());
musicSeek.addEventListener('change', () => { Song.seek((musicSeek.value / 100) * Song.dur()); Song.endSeek(); });
musicVolume.addEventListener('input', () => Song.setVolume());
musicLoop.addEventListener('change', () => Song.setLoop());

