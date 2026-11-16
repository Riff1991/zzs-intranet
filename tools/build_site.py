#!/usr/bin/env python3
"""Sestaví src/index.html ze shell.html + app.js + data/intranet.json + loga.
Spuštění: python tools/build_site.py  (nejdřív python tools/build_data.py)
"""
import os, json
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
shell = rd('src/shell.html')
app = rd('src/app.js').replace('__ICON__', rd('src/icon.js')).replace('__DATA__', json.dumps(json.load(open(os.path.join(R, 'data/intranet.json'), encoding='utf-8')), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'))
shell = shell.replace('__LOGO__', rd('src/logo.b64').strip())
extra = '''<div class="pal-bg" id="mBg" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="pal" style="max-width:640px"><div style="display:flex;gap:12px;align-items:flex-start;padding:18px 20px 6px"><h2 id="mT" style="font-size:1.15rem;flex:1"></h2><button class="ib" id="mX" aria-label="Zavřít">✕</button></div><div id="mB" style="padding:6px 20px 20px;max-height:65vh;overflow-y:auto"></div></div></div>
'''
html = shell + extra + '<script>\n' + app + '\n</script>\n</body>\n</html>\n'
open(os.path.join(R, 'src/index.html'), 'w', encoding='utf-8').write(html)
print('src/index.html', len(html) // 1024, 'kB')
