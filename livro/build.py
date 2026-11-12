"""Monta o livro Van Gogh a Lápis em PDF (WeasyPrint) e EPUB 3 a partir de src/*.md e data.json."""
import os, re, json, glob, html, uuid, zipfile, datetime
import markdown
from lxml import etree, html as lhtml

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
D = json.load(open('data.json'))
EX, PL, FI = D['ex'], D['pl'], D['fi']
esc = html.escape

# ---------------------------------------------------------------- textos dos exercícios para o livro
FIX = {
 'r03': {'c': 'os tufos lembram relva.'},
 'r09': {'d': 'Hachura curta em uma direção só. Para escurecer, aproxime as linhas e mantenha a mesma pressão.'},
 'r10': {'d': 'Mar e areia: tracinhos de um lado, pontos do outro. A fronteira entre os dois aparece só pela troca de marca, sem nenhuma linha.'},
 'f02': {'c': 'os cachos parecem labaredas.'},
 'f14': {'c': 'o cipreste pequeno parece estar mais longe, além de ser menor.'},
 'c09': {'d': 'Antes de preencher, desenhe numa folha à parte só as linhas de corrente de cada zona, a partir do mapa do Capítulo 4. Depois preencha zona por zona.'},
 'c17': {'c': 'a aba parece redonda.'},
 'c20': {'d': 'Tracinhos que apontam todos para o centro da cabeça. Esse fundo empurra o olhar para dentro.'},
 'c24': {'d': 'Estude este modelo e depois faça o mesmo a partir de uma foto de alguém seu, com luz lateral e fundo simples. Escreva a legenda no canto: pele, pelo, tecido, fundo.'},
 'a14': {'d': 'No espelho, ou a partir de uma foto sua. Fundo em anéis, como no modelo.'},
 'p02': {'d': 'Cubra a folha inteira, com uma marca diferente para cada coisa.'},
}
for x in EX:
    x.update(FIX.get(x['id'], {}))
for k, v in PL.items():
    for f in ('c', 'l', 't'):
        if f in v:
            v[f] = re.sub(r'(\d{2})(\d{2})–(\d{2})\b', lambda m: f'{m.group(1)}{m.group(2)} a {m.group(1)}{m.group(3)}', v[f]).replace('–', '-')
PL['sorrow']['l'] = 'O contorno é uma linha contínua e angulosa. O peso muda de lado: grossa embaixo da coxa e no pé, fina onde bate luz.'
LEVELS = [('w', 'nivel1', 'Nível 1', 'Fundamentos',
           'Exercícios curtos, de 8 a 20 minutos, que treinam uma marca ou uma parte do rosto de cada vez. Comece por aqui se está começando a desenhar, e volte a eles como aquecimento antes de cada sessão.'),
          ('e', 'nivel2', 'Nível 2', 'Essenciais',
           'Os dezoito exercícios que formam o núcleo do método. Quem fizer só estes já aprende a linguagem: planícies em faixas, fluxo, ciprestes, rostos em direções, autorretratos e figuras.'),
          ('d', 'nivel3', 'Nível 3', 'Aprofundamento',
           'Variações e casos mais difíceis, para quando o essencial estiver firme: outras soluções de fundo, luz lateral, marcas maiores e menores, novas paisagens.'),
          ('p', 'nivel4', 'Nível 4', 'Provas de mestre',
           'Estudos longos de obras de Van Gogh e o projeto final, em que você leva a linguagem para o seu próprio mundo. Use os métodos do Capítulo 8.')]
CHAP = {'r': ('cap2', 'Capítulo 2'), 'f': ('cap3', 'Capítulo 3'), 'c': ('cap4', 'Capítulo 4'), 'a': ('cap5', 'Capítulo 5'), 'b': ('cap6', 'Capítulo 6'), 'p': ('cap8', 'Capítulo 8')}
STAGES = set('r13 r16 r19 f13 f17 c11 c12 c16 a01 a13 b04 b06'.split())
STN = ['Esboço', 'Primeiras tintas', 'Quase pronto', 'Acabado']

def ex_html(x):
    cid, cname = CHAP[x['ch']]
    meta = esc(x['m'])
    out = [f'<section class="ex" id="ex-{x["id"]}">',
           f'<p class="exnum">{x["id"].upper()}</p>',
           f'<h3>{esc(x["t"])}</h3>',
           f'<figure class="model"><img src="img/{x["id"]}.jpg" alt="Desenho-modelo do exercício {x["id"].upper()}"/></figure>',
           f'<p class="exmeta">{meta}</p>',
           f'<p>{esc(x["d"])}</p>',
           f'<p class="crit"><span class="sc">Pronto quando</span> {esc(x["c"])}</p>']
    extra = [f'Teoria no <a href="#{cid}">{cname}</a>.']
    if x.get('ref') and x['ref'] in PL:
        extra.append(f'Obra para comparar: <a href="#cat-{x["ref"]}"><i>{esc(PL[x["ref"]]["t"])}</i></a>, no catálogo.')
    out.append(f'<p class="exref">{" ".join(extra)}</p>')
    if x['id'] in STAGES:
        imgs = ''.join(f'<figure><img src="img/{"st-"+x["id"]+"-"+str(k+1) if k < 3 else x["id"]}.jpg" alt="Etapa {k+1}"/><figcaption>{k+1}. {STN[k]}</figcaption></figure>' for k in range(4))
        out.append(f'<div class="steps4 small">{imgs}</div>')
    out.append('</section>')
    return '\n'.join(out)

# ---------------------------------------------------------------- leitura das fontes
def parse_src():
    secs = []
    for f in sorted(glob.glob('src/*.md')):
        txt = open(f).read()
        parts = re.split(r'<!-- id: (.*?) -->', txt)
        for i in range(1, len(parts), 2):
            meta = [p.strip() for p in parts[i].split('|')]
            body = parts[i + 1].strip()
            secs.append({'id': meta[0], 'title': meta[1], 'kind': meta[2], 'opener': meta[3] if len(meta) > 3 else None, 'md': body})
    return secs

MD = markdown.Markdown(extensions=['md_in_html', 'tables'])
def md2html(s):
    MD.reset()
    h = MD.convert(s)
    return h.replace('src="ex/', 'src="img/')

def practice_list(chid):
    rev = {v[0]: k for k, v in CHAP.items()}
    if chid == 'cap7':
        items = [x for x in EX if x['id'] in STAGES]
        head = 'Exercícios com demonstração em etapas'
    elif chid in rev:
        items = [x for x in EX if x['ch'] == rev[chid]]
        head = 'Para praticar'
    else:
        return ''
    lvn = {l[0]: l[2] for l in LEVELS}
    lis = ''.join(f'<li><a href="#ex-{x["id"]}">{x["id"].upper()}</a> {esc(x["t"])} <span class="lvl">{lvn[x["lv"]]}</span></li>' for x in items)
    return f'<div class="practice"><h4>{head}</h4><ul>{lis}</ul></div>'

def practice_line(chid):
    rev = {v[0]: k for k, v in CHAP.items()}
    if chid not in rev:
        return ''
    items = [x for x in EX if x['ch'] == rev[chid]]
    codes = sorted(x['id'] for x in items)
    ess = [x['id'] for x in items if x['lv'] == 'e']
    link = lambda c: f'<a href="#ex-{c}">{c.upper()}</a>'
    txt = f'<b>Para praticar</b> {link(codes[0])} a {link(codes[-1])}, {len(codes)} exercícios.'
    if ess:
        txt += ' Comece pelos essenciais: ' + ', '.join(link(c) for c in sorted(ess)) + '.'
    return f'<p class="pline">{txt}</p>'

def build_sections():
    src = parse_src()
    S = []
    for s in src:
        h = md2html(s['md'])
        if s['id'] in ('como-usar', 'cap1'):
            h = add_icons(h)
        if s['id'] == 'vida':
            i = h.index('<h2>')
            h = h[:i] + '<!--MAPA-->' + h[i:] + tracos_html()
        if s['id'] in BALLOON_CHAPTERS:
            h = add_balloons(h)
        if s['kind'] == 'chapter':
            h += practice_line(s['id'])
        S.append({**s, 'html': h})
        if s['id'] == 'cap8':  # depois da Parte II vem a Parte III
            S.append({'id': 'parte3', 'title': 'Parte III · Exercícios', 'kind': 'part', 'opener': 'ex/part3.jpg',
                      'html': '<h1>Parte III</h1>\n<h2>Exercícios</h2>'})
            for code, lid, ln, name, intro in LEVELS:
                items = [x for x in EX if x['lv'] == code]
                body = f'<h1><span class="lvnum">{ln}</span> {name}</h1>\n<p class="lead">{intro}</p>\n<p class="count">{len(items)} exercícios</p>\n' + '\n'.join(ex_html(x) for x in items)
                S.append({'id': lid, 'title': f'{ln} · {name}', 'kind': 'level', 'html': body})
    return S

def catalogue():
    order = ['sorrow', 'wornout', 'orphan', 'yard', 'peasant', 'reaper', 'head85', 'hands', 'sower1', 'sower2', 'digger',
             'lacrau', 'arlesview', 'rock', 'boats', 'street', 'cottages2', 'garden', 'harvest', 'stacks', 'cafe',
             'roulin', 'roulin2', 'zouavepen', 'escalier', 'escalier2', 'mousme', 'mousme2', 'tanguy',
             'sp_chi', 'sp_close', 'sp_straw', 'sp_painter', 'sp_felt', 'sp_felteye', 'sp_gauguin', 'sp_ear', 'sp_orsay',
             'starry', 'cypress', 'wheatcyp', 'wheatcyp2', 'fountain', 'olivep', 'enclosed', 'pine', 'gachet']
    order += [k for k in PL if k not in order]
    rows = []
    for i, k in enumerate(order, 1):
        p = PL[k]; f = FI.get(k, {})
        inst = f.get('inst', '')
        if inst and inst.split(' (')[0].split(',')[0][:12] in p['c']:
            inst = ''
        ficha = ' · '.join(v for v in [f.get('cat'), f.get('dim'), inst] if v)
        rows.append(f'<div class="cat" id="cat-{k}"><img src="img/{k}.jpg" alt="{esc(p["t"])}"/><div><p class="ct"><span class="cn">{i}</span> <i>{esc(p["t"])}</i></p>'
                    f'<p class="cc">{esc(p["c"])}</p>' + (f'<p class="cf">{esc(ficha)}</p>' if ficha else '') + f'<p class="cl">{esc(p.get("l", ""))}</p></div></div>')
    intro = ('<p>As obras de Van Gogh citadas no livro e indicadas nos exercícios, em ordem aproximada de data. Quando disponíveis, '
             'seguem os números de catálogo F (de la Faille) e JH (Hulsker), as dimensões (altura por largura) e o acervo.</p>')
    return {'id': 'catalogo', 'title': 'Catálogo das obras', 'kind': 'back', 'html': '<h1>Catálogo das obras</h1>' + intro + ''.join(rows)}

