"""Vídeo de 30 s, vertical 1080 × 1920, para divulgar o livro. Gera marketing/video-30s.mp4.
Uso: python3 tools/video/make_video.py   (a partir de livro/, depois de gerar o PDF)"""
import os, subprocess, tempfile, math, io
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
W, H, FPS, DUR = 1080, 1920, 30, 30.0
PAPER, INK, CLAY, DARK, KRAFT = (238, 234, 224), (30, 25, 19), (191, 138, 90), (34, 27, 20), (214, 199, 168)
TMP = tempfile.mkdtemp()

def ttf(woff):
    out = os.path.join(TMP, os.path.basename(woff).replace('.woff', '.ttf'))
    if not os.path.exists(out):
        f = TTFont(woff); f.flavor = None; f.save(out)
    return out
DISP = ttf('fonts/archivo-black-latin-400-normal.woff')
SANS = ttf('fonts/archivo-latin-700-normal.woff')
SERIF = 'fonts/eb-garamond-latin-400-normal.ttf'
SERIF_I = 'fonts/eb-garamond-latin-400-italic.ttf'
def F(path, size): return ImageFont.truetype(path, size)

# páginas do livro
PAGES = {}
def page(n):
    if n not in PAGES:
        p = os.path.join(TMP, f'pg{n}')
        subprocess.run(['pdftoppm', '-r', '170', '-png', '-singlefile', '-f', str(n), '-l', str(n), 'out/Van-Gogh-a-Lapis.pdf', p], check=True)
        PAGES[n] = Image.open(p + '.png').convert('RGB')
    return PAGES[n]
IMG = {}
def img(name):
    if name not in IMG: IMG[name] = Image.open(f'img/{name}.jpg').convert('RGB')
    return IMG[name]

def ease(x): x = max(0, min(1, x)); return x * x * (3 - 2 * x)
def cover(im, scale=1.0, cx=.5, cy=.5, w=W, h=H):
    """recorta im para preencher w×h, com zoom e centro dados"""
    r = max(w / im.width, h / im.height) * scale
    nw, nh = im.width * r, im.height * r
    x0 = min(max(cx * nw - w / 2, 0), nw - w); y0 = min(max(cy * nh - h / 2, 0), nh - h)
    box = (x0 / r, y0 / r, (x0 + w) / r, (y0 + h) / r)
    return im.resize((w, h), Image.LANCZOS, box=box)
def text(d, xy, s, font, fill=INK, anchor='la', spacing=10):
    d.multiline_text(xy, s, font=font, fill=fill, anchor=anchor, spacing=spacing, align='center' if anchor[0] == 'm' else 'left')
def fade_alpha(t, a, b, f=.35):
    return ease((t - a) / f) * (1 - ease((t - (b - f)) / f))
def paste_alpha(base, im, xy, alpha):
    if alpha <= 0: return
    if alpha >= 1: base.paste(im, xy); return
    region = base.crop((xy[0], xy[1], xy[0] + im.width, xy[1] + im.height))
    base.paste(Image.blend(region, im, alpha), xy)
def circle(im, d):
    im = cover(im, w=d, h=d); m = Image.new('L', (d, d), 0); ImageDraw.Draw(m).ellipse((0, 0, d - 1, d - 1), fill=255)
    return im, m
def shadowed(im, pad=40):
    sh = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((pad, pad + 12, pad + im.width, pad + im.height + 12), fill=(0, 0, 0, 110))
    sh = sh.filter(ImageFilter.GaussianBlur(18)); sh.paste(im, (pad, pad)); return sh

