"""Gera capas.html (uma capa por desenho), capas.pdf e capas-opcoes.png."""
import os, glob, subprocess, sys
from PIL import Image
os.chdir(os.path.dirname(os.path.abspath(__file__)))
# chave, título da obra, tamanho do fundo, posição, topo do título (pol), tema
CAPAS = [
 ('roulin',    'Retrato de Joseph Roulin, 1888',     '118% auto', '46% 0',   5.75, 'dark'),
 ('cafe',      'Terraço do café à noite, 1888',      '125% auto', '50% 0',   5.95, 'dark'),
 ('escalier2', 'Retrato de Patience Escalier, 1888', '120% auto', '50% 0',   5.75, 'dark'),
 ('mousme2',   'La Mousmé sentada, 1888',            '112% auto', '40% 0',   5.95, 'dark'),
 ('starry',    'A Noite Estrelada, desenho, 1889',   'auto 100%', '30% 50%', 5.95, 'dark'),
 ('wheatcyp2', 'Trigal com ciprestes, 1889',         'auto 100%', '62% 50%', 5.95, 'dark'),
]
if len(sys.argv) > 1: CAPAS = [c for c in CAPAS if c[0] in sys.argv[1:]]
CSS = '''
@font-face{font-family:Sans;src:url("fonts/archivo-latin-400-normal.woff");font-weight:400}
@font-face{font-family:Sans;src:url("fonts/archivo-latin-500-normal.woff");font-weight:500}
@font-face{font-family:Serif;src:url("fonts/eb-garamond-latin-400-normal.ttf");font-weight:400}
@font-face{font-family:Serif;src:url("fonts/eb-garamond-latin-400-italic.ttf");font-weight:400;font-style:italic}
@page{size:6in 9in;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
.pg{width:6in;height:9in;position:relative;overflow:hidden;break-after:page;background:#2A2119;color:#FBF8F1}
.art{position:absolute;top:0;bottom:0;left:.13in;right:0;background-repeat:no-repeat}
.shade{position:absolute;left:.13in;right:0;bottom:0;height:5in;background:linear-gradient(to bottom,rgba(20,15,10,0),rgba(20,15,10,.55) 45%,rgba(20,15,10,.66))}
.top{position:absolute;left:.13in;right:0;top:0;height:1.1in;background:linear-gradient(to bottom,rgba(20,15,10,.32),rgba(20,15,10,0))}
.spine{position:absolute;top:0;bottom:0;left:0;width:.13in;background:#F7F4EE}
.ed{position:absolute;top:.36in;left:.13in;right:0;text-align:center;font-family:Sans;font-weight:500;font-size:11pt;letter-spacing:.04em}
.t{position:absolute;left:.13in;right:0;text-align:center;font-family:Serif;font-size:50pt;line-height:1;letter-spacing:-.012em;white-space:nowrap}
.d{position:absolute;left:.13in;right:0;text-align:center;font-family:Serif;font-style:italic;font-size:15pt}
.coll{position:absolute;bottom:.42in;left:.13in;right:0;text-align:center;font-family:Serif;font-style:italic;font-size:10.5pt}
'''
pages = []
for key, obra, size, pos, top, theme in CAPAS:
    src = f'img/hd-{key}.jpg' if os.path.exists(f'img/hd-{key}.jpg') else f'../img/{key}.jpg'
    pages.append(f'''<section class="pg"><!-- {obra} -->
<div class="art" style="background-image:url('{src}');background-size:{size};background-position:{pos}"></div>
<div class="top"></div><div class="shade"></div><div class="spine"></div>
<div class="ed">Pedro Torres</div>
<div class="t" style="top:{top}in">Van Gogh a Lápis</div>
<div class="d" style="top:{top + .82}in">Desenhos, 1880–1890</div>
<div class="coll">Teoria, exercícios e catálogo</div>
</section>''')
open('capas.html', 'w').write(f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Van Gogh a Lápis · capas</title><style>{CSS}</style></head><body>{"".join(pages)}</body></html>')
from weasyprint import HTML
HTML('capas.html').write_pdf('capas.pdf')
for f in glob.glob('cp-*.png'): os.remove(f)
subprocess.run(['pdftoppm', '-r', '100', '-png', 'capas.pdf', 'cp'], check=True)
ims = [Image.open(f) for f in sorted(glob.glob('cp-*.png'))]
w, h = ims[0].size; p = 36; n = len(ims); cols = 3 if n > 3 else n; rows = -(-n // cols)
s = Image.new('RGB', (cols * w + (cols + 1) * p, rows * h + (rows + 1) * p), (24, 20, 16))
for i, im in enumerate(ims): s.paste(im, (p + (i % cols) * (w + p), p + (i // cols) * (h + p)))
s.save('capas-opcoes.png')
for f in glob.glob('cp-*.png'): os.remove(f)
print(n, 'capas')