def ex_index():
    lvn = {l[0]: l[2] for l in LEVELS}
    rows = ''.join(f'<tr><td><a href="#ex-{x["id"]}">{x["id"].upper()}</a></td><td>{esc(x["t"])}</td><td>{lvn[x["lv"]]}</td></tr>'
                   for x in sorted(EX, key=lambda x: ('rfcabp'.index(x['ch']), x['id'])))
    return {'id': 'indice', 'title': 'Índice dos exercícios', 'kind': 'back',
            'html': '<h1>Índice dos exercícios</h1><table class="idx"><tr><th>Código</th><th>Exercício</th><th>Nível</th></tr>' + rows + '</table>'}

CREDITS = {'id': 'creditos', 'title': 'Créditos', 'kind': 'back', 'html': md2html(
"""# Créditos

As reproduções de obras de Vincent van Gogh são de domínio público e foram obtidas no Wikimedia Commons. A reprodução do *Retrato de Joseph Roulin* usada na capa vem do Open Content Program do J. Paul Getty Museum, em Los Angeles. Os dados de catálogo vêm do Wikidata e do Wikimedia Commons. As citações das cartas são traduções livres do autor a partir da edição em inglês publicada pelo Van Gogh Museum e pelo Huygens Institute em vangoghletters.org.

Os desenhos-modelo dos exercícios, as demonstrações em etapas as amostras de marcas e as fotografias de materiais foram criados para este livro com o auxílio de ferramentas de inteligência artificial, a partir de orientações do autor. São interpretações no estilo dos desenhos de Van Gogh e não reproduzem obras dele. Os ícones e o mapa foram desenhados para este livro.

Texto composto em EB Garamond e Archivo.""")}

# ---------------------------------------------------------------- detalhes das obras (balões logo depois de cada obra)
# obra: (imagem de origem, [(centro x, centro y, lado como fração da largura, título, texto)])
WORK_DETAILS = {
 'lacrau': ('lacrau', [(.62, .14, .24, 'O horizonte', 'Perto do horizonte a marca fica miúda e quase some.'),
                       (.45, .62, .22, 'Faixas de tracinhos', 'Cada campo é uma faixa de tracinhos deitados.'),
                       (.25, .88, .22, 'O primeiro plano', 'Embaixo as marcas crescem e escurecem. É ali que entram os pretos.')]),
 'boats': ('boats', [(.45, .66, .2, 'Contorno firme', 'Os cascos têm a linha mais segura da folha.'),
                     (.8, .86, .18, 'Areia em pontos', 'A praia é só pontos. O papel entre eles vira luz.')]),
 'garden': ('garden', [(.55, .12, .22, 'Ao fundo', 'As casas e as árvores do fundo recebem marcas bem menores.'),
                       (.3, .72, .2, 'Uma marca por canteiro', 'Vírgulas num canteiro, pontos no outro. Não há contorno entre eles.')]),
 'cypress': ('cypress', [(.45, .18, .26, 'O cacho em chama', 'Cada cacho é um C de dois a quatro traços paralelos, sempre subindo.'),
                         (.42, .55, .26, 'O miolo apertado', 'No miolo os cachos se apertam até quase fundirem.'),
                         (.5, .9, .3, 'O chão em ondas', 'Embaixo, o chão repete o movimento em ondas longas.')]),
 'starry': ('starry', [(.885, .14, .2, 'A coroa da lua', 'Os tracinhos giram em anéis em volta do astro.'),
                       (.5, .42, .22, 'As correntes do céu', 'O céu corre em faixas que se enrolam.'),
                       (.25, .55, .26, 'O cipreste', 'A única massa densa da folha, ligando o chão ao céu.')]),
 'wheatcyp': ('wheatcyp', [(.5, .15, .24, 'O céu que se enrola', 'As nuvens correm em curvas que se fecham em redemoinho.'),
                           (.82, .45, .2, 'O cipreste', 'Pinceladas que sobem e se torcem como chamas.'),
                           (.35, .86, .22, 'O trigo', 'Toques curtos e inclinados, todos na mesma direção.')]),
 'roulin': ('cover-roulin', [(.39, .385, .15, 'O olho como redemoinho', 'Anéis curtos em volta da órbita. A pálpebra de cima é a linha mais grossa.'),
                             (.5, .6, .24, 'A barba em leque', 'Curvas que descem e se abrem, em vez de fios soltos.'),
                             (.25, .86, .26, 'O casaco', 'Hachura grossa e cruzada, que acompanha a lapela.')]),
 'escalier2': ('escalier2', [(.55, .2, .3, 'O chapéu em branco', 'O chapéu fica quase só em contorno.'),
                             (.5, .44, .2, 'O rosto', 'Tracinhos curtos seguem as rugas e os planos.'),
                             (.86, .16, .2, 'O fundo pontilhado', 'Pontos em fileiras empurram a cabeça para a frente.')]),
 'mousme': ('mousme', [(.47, .33, .26, 'Quase papel', 'Contorno pesado só nos olhos, nas sobrancelhas, nas narinas e na boca.'),
                       (.5, .72, .3, 'A blusa listrada', 'Listras grossas que seguem as pregas da roupa.')]),
 'sp_felt': ('sp_felt', [(.5, .2, .3, 'A aba do chapéu', 'Tracinhos que dão a volta inteira na aba.'),
                         (.13, .42, .24, 'O halo de tracinhos', 'Pinceladas curtas irradiam da cabeça e a destacam.')]),
 'sp_chi': ('sp_chi', [(.5, .44, .2, 'Raios a partir do nariz', 'Os tracinhos do rosto saem do nariz como raios.'),
                       (.12, .2, .22, 'O fundo pontilhado', 'Pontos maiores que as marcas do rosto.')]),
 'sp_gauguin': ('sp_gauguin', [(.45, .4, .22, 'Planos firmes', 'Cabeça raspada, planos firmes e contorno pesado.'),
                               (.85, .2, .25, 'O fundo calmo', 'Quase liso. Toda a energia fica no rosto.')]),
 'sp_orsay': ('sp_orsay', [(.14, .2, .26, 'O fundo em redemoinho', 'O fundo inteiro gira em correntes, como água.'),
                           (.5, .4, .2, 'O rosto parado', 'Marcas mais curtas e mais firmes que as do fundo.'),
                           (.62, .82, .26, 'O casaco na corrente', 'Linhas onduladas iguais às do fundo.')]),
 'wornout': ('wornout', [(.55, .3, .45, 'O rosto escondido', 'A cabeça entre as mãos. A emoção inteira está na pose.')]),
 'peasant': ('peasant', [(.55, .3, .3, 'Duas massas ovais', 'Costas e quadril são duas massas. A hachura muda de direção em cada uma.'),
                         (.3, .52, .24, 'A hachura em aros', 'No braço, a hachura dá a volta na forma.')]),
 'cafe': ('cafe', [(.42, .42, .25, 'O lampião', 'Contorno quebrado e raios curtos em volta da luz.'),
                   (.3, .15, .35, 'O toldo', 'Linhas longas e paralelas que seguem a curva do pano.'),
                   (.5, .88, .35, 'O calçamento', 'Pedras em pequenos laços, cada vez menores rumo ao fundo.')]),
 'mousme2': ('mousme2', [(.42, .2, .28, 'O rosto', 'Quase papel em branco, com contorno só nas feições.'),
                         (.45, .45, .35, 'A blusa listrada', 'Listras grossas que descem e seguem o corpo.'),
                         (.5, .82, .35, 'A saia pontilhada', 'Pontos e anéis em fileiras soltas.')]),
 'sorrow': ('sorrow', [(.45, .66, .26, 'O contorno com peso', 'A linha engrossa embaixo da coxa e no pé, e afina onde bate luz.')]),
}
BALLOON_CHAPTERS = ('cap2', 'cap3', 'cap4', 'cap5', 'cap6')

def make_details():
    from PIL import Image
    for key, (src, items) in WORK_DETAILS.items():
        im = Image.open(f'img/{src}.jpg').convert('RGB')
        for i, (cx, cy, sz, *_ ) in enumerate(items, 1):
            side = sz * im.width
            x0 = max(0, min(im.width - side, cx * im.width - side / 2))
            y0 = max(0, min(im.height - side, cy * im.height - side / 2))
            im.crop((round(x0), round(y0), round(x0 + side), round(y0 + side))).resize((520, 520), Image.LANCZOS).save(f'img/det-{key}-{i}.jpg', quality=90)

def balloons_html(key):
    src, items = WORK_DETAILS[key]
    cells = ''.join(f'<figure class="bal"><img src="img/det-{key}-{i}.jpg" alt="{esc(t)}"/>'
                    f'<figcaption><b>{esc(t)}</b> {esc(d)}</figcaption></figure>'
                    for i, (cx, cy, sz, t, d) in enumerate(items, 1))
    return f'<div class="balrow n{len(items)}">{cells}</div>'

