# Absturzschutz: automatische Sicherung, Wiederherstellen nach Neuladen; Schutz vor Schadcode in fremden Sicherungen
import asyncio, json, io, zipfile
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info != '' else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1024, 'height': 1366}, has_touch=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.evaluate("AppDB.del('meta', 'autosave')")
        await pg.reload(); await pg.wait_for_timeout(900)
        await pg.click('#tab-looper')
        for slot, f in [(0, 'stereo/rock_120_2T_st.wav'), (1, 'loops/guitar_only_95_4T.wav')]:
            await pg.set_input_files(f'#file{slot}', T + f)
            for _ in range(60):
                await pg.wait_for_timeout(250)
                if await pg.is_visible('#impDlg'): await pg.click('#impOk')
                if (await pg.inner_text('#loopStatus')).startswith(f'Spur {slot + 1}:'): break
        await pg.evaluate("Looper.setTrackEq(0, [2,0,0,0,0,0,-3])")
        s0 = [await pg.evaluate(f'Looper._stereo({i})') for i in range(2)]
        await pg.wait_for_timeout(3500)
        a = await pg.evaluate("AppDB.get('meta', 'autosave').then(r => r ? r.session.tracks.filter(Boolean).length : 0)")
        check('Automatische Sicherung nach Änderungen', a == 2, f'{a} Spuren gesichert')
        # „Absturz“: Seite neu laden
        await pg.reload(); await pg.wait_for_timeout(1500); await pg.click('#tab-looper')
        vis = await pg.is_visible('#restoreBar'); txt = await pg.inner_text('#restoreText') if vis else ''
        check('Nach Neuladen: Wiederherstellen wird angeboten', vis and '2 Spuren' in txt, txt)
        await pg.click('#restoreYes'); await pg.wait_for_timeout(1500)
        s1 = [await pg.evaluate(f'Looper._stereo({i})') for i in range(2)]
        ok = all(x and y and x['L'] == y['L'] and abs(x['corr'] - y['corr']) < 0.003 for x, y in zip(s0, s1))
        eq = await pg.evaluate('Looper.getTrackEq(0)')
        check('Spuren, Stereo und EQ wiederhergestellt', ok and eq == [2, 0, 0, 0, 0, 0, -3], f"{[y['L'] for y in s1]} · EQ {eq}")
        st = await pg.evaluate('Looper.debug().tracks.map(t => t.state)')
        check('Spuren laufen wieder', st[:2] == ['playing', 'playing'], st)
        # Verwerfen
        await pg.reload(); await pg.wait_for_timeout(1500); await pg.click('#tab-looper')
        await pg.click('#restoreNo'); await pg.wait_for_timeout(500)
        g = await pg.evaluate("AppDB.get('meta', 'autosave').then(r => !!r)")
        check('Verwerfen löscht die Sicherung', not g and await pg.is_hidden('#restoreBar'), g)
        # Fremde Sicherung mit Schadcode in Namen: darf nichts ausführen
        await pg.evaluate("window.__pwned = 0")
        evil = '<img src=x onerror="window.__pwned=1">'
        head = {'app': 'Looper', 'format': 1, 'date': '2026-10-05', 'local': {}, 'db': {
            'ideas': [{'id': 'x" onmouseover="window.__pwned=2', 'v': 2, 'name': evil, 'ts': 1, 'dateStr': evil, 'root': evil, 'mode': 'Ionisch (Dur)', 'bpm': 100, 'secs': 1, 'session': {'sr': 44100, 'baseL': 100, 'tracks': [None, None, None]}}],
            'sessions': [{'id': 'e1', 'ts': 2, 'dateStr': evil, 'root': evil, 'mode': evil, 'position': evil, 'pattern': evil, 'bpm': evil, 'durationSec': 30}], 'meta': []}}
        zb = io.BytesIO(); z = zipfile.ZipFile(zb, 'w', zipfile.ZIP_STORED); z.writestr('sicherung.json', json.dumps(head)); z.close()
        open('/tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/evil.zip', 'wb').write(zb.getvalue())
        await pg.evaluate('window.__noReload = true')
        await pg.set_input_files('#backupFile', '/tmp/claude-0/-home-claude/45a20acb-473b-586f-9346-bf8805004f30/scratchpad/evil.zip'); await pg.wait_for_timeout(1200)
        await pg.reload(); await pg.wait_for_timeout(1200); await pg.click('#tab-looper'); await pg.wait_for_timeout(500)
        await pg.click('#tab-log'); await pg.wait_for_timeout(600); await pg.click('#tab-looper'); await pg.wait_for_timeout(300)
        rows = await pg.query_selector_all('.idea-row')
        for r in rows: await r.hover()
        pw = await pg.evaluate('window.__pwned || 0'); imgs = await pg.evaluate("document.querySelectorAll('#ideaList img, #logList img').length")
        check('Fremde Sicherung kann keinen Code ausführen', pw == 0 and imgs == 0, f'ausgeführt: {pw}, eingeschleuste Bilder: {imgs}')
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'\nErgebnis: {sum(res)}/{len(res)} Prüfungen bestanden')
asyncio.run(main())
