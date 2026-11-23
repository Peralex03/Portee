"""Vérifie que l'importeur de Calque lit l'export GeoJSON de Portée (lancer test/features.py avant ; CALQUE = chemin de index.html de Calque)."""
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context()
        await ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file://') else r.abort())
        cp = await ctx.new_page()
        errs = []
        cp.on('pageerror', lambda e: errs.append(str(e)))
        await cp.goto('file://' + __import__('os').environ.get('CALQUE', '/home/claude/peralex03/calque/index.html')); await cp.wait_for_timeout(4000)
        data = list(open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'shots', 'export.geojson'), 'rb').read())
        r = await cp.evaluate("""async (data) => {
            if (!window.IMPX) return 'IMPX absent';
            const R = await IMPX.parse('etude.geojson', new Uint8Array(data));
            return { kind: R.kind, n: R.feats.length, pts: R.feats.filter(f => f.g === 'pt').map(f => [f.n, f.code, f.lib]),
                     other: R.feats.filter(f => f.g !== 'pt').map(f => [f.g, f.n, f.col, (f.p || []).length]),
                     radioSign: !!(window.CH && CH.BY && CH.BY.radio), radioName: window.CH && CH.BY && CH.BY.radio && CH.BY.radio.n };
        }""", data)
        print('Calque lit le fichier :', json.dumps(r, ensure_ascii=False))
        print('erreurs :', errs[:3])
        await b.close()
asyncio.run(main())