def add_balloons(h):
    def rep(m):
        key = m.group(1)
        if key not in WORK_DETAILS:
            return m.group(0)
        from PIL import Image
        w_, h_ = Image.open(f'img/{key}.jpg').size
        side = h_ > w_ * 1.05
        return f'<div class="figbal{" side" if side else ""}">{m.group(0)}{balloons_html(key)}</div>'
    return re.sub(r'<figure[^>]*>\s*<img src="img/([a-z0-9_]+)\.jpg"[^>]*>.*?</figure>', rep, h, flags=re.S)

# ---------------------------------------------------------------- ícones e linha do tempo
ICONS_H2 = {'Por onde começar': 'comecar', 'Os desenhos-modelo': 'modelo', 'Material para desenhar por cima': 'imprimir',
            'As cartas': 'cartas', 'O lápis de carpinteiro': 'lapis', 'O giz preto e o giz litográfico': 'giz', 'O carvão': 'carvao',
            'A pena de junco': 'junco', 'A tinta': 'tinta', 'O papel': 'papel', 'A moldura de perspectiva': 'moldura', 'No tablet': 'tablet'}

def add_icons(h):
    return re.sub(r'<h2>([^<]+)</h2>', lambda m: (f'<h2 class="ic"><img class="icon" src="img/icons/{ICONS_H2[m.group(1)]}.svg" alt=""/>{m.group(1)}</h2>'
                                                  if m.group(1) in ICONS_H2 else m.group(0)), h)

ENDERECOS = [('Borinage', '1879–1880', 'Pregador entre os mineiros, começa a desenhá-los.'),
             ('Bruxelas', '1880–1881', 'Anatomia, perspectiva e as pranchas de Bargue.'),
             ('Etten', '1881', 'Na casa dos pais, copia Millet e desenha do natural.'),
             ('Haia', '1881–1883', 'A escola do preto e branco.'),
             ('Drenthe', '1883', 'Três meses entre as turfeiras do norte.'),
             ('Nuenen', '1883–1885', 'Tecelões, camponeses e a forma pelas massas.'),
             ('Antuérpia', '1885–1886', 'Poucos meses na academia.'),
             ('Paris', '1886–1888', 'A paleta clareia e chegam as gravuras japonesas.'),
             ('Arles', '1888–1889', 'A pena de junco e o alfabeto de marcas.'),
             ('Saint-Rémy', '1889–1890', 'O traço curto se alonga em curvas.'),
             ('Auvers-sur-Oise', '1890', 'Setenta pinturas em dois meses e a única água-forte.')]
# ano, lugar, imagem, centro x, centro y, largura (fração), obra, texto
TRACOS = [('1881', 'Etten', 'sower2', .55, .22, .95, 'Semeador de perfil', 'Lápis duro e contorno contínuo. Ainda copia Millet.'),
          ('1882', 'Haia', 'sorrow', .5, .62, .8, 'Sorrow', 'Uma linha só, mais grossa embaixo das formas.'),
          ('1882', 'Haia', 'wornout', .5, .28, .85, 'Worn Out', 'Lápis sobre papel de aquarela. A pose carrega a emoção.'),
          ('1885', 'Nuenen', 'peasant', .5, .3, .85, 'Camponesa curvada', 'Giz preto em aros sobre massas ovais.'),
          ('1885', 'Nuenen', 'hands', .5, .5, .9, 'Três mãos', 'Mãos grandes e pesadas, construídas pelas massas.'),
          ('1887', 'Paris', 'sp_chi', .5, .45, .7, 'Autorretrato', 'Tracinhos de cor separados, em raios a partir do nariz.'),
          ('1888', 'Arles', 'lacrau', .5, .62, .6, 'La Crau vista de Montmajour', 'Pena de junco: uma marca para cada superfície.'),
          ('1888', 'Arles', 'cover-roulin', .5, .58, .6, 'Retrato de Joseph Roulin', 'Quatro substâncias, quatro marcas num só rosto.'),
          ('1889', 'Saint-Rémy', 'cypress', .45, .25, .8, 'Ciprestes', 'Curvas que sobem e se enrolam como chamas.'),
          ('1890', 'Auvers', 'gachet', .5, .45, .85, 'Dr. Gachet', 'A única água-forte: hachura nervosa e rápida.')]

def make_tracos():
    from PIL import Image
    for i, (yy, pl, k, cx, cy, w, t, tx) in enumerate(TRACOS, 1):
        im = Image.open(f'img/{k}.jpg').convert('RGB'); W = w * im.width; H = W / 2.1
        x0 = max(0, min(im.width - W, cx * im.width - W / 2)); y0 = max(0, min(im.height - H, cy * im.height - H / 2))
        im.crop((round(x0), round(y0), round(x0 + W), round(y0 + H))).resize((840, 400), Image.LANCZOS).save(f'img/traco-{i:02d}.jpg', quality=90)

def map_html(inline=True):
    if inline:
        svg = open('img/mapa-caminho.svg').read()
        mp = f'<div class="mapa">{svg}</div>'
    else:
        mp = '<figure class="mapa"><img src="img/mapa-caminho.svg" alt="Mapa com os endereços de Van Gogh entre 1879 e 1890"/></figure>'
    rows = ''.join(f'<div class="end"><span class="en">{i}</span><div><p><b>{c}</b> <span class="ey">{y}</span></p><p>{t}</p></div></div>'
                   for i, (c, y, t) in enumerate(ENDERECOS, 1))
    return (mp + '<div class="enderecos"><h2>Onze endereços</h2><p class="sub">Cada cidade deixou alguma coisa no traço. '
            'Zundert, onde nasceu em 1853, e Londres, onde trabalhou de 1873 a 1876, aparecem no mapa como pontos vazados.</p>' + rows + '</div>')

def tracos_html():
    def row(i, x):
        yy, pl, k, cx, cy, w, t, tx = x
        return (f'<div class="tr"><img src="img/traco-{i:02d}.jpg" alt="Detalhe de {esc(t)}"/>'
                f'<div class="trt"><p class="ty">{yy}</p><p class="tp">{pl} · <i>{esc(t)}</i></p><p>{tx}</p></div></div>')
    rows = [row(i, x) for i, x in enumerate(TRACOS, 1)]
    return ('<div class="tracos"><h2>Dez anos em dez traços</h2><p class="sub">O mesmo desenhista, de 1881 a 1890, sempre visto de perto.</p>'
            + ''.join(rows[:5]) + '<div class="tr2">' + ''.join(rows[5:]) + '</div></div>')

# ---------------------------------------------------------------- PDF (edição ilustrada)
FONTDIR = os.path.join(ROOT, 'fonts')
PARTS = {'parte1': ('01', 'Parte I', 'Dez anos de desenho', None),
         'parte2': ('02', 'Parte II', 'A linguagem',
                    'Os materiais, as marcas, a direção do traço, o rosto, os autorretratos, o corpo, a ordem em que ele construía uma folha e a maneira de copiar um mestre. Um capítulo para cada coisa.'),
         'parte3': ('03', 'Parte III', 'Exercícios', '<p>Os 91 exercícios estão em quatro níveis. Dentro de cada nível, aparecem na ordem dos capítulos: ranhuras (R), fluxo (F), rostos (C), autorretratos (A), corpo (B) e projeto (P). O código de cada exercício indica o assunto: R para ranhuras, F para fluxo, C para rostos, A para autorretratos, B para o corpo e P para o projeto.</p><p>Cada página traz o desenho-modelo, o tempo e o material sugeridos, a instrução e um critério para saber quando o exercício está pronto. Doze exercícios mostram também as etapas da construção, do esboço ao acabamento.</p><p>Para desenhar por cima, imprima a página e use papel vegetal, ou importe-a num aplicativo de desenho e trabalhe numa camada acima. Na maioria das vezes, porém, desenhe ao lado do livro, olhando o modelo.</p>'),
         'parte4': ('04', 'Parte IV', 'Prática',
                    'Um plano de estudo de oito semanas e uma autoavaliação para conferir o resultado.')}
PART_ART = {'parte1': 'sower2', 'parte2': 'zouavepen', 'parte3': 'fountain', 'parte4': 'roulin2'}
ICONS = ['sorrow', 'cafe', 'roulin', 'mousme2', 'starry', 'cypress']
CAT_ORDER = ['sorrow', 'wornout', 'orphan', 'yard', 'peasant', 'reaper', 'head85', 'hands', 'sower1', 'sower2', 'digger',
             'lacrau', 'arlesview', 'rock', 'boats', 'street', 'cottages2', 'garden', 'harvest', 'stacks', 'cafe',
             'roulin', 'roulin2', 'zouavepen', 'escalier', 'escalier2', 'mousme', 'mousme2', 'tanguy',
             'sp_chi', 'sp_close', 'sp_straw', 'sp_painter', 'sp_felt', 'sp_felteye', 'sp_gauguin', 'sp_ear', 'sp_orsay',
             'starry', 'cypress', 'wheatcyp', 'wheatcyp2', 'fountain', 'olivep', 'enclosed', 'pine', 'gachet']

def font_faces(base='file://' + FONTDIR + '/'):
    css = ''
    for w in (400, 500, 600, 700):
        for st in ('normal', 'italic'):
            for sub in ('latin', 'latin-ext'):
                f = f'eb-garamond-{sub}-{w}-{st}.ttf'
                if os.path.exists(os.path.join(FONTDIR, f)):
                    css += f'@font-face{{font-family:"Serif";src:url("{base}{f}");font-weight:{w};font-style:{st}}}\n'
    for f in sorted(os.listdir(FONTDIR)):
        m = re.match(r'archivo-(black-)?latin(-ext)?-(\d+)-(normal|italic)\.woff$', f)
        if m:
            fam = 'Disp' if m.group(1) else 'Sans'
            css += f'@font-face{{font-family:"{fam}";src:url("{base}{f}");font-weight:{m.group(3)};font-style:{m.group(4)}}}\n'
    return css

