#!/usr/bin/env python3
"""Assemble Portée en une seule page autonome : index.html à la racine, servie par GitHub Pages (CSP avec empreintes des scripts)."""
import base64, hashlib, os, re
R = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
tpl = rd('src/template.html')
parts = {
    'LEAFLET_CSS': rd('node_modules/leaflet/dist/leaflet.css'),
    'INTER': rd('vendor/inter.css'),
    'STYLE': rd('src/style.css'),
    'ENGINE': rd('src/engine.js'),
    'LEAFLET_JS': rd('node_modules/leaflet/dist/leaflet.js').replace('//# sourceMappingURL=leaflet.js.map', ''),
    'APP': rd('src/app.js'),
}
for k in ('ENGINE', 'LEAFLET_JS', 'APP'):
    assert '</script' not in parts[k].lower(), k
out = tpl
for k, v in parts.items():
    out = out.replace('{{%s}}' % k, v)
# empreintes des scripts exécutables (pas le texte du moteur, chargé en Worker depuis un blob)
hashes = []
for m in re.finditer(r'<script(?![^>]*type="text/plain")[^>]*>(.*?)</script>', out, re.S):
    hashes.append("'sha256-%s'" % base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode())
out = out.replace('{{HASHES}}', ' '.join(hashes))
open(os.path.join(R, 'index.html'), 'w', encoding='utf-8').write(out)
print('index.html', len(out.encode('utf-8')), 'octets,', len(hashes), 'scripts')
