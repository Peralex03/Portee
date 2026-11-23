"""Essai de l'interface dans Chrome sans écran, avec des réponses swisstopo simulées (relief synthétique)."""
import asyncio, json, math, struct, sys
from playwright.async_api import async_playwright

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = open(ROOT + '/index.html', 'rb').read()

def height(lon, lat):
    # crête nord-sud à l'est du point de départ, colline au sud-ouest
    x = (lon - 6.95) * 76000; y = (lat - 46.70) * 111000
    ridge = 220 * math.exp(-((x - 3500) / 900) ** 2)
    hill = 160 * math.exp(-(((x + 4000) / 2500) ** 2 + ((y + 3000) / 2500) ** 2))
    return 450 + ridge + hill + 15 * math.sin(x / 700) * math.cos(y / 900)

def zz(v): return ((v << 1) ^ (v >> 31)) & 0xffff

def qm_tile(z, x, y):
    deg = 180 / 2 ** z
    west, south = -180 + x * deg, -90 + y * deg
    N = 33
    verts, ids, tris = [], {}, []
    def vid(i, j):
        k = (i, j)
        if k not in ids:
            ids[k] = len(verts)
            u = round(i / (N - 1) * 32767); v = round(j / (N - 1) * 32767)
            verts.append((u, v, height(west + u / 32767 * deg, south + v / 32767 * deg)))
        return ids[k]
    for j in range(N - 1):
        for i in range(N - 1):
            tris.append((vid(i, j), vid(i + 1, j), vid(i, j + 1)))
            tris.append((vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)))
    hs = [v[2] for v in verts]; mn, mx = min(hs) - 1, max(hs) + 1
    b = bytearray(88)
    struct.pack_into('<ff', b, 24, mn, mx)
    b += struct.pack('<I', len(verts))
    for key in range(3):
        prev = 0
        for v in verts:
            val = v[key] if key < 2 else round((v[2] - mn) / (mx - mn) * 32767)
            b += struct.pack('<H', zz(val - prev)); prev = val
    b += struct.pack('<I', len(tris))
    hi = 0
    for t in tris:
        for ix in t:
            code = hi - ix
            b += struct.pack('<H', code)
            if code == 0: hi += 1
    return bytes(b)

GREY = open(ROOT + '/test/grey.png', 'rb').read()
counts = {'terrain': 0, 'vt': 0, 'wmts': 0, 'api3': 0, 'other': []}