PDF_CSS = """
@page{size:6in 9in;margin:.62in .72in .82in .55in;background:#EEEAE0}
@page :left{margin-left:.55in;margin-right:.72in;
  @bottom-left{content:counter(page) "\\2003" string(sec);font:400 7.2pt Sans;color:#6E6253;vertical-align:top;padding-top:.3in}}
@page :right{margin-left:.72in;margin-right:.55in;
  @bottom-right{content:string(sec) "\\2003" counter(page);font:400 7.2pt Sans;color:#6E6253;vertical-align:top;padding-top:.3in}}
@page full{margin:0;@bottom-left{content:none}@bottom-right{content:none}}
@page part{margin:0;background:#BF8A5A;@bottom-left{content:none}@bottom-right{content:none}}
@page kraft{margin:0;background:#D6C7A8;@bottom-left{content:none}@bottom-right{content:none}}
@page bare{@bottom-left{content:none}@bottom-right{content:none}}
@page chap:first{@bottom-left{content:none}@bottom-right{content:none}}
:root{--ink:#1E1913;--mute:#6E6253;--soft:#A39682;--clay:#BF8A5A;--kraft:#D6C7A8;--paper:#EEEAE0}
html{font-family:Serif,serif;font-size:10.3pt;line-height:1.42;color:#1E1913;hyphens:auto}
body{margin:0}
*{bookmark-level:none}
p{margin:0 0 .55em;text-align:justify;orphans:2;widows:2}
a{color:inherit;text-decoration:none}
i,em{font-style:italic}
.rh{string-set:sec content();display:block;height:0;overflow:hidden;margin:0}
h1,h2,h3,h4{hyphens:manual}
h1{font:400 21pt/1.05 Disp;margin:0 0 .8em;letter-spacing:-.01em}
h2{font:400 12pt/1.2 Disp;margin:1.5em 0 .5em;break-after:avoid}
h3{font:700 10.5pt/1.25 Sans;margin:1.1em 0 .35em;break-after:avoid}
h4{font:700 7.6pt/1.3 Sans;margin:0 0 .4em;color:#1E1913}
figure{margin:1em 0;break-inside:avoid;text-align:center}
figure img{max-width:100%;max-height:4.1in}
figure.wide img{max-height:3.4in}
figcaption{font:400 7.4pt/1.42 Sans;color:#6E6253;text-align:left;margin-top:.45em}
figcaption i{color:#1E1913;font-weight:500}
table{border-collapse:collapse;width:100%;font-size:9.2pt;margin:.6em 0 1em}
th{font:700 7.2pt Sans;text-align:left;border-bottom:.6pt solid #1E1913;padding:.3em .4em .3em 0}
td{border-bottom:.4pt solid #CFC4B0;padding:.35em .5em .35em 0;vertical-align:top}
table.chrono td,table.letters td{vertical-align:baseline;line-height:1.38}
table.chrono tr,table.letters tr{break-inside:avoid}
table.chrono td:first-child{font:400 10pt Disp;width:.62in;white-space:nowrap}
table.letters td:first-child{font:400 9pt Disp;width:.72in;white-space:nowrap}
table.letters td:nth-child(2){font:400 7.6pt/1.4 Sans;color:#6E6253;width:1.35in}
ol.check li{margin:.35em 0}
dl.gloss dt{font:700 8.6pt Sans;margin-top:.7em}dl.gloss dd{margin:.1em 0 0 0}
.ref{padding-left:1.2em;text-indent:-1.2em;text-align:left}
.sign{text-align:right;font-style:italic;margin-top:1.2em}
.vida{background:#E3D9C6;padding:.14in .16in .1in;margin:0 0 1.3em}
.vida h4{margin-bottom:.3em}.vida p{text-align:left;font-size:9.4pt;line-height:1.4;margin:0}
.marks{display:grid;grid-template-columns:1fr 1fr;column-gap:.16in;row-gap:.12in;margin:.6em 0 1em}
.marks figure{margin:0}.marks img{max-height:1.35in;width:100%;object-fit:cover}
.pair{display:grid;grid-template-columns:1fr 1fr;column-gap:.16in;break-inside:avoid;margin:.8em 0}.pair figure{margin:0}
.pair img{max-height:2.3in}
.steps4{display:grid;grid-template-columns:repeat(4,1fr);column-gap:.08in;break-inside:avoid;margin:.8em 0}.steps4 figure{margin:0}
.steps4 img{max-height:1.55in}.steps4 figcaption{font-size:6.8pt}
.practice{margin-top:1.6em;border-top:.6pt solid #1E1913;padding-top:.7em;break-inside:avoid}
.practice ul{margin:0;padding:0;list-style:none;font-size:9.2pt;columns:2;column-gap:.2in}
.practice li{margin:.1em 0;break-inside:avoid}.practice a{font:700 7.6pt Sans;margin-right:.35em}
.practice .lvl{font:400 6.8pt Sans;color:#6E6253;margin-left:.25em}
.lead{font-size:11pt;font-style:italic;text-align:left}


/* ícones, balões, linha do tempo */
h2.ic{display:flex;align-items:center;gap:.1in}
h2.ic .icon{width:.36in;height:.36in;flex:none}
.figbal{break-inside:avoid;margin:1em 0 1.3em}
.figbal > figure{margin:0 0 .16in}
.figbal > figure img{max-height:3.25in}
.figbal.side{display:flex;gap:.22in;align-items:flex-start}
.figbal.side > figure{flex:none;width:3.05in;margin:0}
.figbal.side > figure img{max-height:4.1in;width:auto;max-width:3.05in}
.figbal.side .balrow{flex:1;flex-direction:column;gap:.14in;justify-content:flex-start}
.figbal.side .bal{width:auto}
.figbal.side .bal img{width:.92in;height:.92in}
.pline{margin-top:1.4em;border-top:.6pt solid #1E1913;padding-top:.08in;font:400 7.8pt/1.5 Sans;text-align:left}
.pline b{font-weight:700;margin-right:.3em}.pline a{font-weight:700;border-bottom:.5pt solid #BF8A5A}
.balrow{display:flex;gap:.22in;justify-content:center}
.bal{width:1.45in;flex:none;margin:0;text-align:left}
.bal img{width:1.1in;height:1.1in;border-radius:50%;display:block;margin:0 0 .08in}
.bal figcaption{margin:0;font-size:7pt;line-height:1.4}
.bal figcaption b{display:block;font-weight:700;color:#1E1913;margin-bottom:.02in}
.mapa{page:full;break-before:page;width:6in;height:9in}
.mapa svg{display:block;width:6in;height:9in}
.enderecos{break-before:page}
.enderecos h2,.tracos h2{font:400 17pt/1.1 Disp;margin:0 0 .05in}
.enderecos .sub,.tracos .sub{font:italic 10pt/1.35 Serif;margin:0 0 .2in;text-align:left}
.end{display:flex;gap:.12in;border-top:.6pt solid #CFC4B0;padding:.07in 0}
.end .en{flex:none;width:.2in;height:.2in;border-radius:50%;background:#1E1913;color:#F4EFE6;font:700 6.8pt/.2in Sans;text-align:center}
.end p{margin:0;text-align:left;font-size:9.2pt;line-height:1.32}.end b{font:700 8.4pt Sans}.end .ey{font:400 7.6pt Sans;color:#6E6253}
.tracos{break-before:page}
.tr{display:flex;gap:.16in;border-top:.6pt solid #CFC4B0;padding:.07in 0 .08in;break-inside:avoid}
.tr img{width:2.3in;height:1.1in;flex:none}
.trt p{margin:0;text-align:left;font-size:9pt;line-height:1.32}.trt .ty{font:400 16pt/1 Disp}
.trt .tp{font:700 7.6pt Sans;margin:.05in 0 .04in}.trt .tp i{font-weight:400}
.tr2{break-before:page;padding-top:.68in}
.lvhead .lvtag{position:absolute;left:0;bottom:.62in;font:400 30pt/1 Disp;color:#BF8A5A;margin:0}

/* blocos numerados e diagramas */
ol.laws{list-style:none;margin:.6em 0 1.2em;padding:0;counter-reset:law}
ol.laws li{counter-increment:law;position:relative;padding:.09in 0 .09in .46in;border-top:.6pt solid #CFC4B0;text-align:left;break-inside:avoid}
ol.laws li:last-child{border-bottom:.6pt solid #CFC4B0}
ol.laws li::before{content:counter(law);position:absolute;left:0;top:.06in;font:400 17pt/1 Disp;color:#1E1913}
ol.laws li b{display:block;font:700 8.8pt Sans;margin-bottom:.03in}
figure.diag img{width:100%;max-height:none}

/* final */
.fim{page:kraft;break-before:page;width:6in;height:9in;position:relative}
.fim img{position:absolute;left:.7in;top:.8in;width:4.6in;height:4.2in;object-fit:contain}
.fim .fq{position:absolute;left:.85in;right:.85in;top:5.45in;font:italic 400 15pt/1.35 Serif;text-align:left;color:#1E1913}
.fim .fs{position:absolute;left:.85in;right:.85in;top:7.25in;font:500 7.4pt/1.4 Sans;color:#4A4034;text-align:left}
.contra{page:full;break-before:page;width:6in;height:9in;background:#2A2119;color:#EFE8DA;text-align:center;position:relative}
.contra .ct1{position:absolute;left:0;right:0;top:3.7in;font:400 30pt/1 Serif;text-align:center}
.contra .ct2{position:absolute;left:0;right:0;top:4.35in;font:italic 400 11pt Serif;color:#BDB09A;text-align:center}
.contra .ct3{position:absolute;left:0;right:0;bottom:.7in;font:500 8pt Sans;letter-spacing:.2em;text-align:center}
/* capa */
.cover{page:full;position:relative;width:6in;height:9in;background:#2A2119;color:#FBF8F1;break-after:page;bookmark-level:1;bookmark-label:"Capa"}
.cover .art{position:absolute;top:0;bottom:0;left:0;right:0;background:url("img/cover-roulin.jpg") 46% 0/122% auto no-repeat}
.cover .topsh{position:absolute;left:0;right:0;top:0;height:1.1in;background:linear-gradient(to bottom,rgba(20,15,10,.32),rgba(20,15,10,0))}
.cover .shade{position:absolute;left:0;right:0;bottom:0;height:5in;background:linear-gradient(to bottom,rgba(20,15,10,0),rgba(20,15,10,.55) 45%,rgba(20,15,10,.66))}
.cover .spine{position:absolute;top:0;bottom:0;left:0;width:.13in;background:#F7F4EE}
.cover .ed{position:absolute;top:.38in;left:0;right:0;text-align:center;font:500 10.5pt Sans;letter-spacing:.2em}
.cover .t{position:absolute;left:0;right:0;top:5.75in;text-align:center;font:400 50pt/1 Serif;letter-spacing:-.012em;white-space:nowrap}
.cover .d{position:absolute;left:0;right:0;top:6.57in;text-align:center;font:italic 400 15pt Serif}
.cover .coll{position:absolute;bottom:.42in;left:0;right:0;text-align:center;font:italic 400 10.5pt Serif}

/* folha de rosto e créditos */
.titlepage{page:bare;break-before:page;text-align:center;padding-top:2.3in}
.titlepage .t{font:400 34pt/1 Serif;margin:0 0 .25em;text-align:center;letter-spacing:-.01em}
.titlepage .s{font:italic 400 12pt Serif;color:#6E6253;text-align:center;margin:0 0 3.2in}
.titlepage .a{font:500 9pt Sans;letter-spacing:.2em;text-align:center}
.copy{page:bare;break-before:page;padding-top:5.3in;font:400 7.6pt/1.5 Sans;color:#6E6253}.copy p{text-align:left;margin-bottom:.8em}

/* sumário */
.toc{page:bare;break-before:page;bookmark-level:1;bookmark-label:"Sumário"}
.toc h1{font-size:22pt;margin-bottom:.9em}
.toc ul{list-style:none;margin:0;padding:0}
.toc li{font-size:9.8pt;line-height:1.3;margin:.12em 0}
.toc li a::after{content:leader(" ") target-counter(attr(href),page);font:400 8pt Sans}
.toc li.tp{margin:1.05em 0 .35em;border-top:.6pt solid #1E1913;padding-top:.07in;break-after:avoid}
.toc li.tp a{font:400 10pt Disp}
.toc li.tp .n{font:400 10pt Disp;color:#BF8A5A;margin-right:.6em}
.toc li.sub{padding-left:1.1em;font-size:9.2pt}
.toc li.front a,.toc li.back a{font-style:italic}

/* páginas de parte */
.partimg{page:kraft;break-before:page;width:6in;height:9in;position:relative}
.partimg img{position:absolute;left:.55in;top:.55in;width:4.9in;height:7.4in;object-fit:contain}
.partimg .pcap{position:absolute;left:.55in;right:.55in;bottom:.45in;font:400 7pt/1.4 Sans;color:#4A4034;text-align:center}
.partimg .pcap i{color:#1E1913}
.part{page:part;break-before:page;position:relative;width:6in;height:9in;color:#1E1913}
.part .plab{position:absolute;left:.55in;top:1.72in;font:500 7.4pt Sans;margin:0}
.part .prule{position:absolute;left:.55in;right:.55in;top:1.95in;border-top:.6pt solid #1E1913}
.part .pnum{position:absolute;left:.5in;top:2.1in;font:400 118pt/1 Disp;margin:0}
.part h1{position:absolute;left:.55in;top:3.85in;width:4.4in;font-size:23pt;margin:0}
.part .pintro{position:absolute;left:.55in;top:4.85in;width:3.9in;font-size:9.6pt;line-height:1.42}
.part .pintro p{text-align:left;margin:0 0 .55em}

/* capítulos */
section.chap{page:chap;break-before:page}
.chhead{position:relative;height:2.95in;margin-bottom:.15in}
.chhead .chlab{position:absolute;left:0;top:.05in;font:500 7.4pt/1.4 Sans;margin:0}
.chhead .chnum{position:absolute;right:-.08in;top:-.2in;font:400 132pt/1 Disp;color:#BF8A5A;margin:0}
.chhead h1{position:absolute;left:0;bottom:0;width:3.7in;margin:0;font-size:23pt}
.chhead.nonum{height:1.9in}
section.front{page:chap;break-before:page}
section.front h1{font:400 30pt/1.1 Serif;text-align:center;margin:.25in 0 .9em;letter-spacing:-.01em}
section.front .ini{font:400 38pt/.8 Serif;float:left;margin:.04in .07in 0 0}

/* níveis */
section.level{page:chap;break-before:page}
.lvhead{height:3.2in;position:relative}
.lvhead .chlab{position:absolute;left:0;top:.05in;font:500 7.4pt Sans;margin:0}
.lvhead .chnum{position:absolute;right:-.06in;top:-.2in;font:400 120pt/1 Disp;color:#BF8A5A;margin:0}
.lvhead h1{position:absolute;left:0;bottom:0;margin:0;font-size:23pt}
.lvlist{columns:2;column-gap:.22in;margin-top:.9em;border-top:.6pt solid #1E1913;padding-top:.1in}
.lvlist p{font-size:8.8pt;line-height:1.3;text-align:left;margin:0 0 .3em;break-inside:avoid}
.lvlist b{font:700 7.4pt Sans;display:inline-block;width:.36in}

/* exercícios */
.ex{break-before:page;break-inside:avoid}
.ex.half{break-before:auto;height:3.5in;margin-top:0;overflow:hidden}
.pair2{break-before:page}
.pair2 .ex.half + .ex.half{border-top:.6pt solid #CFC4B0;padding-top:.14in;margin-top:.14in}
.exh{position:relative;height:.62in}
.exh .code{position:absolute;left:0;top:0;font:400 30pt/1 Disp}
.exh .lv{position:absolute;left:1.25in;top:.07in;font:500 7.2pt/1.4 Sans;color:#1E1913}
.half .exh{height:.5in}.half .exh .code{font-size:23pt}.half .exh .lv{left:.95in;top:.02in}
.ex h3{font:400 13pt/1.12 Disp;margin:0 0 .12in}
.half h3{font-size:11pt;margin-bottom:.08in}
.meta{display:flex;border-top:.6pt solid #1E1913;border-bottom:.6pt solid #1E1913;margin-bottom:.14in;font:400 7.2pt/1.35 Sans}
.meta div{flex:1;padding:.05in 0}
.meta div+div{border-left:.6pt solid #1E1913;padding-left:.08in}
.meta b{display:block;font-weight:700;font-size:7.6pt;margin-top:.02in}
.exart{height:4.3in;position:relative;margin-bottom:.14in}
.exart .model{position:absolute;left:0;top:0;width:3.3in;height:4.3in;object-fit:cover}
.exart .steps{position:absolute;left:3.42in;right:0;top:0}
.exart .steps figure{margin:0 0 .09in;text-align:left}
.exart .steps img{width:100%;height:1.17in;object-fit:cover;display:block}
.exart .steps figcaption{margin-top:.03in;font-size:6.6pt;color:#1E1913}
.exsolo{text-align:center;margin-bottom:.14in}
.exsolo img{max-width:100%;max-height:4.7in}
.half .exsolo img{max-height:1.75in}
.half .exsolo{float:left;width:2.35in;margin:0 .18in .05in 0;text-align:left}.half .exsolo img{max-width:2.35in}
.exfoot{display:flex;gap:.18in}
.exfoot .desc{flex:1}
.exfoot .desc p{font-size:9.6pt;line-height:1.4;margin:0 0 .4em}
.exfoot .done{width:1.5in;border-left:1.3pt solid #BF8A5A;padding-left:.08in;font:400 7.4pt/1.4 Sans}
.exfoot .done b{font-weight:700}
.half .exfoot{display:block}.half .exfoot .done{width:auto;margin-top:.06in}
.exref{font:400 7.2pt/1.4 Sans;color:#6E6253;margin-top:.12in;text-align:left}
.exref a{border-bottom:.5pt solid #BF8A5A;color:#1E1913}

/* catálogo */
.iconimg{page:kraft;break-before:page;width:6in;height:9in;position:relative}
.iconimg img{position:absolute;left:.45in;top:.45in;width:5.1in;height:8.1in;object-fit:contain}
.iconinfo{page:bare;break-before:page;position:relative;height:7.5in}
.iconinfo .ptop{display:flex;justify-content:space-between;border-bottom:.6pt solid #1E1913;padding-bottom:.06in;font:500 7.2pt Sans;margin-bottom:.9in}
.iconinfo .no{font:400 36pt/1 Disp;margin:0 0 .1in}
.iconinfo h2{font:italic 400 17pt/1.2 Serif;margin:0 0 .18in}
.iconinfo .cc{font:400 7.8pt/1.45 Sans;color:#6E6253;text-align:left}
.iconinfo .cl{font-size:10.6pt;line-height:1.45;margin:.2in 0}
.ficha{width:100%;font:400 7.4pt Sans;margin-top:.15in}
.iconinfo .balrow{margin-top:.35in;justify-content:flex-start;gap:.18in}
.iconinfo .bal{width:1.5in}
.ficha td{border-top:.6pt solid #A39682;border-bottom:none;padding:.05in 0}
.ficha td:first-child{width:.95in;color:#6E6253}
.catlist{}
.cat{display:flex;gap:.16in;margin:0 0 .12in;break-inside:avoid;align-items:flex-start;border-top:.6pt solid #CFC4B0;padding-top:.1in}
.cat .im{width:1.15in;flex:none;text-align:left}
.cat img{max-width:1.15in;max-height:1.25in}
.cat p{text-align:left;margin:0 0 .18em}
.cat .ct{font:400 10.4pt/1.25 Serif}
.cat .cn{font:400 9pt Disp;margin-right:.35em}
.cat .cc{font:400 7.2pt/1.42 Sans;color:#6E6253}
.cat .cf{font:400 6.8pt/1.4 Sans;color:#6E6253}
.cat .cl{font-size:8.8pt;line-height:1.34}

/* índice */
.idx{columns:2;column-gap:.25in}
.idx p{font-size:8.6pt;line-height:1.28;margin:0 0 .16em;text-align:left;break-inside:avoid}
.idx b{font:700 7.2pt Sans;display:inline-block;width:.33in}
.idx span{font:400 6.6pt Sans;color:#6E6253}
.idx h4{column-span:none;margin:.8em 0 .3em}
"""

