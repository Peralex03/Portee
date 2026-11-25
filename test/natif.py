"""Essai du pont de l'app iOS : position par le natif et écran allumé, simulés dans le navigateur."""
import asyncio, os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui, relay
from playwright.async_api import async_playwright
ROOT = ui.ROOT
src = open(ROOT + '/ios/Portee/WebViewController.swift').read()
BRIDGE = re.search(r'static let bridge = """\n(.*?)\n    """', src, re.S).group(1)
FAKE = """window.__msgs = []; window.webkit = { messageHandlers: { portee: { postMessage: function (m) { window.__msgs.push(JSON.parse(JSON.stringify(m))); } } } };"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await ctx.add_init_script(FAKE + '\n' + BRIDGE)
        page = await ctx.new_page()
        logs = []
        page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await ctx.route('**/*', ui.route)
        await page.goto('https://portee.test/'); await page.wait_for_timeout(600)
        await page.evaluate("() => localStorage.clear()"); await page.reload(); await page.wait_for_timeout(700)
        print('app native détectée :', await page.evaluate("() => !!window.porteeApp"))
        await relay.goto(page, '46.70, 6.96'); await page.click('#addBtn'); await page.wait_for_timeout(300); await page.click('.ehead .xbtn')
        await relay.wait_calc(page); await page.wait_for_timeout(1000)
        await page.click('#locBtn'); await page.wait_for_timeout(500)
        msgs = await page.evaluate("() => window.__msgs")
        print('messages au natif :', msgs)
        w = [m for m in msgs if m.get('op') == 'watch']
        assert w, 'pas de demande de suivi'
        # le natif répond avec une position
        await page.evaluate("id => window.__porteeGeo([id], true, [46.705, 6.975, 8, 650, 5, null, 1.2, Date.now()])", w[0]['id'])
        await page.wait_for_timeout(1500)
        print('suivi en direct :', (await page.inner_text('#live')).replace('\n', ' | ')[:160])
        # arrêt du suivi : la veille est relâchée et le suivi arrêté côté natif
        await page.click('#locBtn'); await page.wait_for_timeout(500)
        print('messages après arrêt :', (await page.evaluate("() => window.__msgs"))[len(msgs):])
        # refus d'accès
        await page.click('#locBtn'); await page.wait_for_timeout(300)
        m2 = [m for m in await page.evaluate("() => window.__msgs") if m.get('op') == 'watch'][-1]
        await page.evaluate("id => window.__porteeGeo([id], false, [1, 'Accès à la position refusé : Réglages, Portée, Position.'])", m2['id'])
        await page.wait_for_timeout(800)
        print('après refus :', await page.evaluate("() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' / ')"), '| suivi actif :', await page.evaluate("() => document.getElementById('locBtn').classList.contains('on')"))
        print('\n'.join(logs[-10:]))
        await b.close()
asyncio.run(main())
