"""Essai du mode en direct (GPS simulé) et de l'aperçu au glisser."""
import asyncio, sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui
from playwright.async_api import async_playwright
ROOT = ui.ROOT
async def wait_calc(page):
    for _ in range(120):
        await page.wait_for_timeout(400)
        if await page.evaluate("() => document.getElementById('status').hidden"): return
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                  geolocation={'latitude': 46.7088, 'longitude': 6.9466, 'accuracy': 8}, permissions=['geolocation'])
        page = await ctx.new_page()
        logs = []
        page.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        # compter les messages du worker
        await ctx.route('**/*', ui.route)
        await page.goto('https://portee.test/'); await page.wait_for_timeout(600)
        await page.evaluate("() => localStorage.clear()"); await page.reload(); await page.wait_for_timeout(700)
        await page.click('#searchBtn'); await page.wait_for_timeout(300)
        await page.fill('.field.search', '2570000 1180000'); await page.wait_for_timeout(300)
        await page.click('.sbody .row'); await page.wait_for_timeout(600)
        await page.click('#addBtn'); await page.wait_for_timeout(400)
        await page.click('.ehead .xbtn'); await wait_calc(page); await page.wait_for_timeout(500)
        # zoom arrière pour voir le disque
        await page.focus('#map')
        for _ in range(3):
            await page.keyboard.press('Minus'); await page.wait_for_timeout(350)
        await page.wait_for_timeout(500)
        # aperçu au glisser : déplacer la station
        before = await page.evaluate("() => document.querySelector('.cov') && document.querySelector('.cov').src")
        box = await page.locator('.stn').bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        await page.mouse.move(x, y); await page.mouse.down()
        srcs = set()
        for k in range(12):
            await page.mouse.move(x - 8 * k, y + 6 * k); await page.wait_for_timeout(120)
            s = await page.evaluate("() => document.querySelector('.cov') && document.querySelector('.cov').src")
            srcs.add(s)
        await page.screenshot(path=ROOT + '/test/shots/l1-glisser.png')
        await page.mouse.up()
        print('images de couverture pendant le glisser :', len(srcs - {before}))
        await wait_calc(page); await page.wait_for_timeout(600)
        # suivi en direct
        await page.click('#locBtn'); await page.wait_for_timeout(2500)
        await page.screenshot(path=ROOT + '/test/shots/l2-direct.png')
        txt1 = await page.inner_text('#live')
        await ctx.set_geolocation({'latitude': 46.735, 'longitude': 6.995, 'accuracy': 12}); await page.wait_for_timeout(2500)
        await ctx.set_geolocation({'latitude': 46.745, 'longitude': 7.03, 'accuracy': 12}); await page.wait_for_timeout(2500)
        txt2 = await page.inner_text('#live')
        await page.screenshot(path=ROOT + '/test/shots/l3-direct-deplace.png')
        print('carte en direct 1 :', txt1.replace('\n', ' | '))
        print('carte en direct 2 :', txt2.replace('\n', ' | '))
        print('points de trace :', await page.evaluate("() => document.querySelectorAll('.leaflet-overlay-pane path.leaflet-interactive, .leaflet-overlay-pane path').length"))
        await page.click('#live .lr'); await page.wait_for_timeout(1200)
        await page.screenshot(path=ROOT + '/test/shots/l4-profil-direct.png')
        await page.click('.shead .xbtn'); await page.wait_for_timeout(400)
        await page.click('#locBtn'); await page.wait_for_timeout(300)
        print('carte cachée après arrêt :', await page.evaluate("() => document.getElementById('live').hidden"))
        print('\n'.join([l for l in logs if 'PAGEERROR' in l or l.startswith('error')][-10:]))
        await b.close()
asyncio.run(main())