def chapter_head(s, part):
    h = s['html']
    m = re.match(r'\s*<h1>(.*?)</h1>', h, re.S)
    title = m.group(1) if m else esc(s['title'])
    body = h[m.end():] if m else h
    n = re.match(r'(\d+)\.\s*(.*)', title)
    plab = f'{part[1]} · {part[2]}' if part else 'Consulta'
    short = re.sub(r':.*', '', n.group(2) if n else title)
    rh = f'<span class="rh">{short}</span>'
    if n:
        head = f'<div class="chhead"><p class="chlab">{plab}<br/>Capítulo {n.group(1)}</p><p class="chnum">{n.group(1)}</p><h1>{n.group(2)}</h1></div>'
    else:
        head = f'<div class="chhead nonum"><p class="chlab">{plab}</p><h1>{title}</h1></div>'
    return rh + head, body, (n.group(2) if n else title)

def ex_pdf(x, chapnames, half=False):
    cid, cname = CHAP[x['ch']]
    lvn = {l[0]: (l[2], l[3]) for l in LEVELS}
    tempo, _, mat = x['m'].partition(' · ')
    ln, lname = lvn[x['lv']]
    head = (f'<div class="exh"><span class="code">{x["id"].upper()}</span>'
            f'<span class="lv">{ln} · {lname}<br/>{cname} · {esc(chapnames.get(cid, ""))}</span></div>'
            f'<h3>{esc(x["t"])}</h3>')
    meta = (f'<div class="meta"><div>Tempo<b>{esc(tempo)}</b></div><div>Material<b>{esc(mat)}</b></div>'
            f'<div>Teoria<b><a href="#{cid}">{cname}</a></b></div></div>')
    if x['id'] in STAGES and not half:
        st = ''.join(f'<figure><img src="img/st-{x["id"]}-{k}.jpg" alt=""/><figcaption>{k} · {STN[k-1]}</figcaption></figure>' for k in (1, 2, 3))
        art = f'<div class="exart"><img class="model" src="img/{x["id"]}.jpg" alt=""/><div class="steps">{st}</div></div>'
    else:
        art = f'<div class="exsolo"><img src="img/{x["id"]}.jpg" alt=""/></div>'
    ref = ''
    if x.get('ref') and x['ref'] in PL:
        ref = f'<p class="exref">Obra para comparar: <a href="#cat-{x["ref"]}"><i>{esc(PL[x["ref"]]["t"])}</i></a>, no catálogo.</p>'
    foot = (f'<div class="exfoot"><div class="desc"><p>{esc(x["d"])}</p></div>'
            f'<div class="done"><b>Pronto quando</b> {esc(x["c"])}</div></div>')
    return f'<section class="ex{" half" if half else ""}" id="ex-{x["id"]}">{head}{meta}{art}{foot}{ref}</section>'

