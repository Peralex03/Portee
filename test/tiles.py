"""Essai : tuiles gardées par l'ancienne version (réponses opaques) ; la carte doit quand même s'afficher partout."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui
from playwright.async_api import async_playwright
STATE = "() => { const t = [...document.querySelectorAll('.leaflet-tile-container img')]; return [t.length, t.filter(i => i.complete && i.naturalWidth > 0).length]; }"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        await ctx.route('**/*', ui.route)
        page = await ctx.new_page()
        await page.goto('https://portee.test/'); await page.wait_for_timeout(1500)
        await page.evaluate("async () => { await navigator.serviceWorker.ready; }")
        # ancienne version : tuiles gardées en réponses opaques, dans l'ancien et le nouveau cache
        urls = await page.evaluate("() => [...document.querySelectorAll('.leaflet-tile-container img')].map(i => i.src)")
        print('tuiles visibles :', len(urls))
        n = await page.evaluate("""async urls => { let k = 0; for (const name of ['portee-carte', 'portee-carte-2']) { const c = await caches.open(name);
            for (const u of urls.slice(0, 6)) { let r; try { r = await fetch(u + '?opaque', { mode: 'no-cors' }); } catch (e) { return 'erreur ' + e; } if (r.type !== 'opaque') return 'type ' + r.type; else { await c.put(u, r); k++; } } } return k; }""", urls)
        print('tuiles opaques placées :', n)
        await page.reload(); await page.wait_for_timeout(2500)
        print('contrôlée par le service worker :', await page.evaluate("() => !!navigator.serviceWorker.controller"))
        tot, ok = await page.evaluate(STATE)
        print('tuiles affichées :', ok, '/', tot)
        await page.screenshot(path=ui.ROOT + '/test/shots/t1-tuiles.png')
        await b.close()
        assert tot > 0 and ok == tot, 'des tuiles ne se chargent pas'
asyncio.run(main())
