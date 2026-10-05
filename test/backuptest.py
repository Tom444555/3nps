import asyncio, io, zipfile, json
from playwright.async_api import async_playwright
T = '/home/claude/3nps/test/'
res = []
def check(name, ok, info=''):
    res.append(ok); print(('OK    ' if ok else 'FEHLER') + '  ' + name + ('  · ' + str(info) if info else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(accept_downloads=True, viewport={'width': 1024, 'height': 1366})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.click('#tab-looper'); await pg.select_option('#loopCountIn', '0')
        # Optik umschalten, bleibt nach Neuladen
        await pg.select_option('#appTheme', 'metal'); await pg.wait_for_timeout(200)
        t1 = await pg.evaluate("[document.documentElement.dataset.theme, getComputedStyle(document.documentElement).getPropertyValue('--t2').trim(), document.querySelector('meta[name=theme-color]').content]")
        await pg.reload(); await pg.wait_for_timeout(800)
        t2 = await pg.evaluate("[document.documentElement.dataset.theme, document.getElementById('appTheme').value]")
        check('Optik Metal aktiv und gemerkt', t1[0] == 'metal' and t1[1] == '#ff7a1a' and t2 == ['metal', 'metal'], f'{t1} → {t2}')
        await pg.click('#tab-looper')
        # Inhalt anlegen
        await pg.set_input_files('#file0', T + 'stereo/rock_120_2T_st.wav')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.is_visible('#impDlg'): await pg.click('#impOk')
            if (await pg.inner_text('#loopStatus')).startswith('Spur 1:'): break
        s0 = await pg.evaluate('Looper._stereo(0)')
        await pg.fill('#ideaName', 'Sicherungs-Test'); await pg.click('#ideaSave'); await pg.wait_for_timeout(1200)
        await pg.evaluate("localStorage.setItem('3nps-latency', '135')")
        n_ideas = await pg.evaluate("AppDB.all('ideas').then(a => a.length)"); n_log = await pg.evaluate("AppDB.all('sessions').then(a => a.length)")
        async with pg.expect_download() as dl:
            await pg.click('#backupSave')
        d = await dl.value; data = open(await d.path(), 'rb').read()
        z = zipfile.ZipFile(io.BytesIO(data)); head = json.loads(z.read('sicherung.json'))
        check('Sicherungsdatei gültig', z.testzip() is None and head['app'] == 'Looper' and len(head['db']['ideas']) == n_ideas, f"{d.suggested_filename} · {len(data) / 1e6:.1f} MB · {len(z.namelist())} Teile · {n_ideas} Ideen, {n_log} Log")
        # Alles löschen
        await pg.evaluate("""async () => { for (const s of ['ideas', 'sessions']) for (const r of await AppDB.all(s)) await AppDB.del(s, r.id); localStorage.setItem('3nps-latency', '20'); localStorage.removeItem('3nps-theme'); }""")
        await pg.evaluate('window.__noReload = true')
        await pg.set_input_files('#backupFile', await d.path()); await pg.wait_for_timeout(2500)
        info = await pg.inner_text('#backupInfo')
        k_ideas = await pg.evaluate("AppDB.all('ideas').then(a => a.length)"); k_log = await pg.evaluate("AppDB.all('sessions').then(a => a.length)")
        ls = await pg.evaluate("[localStorage.getItem('3nps-latency'), localStorage.getItem('3nps-theme')]")
        check('Sicherung geladen: Ideen, Log, Einstellungen', k_ideas == n_ideas and k_log == n_log and ls == ['135', 'metal'], f'{k_ideas}/{n_ideas} Ideen, {k_log}/{n_log} Log, {ls} · {info}')
        # Idee laden → Stereo wie vorher
        await pg.reload(); await pg.wait_for_timeout(1000); await pg.click('#tab-looper')
        await pg.click('.idea-row:has-text("Sicherungs-Test") [data-act="load"]'); await pg.wait_for_timeout(2000)
        s1 = await pg.evaluate('Looper._stereo(0)')
        check('Wiederhergestellte Idee klingt gleich (Stereo)', s1 and s1['L'] == s0['L'] and abs(s1['corr'] - s0['corr']) < 0.002 and abs(s1['rmsL'] - s0['rmsL']) < 1e-3, f"L {s1 and s1['L']}, Korrelation {s0['corr']:.3f} → {s1 and round(s1['corr'], 3)}")
        # Falsche Datei
        await pg.set_input_files('#backupFile', T + 'stereo/mic_st.wav'); await pg.wait_for_timeout(800)
        check('Fremde Datei wird abgelehnt', 'keine Looper-Sicherung' in await pg.inner_text('#backupInfo'), await pg.inner_text('#backupInfo'))
        await pg.select_option('#appTheme', 'nordic'); await pg.wait_for_timeout(200)
        check('Zurück auf Nordisch', await pg.evaluate("!document.documentElement.dataset.theme && getComputedStyle(document.documentElement).getPropertyValue('--t2').trim() === '#2de2ff'"), '')
        check('Keine Skriptfehler', not errs, errs[:3])
        await b.close()
    print(f'\nErgebnis: {sum(res)}/{len(res)} Prüfungen bestanden')
asyncio.run(main())