def level_pdf(code, lid, ln, name, intro, chapnames):
    items = [x for x in EX if x['lv'] == code]
    lst = ''.join(f'<p><b><a href="#ex-{x["id"]}">{x["id"].upper()}</a></b>{esc(x["t"])}</p>' for x in items)
    out = [f'<section class="level" id="{lid}"><span class="rh">Exercícios · {ln}</span>'
           f'<div class="lvhead"><p class="chlab">Parte III · Exercícios</p><p class="lvtag">{ln}</p><h1>{name}</h1></div>'
           f'<p class="lead">{intro}</p><div class="lvlist">{lst}</div></section>']
    if code == 'w':
        for i in range(0, len(items), 2):
            out.append('<div class="pair2">' + ''.join(ex_pdf(x, chapnames, half=True) for x in items[i:i + 2]) + '</div>')
    else:
        out += [ex_pdf(x, chapnames) for x in items]
    return ''.join(out)

def cat_numbers():
    order = CAT_ORDER + [k for k in PL if k not in CAT_ORDER]
    return {k: i for i, k in enumerate(order, 1)}, order

def ficha(k):
    p = PL[k]; f = FI.get(k, {})
    inst = f.get('inst', '')
    if inst and inst.split(' (')[0].split(',')[0][:12] in p['c']:
        inst = ''
    return f, inst

def catalogue_pdf():
    num, order = cat_numbers()
    cards = []
    for k in order:
        p = PL[k]; f, inst = ficha(k)
        fi = ' · '.join(v for v in [f.get('cat'), f.get('dim'), inst] if v)
        cards.append(f'<div class="cat" id="cat-{k}"><div class="im"><img src="img/{k}.jpg" alt="{esc(p["t"])}"/></div><div>'
                     f'<p class="ct"><span class="cn">{num[k]}</span><i>{esc(p["t"])}</i></p><p class="cc">{esc(p["c"])}</p>'
                     + (f'<p class="cf">{esc(fi)}</p>' if fi else '') + f'<p class="cl">{esc(p.get("l", ""))}</p></div></div>')
    return ('<section class="chap" id="catalogo"><span class="rh">Catálogo das obras</span>'
            '<div class="chhead nonum"><p class="chlab">Consulta</p><h1>Catálogo das obras</h1></div>'
            '<p>As obras de Van Gogh citadas no livro e indicadas nos exercícios, em ordem aproximada de data. Quando disponíveis, '
            'seguem os números de catálogo F (de la Faille) e JH (Hulsker), as dimensões (altura por largura) e o acervo.</p>'
            + ''.join(cards) + '</section>')

def ex_index_pdf():
    lvn = {l[0]: l[2] for l in LEVELS}
    groups = [('r', 'Ranhuras'), ('f', 'Fluxo'), ('c', 'Rostos'), ('a', 'Autorretratos'), ('b', 'Corpo'), ('p', 'Projeto')]
    body = ''
    for ch, nm in groups:
        body += f'<h4>{nm}</h4>' + ''.join(f'<p><b><a href="#ex-{x["id"]}">{x["id"].upper()}</a></b>{esc(x["t"])} <span>{lvn[x["lv"]]}</span></p>'
                                         for x in sorted(EX, key=lambda x: x['id']) if x['ch'] == ch)
    return ('<section class="chap" id="indice"><span class="rh">Índice dos exercícios</span>'
            '<div class="chhead nonum"><p class="chlab">Consulta</p><h1>Índice dos exercícios</h1></div>'
            f'<div class="idx">{body}</div></section>')

