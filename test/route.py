"""Essai du trajet : départ, relais 1, relais 2, arrivée ; maillons, éditeur, ordre, partage."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui, relay
from playwright.async_api import async_playwright
ROOT = ui.ROOT
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
        # départ et arrivée
        await relay.goto(page, '46.70, 6.96')
        await page.click('#addBtn'); await page.wait_for_timeout(300); await page.click('.ehead .xbtn')
        await relay.goto(page, '46.70, 7.06')
        await page.click('#addBtn'); await page.wait_for_timeout(300); await page.click('.ehead .xbtn')
        await relay.wait_calc(page); await page.wait_for_timeout(1500)
        print('maillons avant relais :', await page.evaluate("() => [...document.querySelectorAll('.lnk b')].map(b => b.textContent)"))
        # deux relais au réticule
        for c in ['46.712, 6.985', '46.712, 7.035']:
            await relay.goto(page, c)
            await page.click('#tabRelay'); await page.wait_for_timeout(800)
            await page.click('text=Relais au réticule'); await page.wait_for_timeout(300)
            await relay.wait_calc(page); await page.wait_for_timeout(1500)
        await relay.goto(page, '46.706, 7.01'); await page.focus('#map')
        await page.keyboard.press('Minus'); await page.wait_for_timeout(1500)
        print('maillons sur la carte :', await page.evaluate("() => [...document.querySelectorAll('.lnk b')].map(b => b.textContent)"))
        print('flèches :', await page.evaluate("() => document.querySelectorAll('.arw').length"))
        await page.screenshot(path=ROOT + '/test/shots/t2-trajet-carte.png')
        await page.click('#tabRelay'); await page.wait_for_timeout(1500)
        await page.screenshot(path=ROOT + '/test/shots/t3-trajet-onglet.png')
        print('onglet :', (await page.inner_text('.sbody')).replace('\n', ' | ')[:700])
        # éditeur : monter le relais 2 avant le relais 1
        await page.click('text=Modifier le trajet'); await page.wait_for_timeout(800)
        await page.screenshot(path=ROOT + '/test/shots/t4-editeur.png')
        print('éditeur :', (await page.inner_text('.sbody')).replace('\n', ' | ')[:500])
        await page.click('.sbody .row:nth-child(3) [aria-label="Monter"]'); await page.wait_for_timeout(1500)
        print('ordre :', await page.evaluate("() => [...document.querySelectorAll('.sbody .row .t b')].map(b => b.textContent)"))
        await page.click('text=Terminé'); await page.wait_for_timeout(1500)
        print('maillons après échange :', await page.evaluate("() => [...document.querySelectorAll('.sbody .list .row .t b')].slice(0, 3).map(b => b.textContent)"))
        await page.click('.shead .xbtn'); await page.wait_for_timeout(300)
        print('\n'.join(logs[-10:]))
        await b.close()
asyncio.run(main())