def caption_band(fr, s, y=1560, size=58):
    d = ImageDraw.Draw(fr)
    text(d, (W // 2, y), s, F(DISP, size), INK, 'mm', 14)

# ------------------------------------------------------------------ cenas
def s_hook(t):          # 0 – 3.6  rosto do Roulin, zoom para fora
    ro = img('cover-roulin')
    z = 2.6 - 1.45 * ease(t / 3.4)
    fr = cover(ro, z, .47, .42 + .08 * (1 - ease(t / 3.4)))
    ov = Image.new('RGB', (W, H), (20, 15, 10)); fr = Image.blend(fr, ov, .25)
    g = Image.linear_gradient('L').resize((W, H)).transpose(Image.FLIP_TOP_BOTTOM).point(lambda v: int(max(0, v - 90) * 1.25))
    fr = Image.composite(Image.new('RGB', (W, H), (15, 11, 8)), fr, g)
    d = ImageDraw.Draw(fr)
    a = ease((t - .2) / .5)
    if a > 0:
        lay = fr.copy(); dl = ImageDraw.Draw(lay)
        text(dl, (W // 2, 470), 'Dá para aprender\no traço de\nVan Gogh?', F(DISP, 96), (251, 248, 241), 'mm', 18)
        fr = Image.blend(fr, lay, a)
    return fr

def s_marks(t):         # 3.6 – 8.4  cada coisa tem a sua marca
    fr = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(fr)
    text(d, (W // 2, 360), 'Ele não rabiscava\nao acaso.', F(DISP, 76), INK, 'mm', 14)
    items = [('det-lacrau-2', 'tracinho', 'campos'), ('det-boats-2', 'ponto', 'areia'), ('det-cypress-1', 'chama', 'ciprestes')]
    for i, (k, name, where) in enumerate(items):
        a = ease((t - .5 - i * .55) / .45)
        if a <= 0: continue
        dd = 320; c, m = circle(img(k), dd)
        y = 540 + i * 340; x = 150 if i % 2 == 0 else W - 150 - dd
        lay = fr.copy(); lay.paste(c, (x, y), m)
        dl = ImageDraw.Draw(lay)
        tx = x + dd + 50 if i % 2 == 0 else x - 50
        anc = 'lm' if i % 2 == 0 else 'rm'
        dl.text((tx, y + dd // 2 - 30), name, font=F(DISP, 62), fill=INK, anchor=anc)
        dl.text((tx, y + dd // 2 + 36), where, font=F(SERIF_I, 46), fill=(110, 98, 83), anchor=anc)
        fr = Image.blend(fr, lay, a)
    return fr

def s_flow(t):          # 8.4 – 12.6  corrente
    fr = Image.new('RGB', (W, H), PAPER)
    st = img('starry'); s = 1.18 + .12 * ease(t / 4.2)
    pic = cover(st, s, .35 + .3 * ease(t / 4.2), .5, w=W, h=960)
    fr.paste(pic, (0, 470))
    d = ImageDraw.Draw(fr)
    text(d, (W // 2, 330), 'Cada traço segue\numa corrente.', F(DISP, 70), INK, 'mm', 12)
    text(d, (W // 2, 1480), 'A Noite Estrelada, desenho a pena, 1889', F(SERIF_I, 44), (110, 98, 83), 'mm')
    return fr

BOOK = [11, 34, 42, 93]
def s_book(t):          # 12.6 – 19.2  páginas do livro
    fr = Image.new('RGB', (W, H), KRAFT); d = ImageDraw.Draw(fr)
    text(d, (W // 2, 320), 'Teoria explicada,\npágina por página.', F(DISP, 66), INK, 'mm', 12)
    per = 6.6 / len(BOOK)
    i = min(int(t / per), len(BOOK) - 1); lt = t - i * per
    for j in (i - 1, i):
        if j < 0: continue
        pg = page(BOOK[j]); ph = 1040; pw = round(pg.width * ph / pg.height)
        im = shadowed(pg.resize((pw, ph), Image.LANCZOS))
        if j == i:
            k = ease(lt / .45); x = int((W - im.width) / 2 + (1 - k) * 260); a = k
        else:
            k = ease(lt / .45); x = int((W - im.width) / 2 - k * 260); a = 1 - k
        if a > 0:
            lay = fr.copy(); lay.paste(im, (x, 420), im); fr = Image.blend(fr, lay, a)
    return fr

def s_steps(t):         # 19.2 – 25.2  esboço ao acabado
    fr = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(fr)
    text(d, (W // 2, 320), '91 exercícios,\ndo esboço ao traço.', F(DISP, 66), INK, 'mm', 12)
    seq = ['st-c11-1', 'st-c11-2', 'st-c11-3', 'c11']; labels = ['Esboço', 'Primeiras tintas', 'Quase pronto', 'Pronto']
    per = 6.0 / 4; i = min(int(t / per), 3); lt = t - i * per
    pw, ph = 760, 1010
    cur = cover(img(seq[i]), 1.0, w=pw, h=ph)
    if i > 0 and lt < .5:
        prev = cover(img(seq[i - 1]), 1.0, w=pw, h=ph); cur = Image.blend(prev, cur, ease(lt / .5))
    fr.paste(cur, ((W - pw) // 2, 450))
    for k, lab in enumerate(labels):
        x = 140 + k * 266; on = k <= i
        d.ellipse((x - 14, 1510 - 14, x + 14, 1510 + 14), fill=INK if on else None, outline=INK, width=3)
        if k < 3: d.line((x + 20, 1510, x + 246, 1510), fill=INK if k < i else (190, 180, 165), width=3)
        d.text((x, 1560), lab, font=F(SANS, 34), fill=INK if on else (160, 150, 135), anchor='mm')
    return fr

def s_end(t):           # 25.2 – 30  capa e chamada
    fr = Image.new('RGB', (W, H), DARK); d = ImageDraw.Draw(fr)
    cv = page(1); ch = 900; cw = round(cv.width * ch / cv.height)
    k = ease(t / .6); s = .94 + .06 * k
    im = shadowed(cv.resize((round(cw * s), round(ch * s)), Image.LANCZOS))
    lay = fr.copy(); lay.paste(im, ((W - im.width) // 2, 230 + int((1 - k) * 40)), im); fr = Image.blend(fr, lay, k)
    d = ImageDraw.Draw(fr)
    a = ease((t - .7) / .5)
    if a > 0:
        lay = fr.copy(); dl = ImageDraw.Draw(lay)
        text(dl, (W // 2, 1250), 'E-book com teoria, 91 exercícios\ne catálogo de obras', F(SERIF, 50), (233, 225, 208), 'mm', 12)
        dl.rounded_rectangle((W // 2 - 300, 1370, W // 2 + 300, 1490), radius=60, fill=CLAY)
        dl.text((W // 2, 1430), 'Link na bio', font=F(DISP, 54), fill=INK, anchor='mm')
        fr = Image.blend(fr, lay, a)
    return fr

SCENES = [(0, 3.6, s_hook), (3.6, 8.4, s_marks), (8.4, 12.6, s_flow), (12.6, 19.2, s_book), (19.2, 25.2, s_steps), (25.2, 30, s_end)]
XF = .35
def frame(t):
    for i, (a, b, fn) in enumerate(SCENES):
        if a <= t < b:
            fr = fn(t - a)
            if i > 0 and t - a < XF:
                pa, pb, pf = SCENES[i - 1]
                fr = Image.blend(pf(t - pa), fr, ease((t - a) / XF))
            return fr
    return SCENES[-1][2](SCENES[-1][1] - SCENES[-1][0] - .001)

if __name__ == '__main__':
    out = 'marketing/video-30s.mp4'
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    for n in range(int(DUR * FPS)):
        p.stdin.write(frame(n / FPS).tobytes())
    p.stdin.close(); p.wait()
    for n, t in enumerate([1.5, 5.8, 10, 14, 22, 28.5]):
        frame(t).save(f'marketing/quadro-{n + 1}.jpg', quality=85)
    print('ok', out)