def pdf_html(S):
    chapnames = {}
    for s in S:
        m = re.match(r'\s*<h1>\d+\.\s*(.*?)</h1>', s.get('html', ''))
        if m:
            chapnames[s['id']] = re.sub(r':.*', '', m.group(1))
    yr = datetime.date.today().year
    P = [f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Van Gogh a Lápis</title>'
         f'<meta name="author" content="Pedro Torres"><style>{font_faces()}{PDF_CSS}</style></head><body>']
    P.append('<div class="cover"><div class="art"></div><div class="topsh"></div><div class="shade"></div>'
             '<div class="ed">PEDRO TORRES</div><div class="t">Van Gogh a Lápis</div><div class="d">Teoria e prática para desenhar como Vincent</div>'
             '<div class="coll">91 exercícios em quatro níveis</div></div>')
    P.append('<div class="titlepage"><p class="t">Van Gogh a Lápis</p><p class="s">Teoria e prática para desenhar como Vincent</p><p class="a">PEDRO TORRES</p></div>')
    P.append(f'<div class="copy"><p>© {yr} Pedro Torres. Todos os direitos reservados.</p>'
             '<p>Nenhuma parte deste livro pode ser reproduzida sem autorização do autor, exceto as folhas de exercício destinadas ao uso pessoal do leitor.</p>'
             '<p>Capa: <i>Retrato de Joseph Roulin</i>, Arles, agosto de 1888. Pena de junco e pena de ave, tinta e giz preto. J. Paul Getty Museum, Los Angeles (85.GA.299), Open Content Program.</p>'
             f'<p>Texto composto em EB Garamond e Archivo. Primeira edição, {yr}.</p></div>')
    # sumário
    toc = ['<div class="toc"><h1>Sumário</h1><ul>']
    cur_part = None
    for s in S:
        if s['kind'] == 'part':
            cur_part = s['id']
            n, lab, name, _ = PARTS[s['id']]
            toc.append(f'<li class="tp"><span class="n">{n}</span><a href="#{s["id"]}">{name}</a></li>')
        elif s['kind'] == 'level':
            toc.append(f'<li class="sub"><a href="#{s["id"]}">{esc(s["title"])}</a></li>')
        elif s['kind'] in ('front', 'back'):
            toc.append(f'<li class="{s["kind"]}"><a href="#{s["id"]}">{esc(s["title"])}</a></li>')
        elif s['kind'] == 'chapter' and s['title'] == PARTS.get(cur_part, ('', '', ''))[2]:
            continue
        else:
            toc.append(f'<li><a href="#{s["id"]}">{esc(s["title"])}</a></li>')
    toc.append('</ul></div>')
    P.extend(toc)
    part = None
    vida_intro = ''
    for s in S:
        if s['id'] == 'vida':
            m = re.match(r'\s*<h1>.*?</h1>(.*?)<!--MAPA-->', s['html'], re.S)
            vida_intro = m.group(1).strip()
    for s in S:
        k = s['kind']
        if k == 'part':
            part = PARTS[s['id']]
            n, lab, name, intro = part
            if intro is None:
                intro = vida_intro
            art = PART_ART[s['id']]
            P.append(f'<section class="partimg"><img src="img/{art}.jpg" alt="{esc(PL[art]["t"])}"/>'
                     f'<p class="pcap"><i>{esc(PL[art]["t"])}</i>. {esc(PL[art]["c"])}</p></section>')
            P.append(f'<section class="part" id="{s["id"]}" style="bookmark-level:1;bookmark-label:\'{lab} · {name}\'">'
                     f'<p class="plab">{lab}</p><div class="prule"></div><p class="pnum">{n}</p><h1>{name}</h1><div class="pintro">{intro if intro.startswith('<p>') else '<p>' + intro + '</p>'}</div></section>')
        elif k == 'front':
            h = s['html']
            m = re.match(r'\s*<h1>(.*?)</h1>', h, re.S)
            body = h[m.end():]
            if s['id'] == 'prefacio':
                body = re.sub(r'<p>(\w)', r'<p><span class="ini">\1</span>', body, count=1)
            P.append(f'<section class="front" id="{s["id"]}" style="bookmark-level:1;bookmark-label:\'{s["title"]}\'"><span class="rh">{s["title"]}</span><h1>{m.group(1)}</h1>{body}</section>')
        elif k == 'level':
            code, lid, ln, name, intro = next(l for l in LEVELS if l[1] == s['id'])
            P.append(level_pdf(code, lid, ln, name, intro, chapnames).replace(
                f'<section class="level" id="{lid}">', f'<section class="level" id="{lid}" style="bookmark-level:2;bookmark-label:\'{ln} · {name}\'">', 1))
        elif s['id'] == 'catalogo':
            P.append(catalogue_pdf().replace('<section class="chap" id="catalogo">', '<section class="chap" id="catalogo" style="bookmark-level:1;bookmark-label:\'Catálogo das obras\'">', 1))
        elif s['id'] == 'indice':
            P.append(ex_index_pdf().replace('<section class="chap" id="indice">', '<section class="chap" id="indice" style="bookmark-level:1;bookmark-label:\'Índice dos exercícios\'">', 1))
        elif s['id'] == 'vida':
            body = s['html'][s['html'].index('<!--MAPA-->'):]
            body = body.replace('<!--MAPA-->', '<!--MAPA--><span class="rh">Dez anos de desenho</span>', 1)
            P.append(f'<section id="vida">{body}</section>')
        else:
            head, body, t = chapter_head(s, part if k == 'chapter' else None)
            lvl = 2 if k == 'chapter' else 1
            lab = s['title'].replace("'", "’")
            P.append(f'<section class="chap" id="{s["id"]}" style="bookmark-level:{lvl};bookmark-label:\'{lab}\'">{head}{body}</section>')
    P.append('<section class="fim"><img src="img/harvest.jpg" alt="A colheita, desenho a pena de Van Gogh"/>'
             '<p class="fq">“O que é desenhar? Como se chega lá? É abrir caminho através de uma parede de ferro invisível, '
             'que parece estar entre o que se sente e o que se consegue fazer.”</p>'
             '<p class="fs">Vincent van Gogh a Theo, Haia, outubro de 1882 (carta 274)</p></section>')
    P.append('<section class="contra"><p class="ct1">Van Gogh a Lápis</p><p class="ct2">Teoria e prática para desenhar como Vincent</p>'
             '<p class="ct3">PEDRO TORRES</p></section>')
    P.append('</body></html>')
    html_ = '\n'.join(P).replace('<!--MAPA-->', map_html(True))
    # cada capítulo ganha um nome de página próprio, para a primeira página sair sem rodapé
    n = [0]
    def pg(m):
        n[0] += 1
        return f'{m.group(1)} style="page:pg{n[0]};'
    html_ = re.sub(r'(<section class="(?:chap|front|level)" id="[^"]+") style="', pg, html_)
    extra = ''.join(f'@page :nth(1 of pg{i}){{@bottom-left{{content:none}}@bottom-right{{content:none}}}}' for i in range(1, n[0] + 1))
    return html_.replace('</style>', extra + '</style>', 1)

# ---------------------------------------------------------------- EPUB
EPUB_FONTS = [('Serif', 'eb-garamond-latin-400-normal.ttf', 400, 'normal'), ('Serif', 'eb-garamond-latin-400-italic.ttf', 400, 'italic'),
              ('Serif', 'eb-garamond-latin-600-normal.ttf', 600, 'normal'), ('Disp', 'archivo-black-latin-400-normal.woff', 400, 'normal'),
              ('Sans', 'archivo-latin-400-normal.woff', 400, 'normal'), ('Sans', 'archivo-latin-700-normal.woff', 700, 'normal')]
EPUB_CSS = """
body{font-family:Serif,serif;line-height:1.5;margin:0 4%;color:#1E1913}
h1{font-family:Disp,sans-serif;font-weight:400;font-size:1.65em;line-height:1.12;margin:1.4em 0 .9em;page-break-before:always}
h1 .lvnum{display:block;font-family:Sans,sans-serif;font-weight:700;font-size:.45em;color:#8C5A2E;margin-bottom:.4em}
h2{font-family:Disp,sans-serif;font-weight:400;font-size:1.15em;line-height:1.2;margin:1.6em 0 .5em}
h3{font-family:Sans,sans-serif;font-weight:700;font-size:1.05em;margin:.3em 0 .4em}
h4{font-family:Sans,sans-serif;font-weight:700;font-size:.78em;margin:0 0 .4em}
p{margin:0 0 .6em;text-indent:0}
a{color:#1E1913}
figure{margin:1.2em 0;text-align:center;page-break-inside:avoid}
img{max-width:100%;height:auto}
figcaption{font-family:Sans,sans-serif;font-size:.72em;line-height:1.45;color:#5F5446;text-align:left;margin-top:.4em}
.vida{background:#EFE8DB;padding:.7em .9em .5em;margin:0 0 1.3em;font-size:.92em}
.marks figure,.pair figure{margin:.8em 0}
.steps4 figure{display:inline-block;width:47%;margin:.3em 1%;vertical-align:top}
.practice{border-top:1px solid #1E1913;margin-top:1.6em;padding-top:.6em;font-size:.9em}
.practice ul{list-style:none;padding:0}.practice a{font-family:Sans,sans-serif;font-weight:700;font-size:.85em;margin-right:.3em}
.practice .lvl{font-family:Sans,sans-serif;color:#6E6253;font-size:.75em}
.exnum{font-family:Disp,sans-serif;font-size:1.9em;line-height:1;margin:1.2em 0 .1em}
section.ex{page-break-before:always}
.ex h3{font-family:Disp,sans-serif;font-weight:400;font-size:1.2em}
.exmeta{font-family:Sans,sans-serif;font-size:.78em;color:#5F5446;border-top:1px solid #1E1913;border-bottom:1px solid #1E1913;padding:.35em 0}
.exref{font-family:Sans,sans-serif;font-size:.78em;color:#5F5446}
.crit{border-left:3px solid #BF8A5A;padding-left:.6em}.crit .sc{font-family:Sans,sans-serif;font-weight:700;font-size:.85em}
.lead{font-style:italic}.count{font-family:Sans,sans-serif;font-size:.75em;color:#6E6253}
table{border-collapse:collapse;width:100%;font-size:.88em}th,td{border-bottom:1px solid #CFC4B0;padding:.3em .4em;text-align:left;vertical-align:top}
th{font-family:Sans,sans-serif;font-size:.8em;border-bottom:1px solid #1E1913}
dl.gloss dt{font-family:Sans,sans-serif;font-weight:700;font-size:.9em;margin-top:.7em}dl.gloss dd{margin-left:0}
.sign{text-align:right;font-style:italic}
.cat{margin:0 0 1.4em;page-break-inside:avoid;clear:both;overflow:hidden;border-top:1px solid #CFC4B0;padding-top:.6em}.cat img{max-width:38%;float:left;margin:0 .8em .4em 0}.cat div{overflow:hidden}
.cat p{margin:0 0 .2em}.cc,.cf{font-family:Sans,sans-serif;font-size:.75em;color:#5F5446}.cn{font-family:Disp,sans-serif;margin-right:.35em}
.parttitle{margin-top:1.2em}.parttitle .pn{font-family:Disp,sans-serif;font-size:3.6em;line-height:1;color:#BF8A5A;margin:0}
.parttitle h1{page-break-before:avoid;font-family:Sans,sans-serif;font-weight:700;font-size:.8em;margin:.6em 0 .2em}
.parttitle h2{font-size:1.7em;margin:0 0 .6em}
h2.ic img.icon{width:1.6em;height:1.6em;vertical-align:middle;margin-right:.4em}
.balrow{text-align:center;margin:-.4em 0 1.2em}
.bal{display:inline-block;width:30%;margin:.4em 1.2% .8em;vertical-align:top;text-align:left}
.bal img{width:100%;border-radius:50%}
.bal figcaption b{display:block;font-weight:700}
.mapa{margin:0 0 1.2em;text-align:center}
.end{border-top:1px solid #CFC4B0;padding:.4em 0;overflow:hidden}.end .en{float:left;font-family:Sans,sans-serif;font-weight:700;width:1.6em}
.end p{margin:0 0 0 1.6em}.end .ey{font-family:Sans,sans-serif;font-size:.8em;color:#5F5446}
.tr{border-top:1px solid #CFC4B0;padding:.6em 0;page-break-inside:avoid}.tr img{width:100%}
.trt .ty{font-family:Disp,sans-serif;font-size:1.3em;margin:.3em 0 0}.trt .tp{font-family:Sans,sans-serif;font-size:.85em;font-weight:700;margin:0}
.tracos .sub,.enderecos .sub{font-style:italic}
ol.laws{list-style:none;padding:0}ol.laws li{border-top:1px solid #CFC4B0;padding:.5em 0}ol.laws li b{display:block;font-family:Sans,sans-serif}
figure.diag img{width:100%}
.titlepage{text-align:center;margin-top:25%}.titlepage .t{font-size:2.1em;line-height:1.1}.titlepage .s{font-style:italic;color:#5F5446}
.titlepage .a{font-family:Sans,sans-serif;font-size:.8em;letter-spacing:.2em;margin-top:3em}
"""

def xhtml(fragment):
    root = lhtml.fragment_fromstring(fragment, create_parent='div')
    s = ''.join(etree.tostring(c, method='xml', encoding='unicode') for c in root)
    if root.text and root.text.strip():
        s = esc(root.text) + s
    return s