async def route(r):
    u = r.request.url
    if u.startswith('https://portee.test/'):
        name = u.split('portee.test/')[1].split('?')[0]
        if name and name != 'index.html':
            import os
            fp = ROOT + '/' + name
            if os.path.exists(fp):
                ct = 'image/png' if name.endswith('.png') else 'application/manifest+json'
                return await r.fulfill(status=200, body=open(fp, 'rb').read(), headers={'content-type': ct})
            return await r.fulfill(status=404, body=b'')
        return await r.fulfill(status=200, body=HTML, headers={'content-type': 'text/html; charset=utf-8'})
    if '3d.geo.admin.ch' in u:
        if u.endswith('layer.json'):
            return await r.fulfill(status=200, body=json.dumps({"tiles": ["20250101/{z}/{x}/{y}.terrain?v={version}"], "version": "1.43646.0", "scheme": "tms", "projection": "EPSG:4326"}), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
        counts['terrain'] += 1
        parts = u.split('/')
        z, x, y = int(parts[-3]), int(parts[-2]), int(parts[-1].split('.')[0])
        return await r.fulfill(status=200, body=qm_tile(z, x, y), headers={'content-type': 'application/vnd.quantized-mesh', 'access-control-allow-origin': '*'})
    if 'vectortiles' in u:
        counts['vt'] += 1
        return await r.fulfill(status=204, body=b'', headers={'access-control-allow-origin': '*'})
    if 'wmts.geo.admin.ch' in u:
        counts['wmts'] += 1
        return await r.fulfill(status=200, body=GREY, headers={'content-type': 'image/png'})
    if 'api3.geo.admin.ch' in u:
        counts['api3'] += 1
        if 'height' in u:
            return await r.fulfill(status=200, body='{"height":"452.3"}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
        return await r.fulfill(status=200, body=json.dumps({"results": [{"attrs": {"label": "<b>Fribourg</b> (FR)", "lat": 46.80, "lon": 7.15, "origin": "gg25"}}]}), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
    counts['other'].append(u)
    return await r.abort()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        logs = []
        page.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await ctx.route('**/*', route)
        await page.goto('https://portee.test/')
        await page.wait_for_timeout(800)
        await page.evaluate("() => { localStorage.clear(); }")
        await page.reload(); await page.wait_for_timeout(800)
        # centrer et poser une antenne
        await page.evaluate("() => {}")
        await page.screenshot(path=ROOT + '/test/shots/1-depart.png')
        # recherche
        await page.click('#searchBtn'); await page.wait_for_timeout(400)
        await page.fill('.field.search', '2570000 1180000'); await page.wait_for_timeout(300)
        await page.screenshot(path=ROOT + '/test/shots/2-recherche.png')
        await page.click('.sbody .row'); await page.wait_for_timeout(700)
        await page.click('#addBtn'); await page.wait_for_timeout(600)
        await page.screenshot(path=ROOT + '/test/shots/3-editeur.png')
        # attendre la fin du calcul
        for _ in range(120):
            await page.wait_for_timeout(500)
            hidden = await page.evaluate("() => document.getElementById('status').hidden")
            if hidden: break
        await page.wait_for_timeout(600)
        await page.click('.ehead .xbtn'); await page.wait_for_timeout(500)
        await page.evaluate("() => { const m = document.querySelector('#map')._leaflet_map; }")
        await page.screenshot(path=ROOT + '/test/shots/4a-couverture-pres.png')
        await page.mouse.move(195, 300)
        for _ in range(3):
            await page.mouse.wheel(0, 120); await page.wait_for_timeout(450)
        await page.wait_for_timeout(700)
        await page.screenshot(path=ROOT + '/test/shots/4-couverture.png')
        # profil : toucher un point à l'est, derrière la crête
        await page.mouse.click(300, 250); await page.wait_for_timeout(1500)
        await page.screenshot(path=ROOT + '/test/shots/5-profil.png')
        await page.evaluate("() => document.querySelector('.sbody').scrollTo(0, 600)"); await page.wait_for_timeout(300)
        await page.screenshot(path=ROOT + '/test/shots/6-profil-bilan.png')
        await page.click('.shead .xbtn'); await page.wait_for_timeout(500)
        # deuxième station sur la colline au sud-ouest, puis liaisons
        await page.evaluate("() => {}")
        await page.click('#tabParams'); await page.wait_for_timeout(500)
        await page.screenshot(path=ROOT + '/test/shots/7-parametres.png')
        await page.click('.shead .xbtn'); await page.wait_for_timeout(500)
        # déplacer la carte au sud-ouest et poser une deuxième station
        await page.mouse.move(195, 420); await page.mouse.down(); await page.mouse.move(300, 330, steps=8); await page.mouse.up()
        await page.wait_for_timeout(400)
        await page.click('#addBtn'); await page.wait_for_timeout(500)
        await page.click('.ehead .xbtn'); await page.wait_for_timeout(300)
        for _ in range(120):
            await page.wait_for_timeout(500)
            if await page.evaluate("() => document.getElementById('status').hidden"): break
        await page.wait_for_timeout(600)
        await page.screenshot(path=ROOT + '/test/shots/8-deux-stations.png')
        await page.click('#tabStations'); await page.wait_for_timeout(2500)
        await page.screenshot(path=ROOT + '/test/shots/9-stations.png')
        print('requêtes', {k: (v if k != 'other' else len(v)) for k, v in counts.items()})
        print('autres', counts['other'][:5])
        print('\n'.join(logs[-30:]))
        await b.close()
if __name__ == '__main__':
    asyncio.run(main())
