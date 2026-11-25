"""Essai : couverture très zoomée (mémoire bornée) et SE-135 du règlement 58.440."""
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
        await relay.goto(page, '46.70, 6.96')
        await page.click('#addBtn'); await page.wait_for_timeout(500)
        # SE-135
        await page.click('#edit >> text=SE-135'); await page.wait_for_timeout(300)
        txt = await page.inner_text('#edit')
        print('SE-135 :', ' | '.join(l for l in txt.split('\n') if any(w in l for w in ['0,2', '2 W', 'MA-135', 'WA-135', 'ZA-135', 'MA-235', '58.440', 'portée']))[:400])
        await page.click('.ehead .xbtn')
        await relay.wait_calc(page); await page.wait_for_timeout(1500)
        state = "() => { const t = [...document.querySelectorAll('.leaflet-pane canvas')].filter(c => c.closest('.leaflet-cov-pane')); return [t.length, t.length ? t[0].width : 0, document.querySelectorAll('.leaflet-cov-pane img').length]; }"
        print('zoom normal, tuiles de couverture :', await page.evaluate(state))
        await page.focus('#map')
        for _ in range(8): await page.keyboard.press('Equal'); await page.wait_for_timeout(250)
        await page.wait_for_timeout(1500)
        print('zoom', await page.evaluate("() => document.querySelector('#scale') && document.querySelector('#scale').textContent"), 'tuiles de couverture :', await page.evaluate(state))
        big = await page.evaluate("() => Math.max(0, ...[...document.querySelectorAll('.leaflet-pane *')].map(e => e.getBoundingClientRect().width))")
        print('plus grand élément de la carte (px CSS) :', round(big))
        await page.screenshot(path=ROOT + '/test/shots/z1-tres-zoome.png')
        print('\n'.join(logs[-10:]))
        await b.close()
asyncio.run(main())