def page(title, body):
    return ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR" xml:lang="pt-BR">'
            f'<head><meta charset="utf-8"/><title>{esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>{body}</body></html>')

def build_epub(S, out, small=None):
    files = []  # (name, title, body, kind)
    files.append(('titulo.xhtml', 'Folha de rosto', '<div class="titlepage"><p class="t">Van Gogh a Lápis</p><p class="s">Teoria e prática para desenhar como Vincent</p><p class="a">PEDRO TORRES</p></div>'
                  f'<p style="margin-top:3em;font-size:.8em;color:#666">© {datetime.date.today().year} Pedro Torres. Todos os direitos reservados.</p>', 'front'))
    idfile = {}
    for i, s in enumerate(S):
        name = f'{i:02d}-{s["id"]}.xhtml'
        if s['kind'] == 'part':
            img = f'img/{PART_ART[s["id"]]}.jpg'
            n_, lab_, name_, intro_ = PARTS[s['id']]
            it = '' if intro_ is None else (intro_ if intro_.startswith('<p>') else f'<p>{intro_}</p>')
            body = (f'<section id="{s["id"]}"><figure><img src="{img}" alt=""/></figure><div class="parttitle"><p class="pn">{n_}</p>'
                    f'<h1>{lab_}</h1><h2>{name_}</h2>{it}</div></section>')
        else:
            body = f'<section id="{s["id"]}">{s["html"].replace("<!--MAPA-->", map_html(False))}</section>'
        files.append((name, s['title'], body, s['kind']))
        for m in re.finditer(r'id="([^"]+)"', body):
            idfile[m.group(1)] = name
    def fixlinks(body):
        return re.sub(r'href="#([^"]+)"', lambda m: f'href="{idfile.get(m.group(1), "")}#{m.group(1)}"', body)
    imgs = set()
    fonts_added = []
    bid = 'urn:uuid:' + str(uuid.uuid5(uuid.NAMESPACE_URL, 'van-gogh-a-lapis-pedro-torres'))
    with zipfile.ZipFile(out, 'w') as z:
        z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', compress_type=zipfile.ZIP_DEFLATED)
        fcss = ''
        from fontTools.ttLib import TTFont
        import io
        for fam, f, w, st in EPUB_FONTS:
            ft = TTFont(os.path.join(FONTDIR, f)); ft.flavor = None
            buf = io.BytesIO(); ft.save(buf)
            name = re.sub(r'\.woff$', '.ttf', f)
            z.writestr('OEBPS/fonts/' + name, buf.getvalue(), compress_type=zipfile.ZIP_DEFLATED)
            fonts_added.append(name)
            fcss += f'@font-face{{font-family:"{fam}";src:url("fonts/{name}");font-weight:{w};font-style:{st}}}\n'
        z.writestr('OEBPS/style.css', fcss + EPUB_CSS, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/cover.xhtml', page('Capa', '<figure style="margin:0;text-align:center"><img src="img/cover.jpg" alt="Capa" style="max-height:100%"/></figure>'), compress_type=zipfile.ZIP_DEFLATED)
        for name, title, body, kind in files:
            x = xhtml(fixlinks(body))
            imgs.update(re.findall(r'src="(img/[^"]+)"', x))
            z.writestr('OEBPS/' + name, page(title, x), compress_type=zipfile.ZIP_DEFLATED)
        imgs.add('img/cover.jpg')
        for im in sorted(imgs):
            if im.endswith('.svg'):
                z.write(im, 'OEBPS/' + im, compress_type=zipfile.ZIP_DEFLATED)
            elif small:
                from PIL import Image
                import io
                pic = Image.open(im).convert('RGB')
                if im != 'img/cover.jpg':
                    pic.thumbnail((small, small))
                buf = io.BytesIO(); pic.save(buf, 'JPEG', quality=68, optimize=True, progressive=True)
                z.writestr('OEBPS/' + im, buf.getvalue(), compress_type=zipfile.ZIP_STORED)
            else:
                z.write(im, 'OEBPS/' + im, compress_type=zipfile.ZIP_STORED)
        nav = ['<nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>']
        for name, title, body, kind in files[1:]:
            nav.append(f'<li><a href="{name}">{esc(title)}</a></li>')
        nav.append('</ol></nav><nav epub:type="landmarks" hidden=""><ol><li><a epub:type="cover" href="cover.xhtml">Capa</a></li>'
                   f'<li><a epub:type="toc" href="nav.xhtml">Sumário</a></li><li><a epub:type="bodymatter" href="{files[1][0]}">Início</a></li></ol></nav>')
        z.writestr('OEBPS/nav.xhtml', page('Sumário', ''.join(nav)), compress_type=zipfile.ZIP_DEFLATED)
        man = ['<item id="css" href="style.css" media-type="text/css"/>', '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
               '<item id="coverpage" href="cover.xhtml" media-type="application/xhtml+xml"/>']
        spine = ['<itemref idref="coverpage" linear="yes"/>', '<itemref idref="nav"/>']
        for i, (name, title, body, kind) in enumerate(files):
            man.append(f'<item id="p{i}" href="{name}" media-type="application/xhtml+xml"/>')
            spine.insert(-1 if i == 0 else len(spine), f'<itemref idref="p{i}"/>')
        for k, f in enumerate(fonts_added):
            man.append(f'<item id="f{k}" href="fonts/{f}" media-type="font/ttf"/>')
        for k, im in enumerate(sorted(imgs)):
            props = ' properties="cover-image"' if im == 'img/cover.jpg' else ''
            mt = 'image/svg+xml' if im.endswith('.svg') else 'image/jpeg'
            man.append(f'<item id="i{k}" href="{im}" media-type="{mt}"{props}/>')
        now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        opf = ('<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid" xml:lang="pt-BR">'
               '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
               f'<dc:identifier id="bid">{bid}</dc:identifier><dc:title>Van Gogh a Lápis</dc:title><dc:creator>Pedro Torres</dc:creator>'
               '<dc:language>pt-BR</dc:language><dc:subject>Desenho</dc:subject>'
               '<dc:description>Um curso de desenho na linguagem de Vincent van Gogh: ranhuras, fluxo, rostos e autorretratos, com 91 exercícios em quatro níveis.</dc:description>'
               f'<meta property="dcterms:modified">{now}</meta><meta name="cover" content="i{sorted(imgs).index("img/cover.jpg")}"/></metadata>'
               f'<manifest>{"".join(man)}</manifest><spine>{"".join(spine)}</spine></package>')
        z.writestr('OEBPS/content.opf', opf, compress_type=zipfile.ZIP_DEFLATED)

COVER_EBOOK = """<!doctype html><html><head><meta charset="utf-8"><style>{fonts}
@page{{size:6in 9.6in;margin:0}}*{{margin:0;padding:0}}
.c{{position:relative;width:6in;height:9.6in;background:#2A2119;color:#FBF8F1;overflow:hidden}}
.art{{position:absolute;inset:0;background:url("img/cover-roulin.jpg") 46% 0/126% auto no-repeat}}
.topsh{{position:absolute;left:0;right:0;top:0;height:1.2in;background:linear-gradient(to bottom,rgba(20,15,10,.35),rgba(20,15,10,0))}}
.shade{{position:absolute;left:0;right:0;bottom:0;height:5.4in;background:linear-gradient(to bottom,rgba(20,15,10,0),rgba(20,15,10,.55) 45%,rgba(20,15,10,.7))}}
.ed{{position:absolute;top:.42in;left:0;right:0;text-align:center;font:500 11.5pt Sans;letter-spacing:.2em}}
.t{{position:absolute;left:0;right:0;top:6.05in;text-align:center;font:400 51pt/1 Serif;letter-spacing:-.012em;white-space:nowrap}}
.d{{position:absolute;left:0;right:0;top:6.9in;text-align:center;font:italic 400 16pt Serif}}
.coll{{position:absolute;bottom:.5in;left:0;right:0;text-align:center;font:italic 400 11.5pt Serif}}
</style></head><body><div class="c"><div class="art"></div><div class="topsh"></div><div class="shade"></div>
<div class="ed">PEDRO TORRES</div><div class="t">Van Gogh a Lápis</div><div class="d">Teoria e prática para desenhar como Vincent</div>
<div class="coll">91 exercícios em quatro níveis</div></div></body></html>"""

def make_cover():
    """Capa do e-book em 1600 × 2560 px (proporção pedida pela Amazon)."""
    import subprocess, tempfile
    from weasyprint import HTML
    from PIL import Image
    with tempfile.TemporaryDirectory() as td:
        HTML(string=COVER_EBOOK.format(fonts=font_faces()), base_url=ROOT).write_pdf(f'{td}/c.pdf')
        subprocess.run(['pdftoppm', '-r', '266.67', '-png', '-singlefile', f'{td}/c.pdf', f'{td}/c'], check=True)
        im = Image.open(f'{td}/c.png').convert('RGB').resize((1600, 2560), Image.LANCZOS)
    im.save('img/cover.jpg', quality=92)
    im.save('out/capa-ebook-1600x2560.jpg', quality=92)

if __name__ == '__main__':
    import sys
    S = build_sections()
    S += [catalogue(), CREDITS]
    os.makedirs('out', exist_ok=True)
    args = sys.argv[1:] or ['cover', 'pdf']  # EPUB só com: python3 build.py epub
    make_details(); make_tracos()
    if 'cover' in args:
        make_cover(); print('capa ok')
    if 'pdf' in args:
        open('out/livro.html', 'w').write(pdf_html(S))
        from weasyprint import HTML
        doc = HTML('out/livro.html', base_url=ROOT).render()
        print('páginas', len(doc.pages))
        doc.write_pdf('out/Van-Gogh-a-Lapis.pdf')
    if 'epub' in args:
        build_epub(S, 'out/Van-Gogh-a-Lapis.epub')
        build_epub(S, 'out/Van-Gogh-a-Lapis-loja-Amazon.epub', small=800)
        print('epub ok')
