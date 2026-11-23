"""Essai : étalonnage terrain, export GeoJSON (lu par l'importeur de Calque), import, lien QR, hors ligne."""
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui, relay
from playwright.async_api import async_playwright
ROOT = ui.ROOT
CALQUE = '/home/claude/peralex03/calque/index.html'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True,
                                  geolocation={'latitude': 46.7, 'longitude': 6.99}, permissions=['geolocation', 'clipboard-read', 'clipboard-write'])
        page = await ctx.new_page()
        logs = []
        page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await ctx.route('**/*', ui.route)
        await page.goto('https://portee.test/'); await page.wait_for_timeout(600)
        await page.evaluate("() => localStorage.clear()"); await page.reload(); await page.wait_for_timeout(800)
        await relay.goto(page, '46.70, 6.96')
        await page.click('#addBtn'); await page.wait_for_timeout(300); await page.click('.ehead .xbtn')
        await relay.goto(page, '46.70, 7.035')
        await page.click('#addBtn'); await page.wait_for_timeout(300); await page.click('.ehead .xbtn')
        await relay.wait_calc(page); await page.wait_for_timeout(1500)
        # --- étalonnage : essais en direct ---
        await page.click('#locBtn'); await page.wait_for_timeout(2500)
        for ok in [True, True, False]:
            await page.click('.ltest .chip.' + ('ok' if ok else 'ko')); await page.wait_for_timeout(400)
            await ctx.set_geolocation({'latitude': 46.70 + (0.01 if ok else 0.002), 'longitude': 6.99 + (0.03 if not ok else 0.0)}); await page.wait_for_timeout(1800)
        await page.screenshot(path=ROOT + '/test/shots/f1-essais.png')
        await page.click('#locBtn'); await page.wait_for_timeout(300)
        await page.click('#tabParams'); await page.wait_for_timeout(500)
        await page.click('text=Étalonnage terrain'); await page.wait_for_timeout(600)
        print('étalonnage :', (await page.inner_text('.sbody')).replace('\n', ' | ')[:330])
        await page.screenshot(path=ROOT + '/test/shots/f2-etalonnage.png')
        await page.click('.shead .xbtn'); await page.wait_for_timeout(400)
        # --- export GeoJSON ---
        await page.click('#studyBtn'); await page.wait_for_timeout(400)
        async with page.expect_download() as dl:
            await page.click('text=Exporter pour Calque')
        d = await dl.value
        path = ROOT + '/test/shots/export.geojson'
        await d.save_as(path)
        j = json.load(open(path))
        kinds = {}
        for f in j['features']: kinds[f['geometry']['type']] = kinds.get(f['geometry']['type'], 0) + 1
        print('export :', d.suggested_filename, kinds, 'portee' in j, j['features'][0]['properties'])
        await page.wait_for_timeout(500)
        # --- lien QR ---
        await page.click('#studyBtn'); await page.wait_for_timeout(400)
        await page.click('text=Partager par QR code'); await page.wait_for_timeout(800)
        has_svg = await page.evaluate("() => !!document.querySelector('.qr svg')")
        await page.screenshot(path=ROOT + '/test/shots/f3-qr.png')
        await page.click('text=Copier le lien'); await page.wait_for_timeout(300)
        link = await page.evaluate("() => navigator.clipboard.readText()")
        print('QR :', has_svg, 'lien de', len(link), 'caractères')
        await page.click('.shead .xbtn'); await page.wait_for_timeout(300)
        n0 = await page.evaluate("() => JSON.parse(localStorage.getItem('portee.v1')).studies.length")
        await page.goto(link); await page.wait_for_timeout(1500)
        await page.click('text=Importer'); await page.wait_for_timeout(1000)
        n1 = await page.evaluate("() => JSON.parse(localStorage.getItem('portee.v1')).studies.length")
        print('études avant / après le lien :', n0, n1, '| hash vidé :', await page.evaluate("() => location.hash === ''"))
        # --- import du fichier exporté ---
        await page.click('#studyBtn'); await page.wait_for_timeout(400)
        async with page.expect_file_chooser() as fc:
            await page.click('text=Importer un fichier')
        await (await fc.value).set_files(path); await page.wait_for_timeout(1200)
        n2 = await page.evaluate("() => JSON.parse(localStorage.getItem('portee.v1')).studies.length")
        print('études après import du fichier :', n2)
        # --- hors ligne ---
        await relay.wait_calc(page)
        await page.click('#baseBtn'); await page.wait_for_timeout(400)
        await page.click('text=Préparer la zone')
        for _ in range(100):
            await page.wait_for_timeout(500)
            if await page.evaluate("() => document.getElementById('status').hidden"): break
        sw = await page.evaluate("async () => !!(await navigator.serviceWorker.getRegistration())")
        nt = await page.evaluate("async () => (await (await caches.open('portee-carte')).keys()).length")
        nd = await page.evaluate("async () => (await (await caches.open('portee-data')).keys()).length")
        print('hors ligne : service worker', sw, '| tuiles de carte', nt, '| données relief/bâtiments', nd)
        print('\n'.join(logs[-8:]))
        await b.close()
asyncio.run(main())
