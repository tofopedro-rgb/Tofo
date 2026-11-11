"""Renderiza amostra.html em PDF e em imagens de páginas duplas (spreads)."""
import os, subprocess, glob
from weasyprint import HTML
from PIL import Image, ImageDraw
os.chdir(os.path.dirname(os.path.abspath(__file__)))
HTML('amostra.html').write_pdf('amostra.pdf')
os.makedirs('png', exist_ok=True)
for f in glob.glob('png/*'): os.remove(f)
subprocess.run(['pdftoppm', '-r', '110', '-png', 'amostra.pdf', 'png/p'], check=True)
pages = [Image.open(f) for f in sorted(glob.glob('png/p-*.png'))]
w, h = pages[0].size
groups = [[None, pages[0]]] + [pages[i:i + 2] for i in range(1, len(pages), 2)]
bg = (24, 20, 16); pad = 40
for k, g in enumerate(groups):
    sp = Image.new('RGB', (2 * w + 2 * pad, h + 2 * pad), bg)
    for j, p in enumerate(g):
        if p: sp.paste(p, (pad + j * w, pad))
    d = ImageDraw.Draw(sp); d.line([(pad + w, pad), (pad + w, pad + h)], fill=(0, 0, 0), width=1)
    sp.save(f'spread-{k:02d}.png')
print(len(pages), 'páginas,', len(groups), 'spreads')
