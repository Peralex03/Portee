"""Essai du mode relais : liaisons sur la carte, recherche d'emplacement, pose du relais, réseau, échelle."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui
from playwright.async_api import async_playwright
ROOT = ui.ROOT
async def wait_calc(page):
    for _ in range(150):
        await page.wait_for_timeout(400)
        if await page.evaluate("() => document.getElementById('status').hidden"): return
async def goto(page, coord):
    await page.click('#searchBtn'); await page.wait_for_timeout(300)
    await page.fill('.field.search', coord); await page.wait_for_timeout(300)
    await page.click('.sbody .row'); await page.wait_for_timeout(600)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        logs = []
        page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and '404' not in m.text else None)
        await ctx.route('**/*', ui.route)
        await page.goto('https://portee.test/'); await page.wait_for_timeout(600)
        await page.evaluate("() => localStorage.clear()"); await page.reload(); await page.wait_for_timeout(700)
        # deux stations de part et d'autre de la crête synthétique (crête à ~3,5 km à l'est de 6.95°)
        await goto(page, '46.70, 6.96')
        await page.click('#addBtn'); await page.wait_for_timeout(400)
        await page.click('.chip[data-v="se235p"]'); await page.wait_for_timeout(200)
        await page.click('.ehead .xbtn'); await page.wait_for_timeout(200)
        await goto(page, '46.70, 7.035')
        await page.click('#addBtn'); await page.wait_for_timeout(300)
        await page.click('.ehead .xbtn')
        await wait_calc(page); await page.wait_for_timeout(1500)
        await page.focus('#map')
        for _ in range(2):
            await page.keyboard.press('Minus'); await page.wait_for_timeout(350)
        await page.wait_for_timeout(800)
        await page.screenshot(path=ROOT + '/test/shots/r1-liaisons.png')
        print('étiquette de liaison :', await page.evaluate("() => [...document.querySelectorAll('.lnk b')].map(b => b.textContent)"))
        print('échelle :', await page.inner_text('#scale'))
        # onglet Relais
        await page.click('#tabRelay'); await page.wait_for_timeout(1500)
        await page.screenshot(path=ROOT + '/test/shots/r2-onglet.png')
        # chercher l'emplacement
        await page.click('text=Chercher l\'emplacement'); await wait_calc(page); await page.wait_for_timeout(800)
        await page.screenshot(path=ROOT + '/test/shots/r3-recherche.png')
        print('légende :', (await page.inner_text('#legend')).replace('\n', ' | '))
        # toucher un point au nord sur la crête, entre les deux
        await page.mouse.click(250, 330); await page.wait_for_timeout(1500)
        await page.screenshot(path=ROOT + '/test/shots/r4-relais-ici.png')
        print('relais ici :', (await page.inner_text('.sbody')).replace('\n', ' | ')[:300])
        await page.click('text=Poser le relais ici'); await wait_calc(page); await page.wait_for_timeout(2500)
        print('étiquettes après relais :', await page.evaluate("() => [...document.querySelectorAll('.lnk b')].map(b => b.textContent)"))
        # réseau : seulement les stations reliées
        await page.click('#tabRelay'); await page.wait_for_timeout(1500)
        await page.click('[aria-label="Seulement les stations reliées"]'); await page.wait_for_timeout(1500)
        await page.click('.shead .xbtn'); await page.wait_for_timeout(1500)
        await page.screenshot(path=ROOT + '/test/shots/r5-reseau.png')
        print('stations grisées :', await page.evaluate("() => document.querySelectorAll('.stn.off').length"))
        print('légende :', (await page.inner_text('#legend')).replace('\n', ' | '))
        print('\n'.join(logs[-10:]))
        await b.close()
if __name__ == "__main__":
    asyncio.run(main())
