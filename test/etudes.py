"""Essai : changer d'étude ne laisse rien de la précédente ; renommer une étude."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui, relay
from playwright.async_api import async_playwright
ROOT = ui.ROOT
STATE = """() => ({ liaisons: document.querySelectorAll('.lnk, .arw').length, couverture: document.querySelectorAll('.leaflet-cov-pane canvas').length,
  stations: document.querySelectorAll('.leaflet-marker-icon.stn, .stn').length, cercles: document.querySelectorAll('.leaflet-overlay-pane path').length,
  nom: document.getElementById('studyName').textContent, statut: !document.getElementById('status').hidden })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        logs = []
        page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await ctx.route('**/*', ui.route)
        await page.goto('https://portee.test/'); await page.wait_for_timeout(600)
        await page.evaluate("() => localStorage.clear()"); await page.reload(); await page.wait_for_timeout(700)
        for c in ['46.70, 6.96', '46.70, 7.06']:
            await relay.goto(page, c); await page.click('#addBtn'); await page.wait_for_timeout(300); await page.click('.ehead .xbtn')
        await relay.wait_calc(page); await page.wait_for_timeout(2000)
        print('étude 1       :', await page.evaluate(STATE))
        # nouvelle étude
        await page.click('#studyBtn'); await page.wait_for_timeout(500)
        await page.click('.sheet >> text=Nouvelle'); await page.wait_for_timeout(1500)
        e2 = await page.evaluate(STATE)
        print('nouvelle étude:', e2)
        await page.screenshot(path=ROOT + '/test/shots/s1-nouvelle.png')
        # renommer
        await page.click('#studyBtn'); await page.wait_for_timeout(500)
        await page.click('.sheet >> text=Renommer'); await page.wait_for_timeout(600)
        await page.fill('.sheet input.field', 'Exercice Jura'); await page.keyboard.press('Enter'); await page.wait_for_timeout(500)
        await page.screenshot(path=ROOT + '/test/shots/s2-etudes.png')
        print('liste :', (await page.inner_text('.sbody')).replace('\n', ' | ')[:200])
        # retour à l'étude 1, puis changement pendant un calcul
        await page.click('.sbody >> text=Étude 1'); await page.wait_for_timeout(300)
        await page.click('#studyBtn'); await page.wait_for_timeout(500)
        await page.click('.sbody >> text=Exercice Jura'); await page.wait_for_timeout(4000)
        print('changement pendant le calcul :', await page.evaluate(STATE))
        await page.click('#studyBtn'); await page.wait_for_timeout(500)
        await page.click('.sbody >> text=Étude 1'); await relay.wait_calc(page); await page.wait_for_timeout(2500)
        print('retour étude 1:', await page.evaluate(STATE))
        print('\n'.join(logs[-10:]))
        await b.close()
        assert e2['liaisons'] == 0 and e2['couverture'] == 0 and e2['nom'] != 'Étude 1'
asyncio.run(main())
