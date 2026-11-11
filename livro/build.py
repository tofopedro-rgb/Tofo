"""Monta o livro Van Gogh a Lápis em PDF (WeasyPrint) e EPUB 3 a partir de src/*.md e data.json."""
import os, re, json, glob, html, uuid, zipfile, datetime
import markdown
from lxml import etree, html as lhtml

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
FONTS = '/tmp/claude-0/-home-user-Tofo/70760256-9ae2-520c-b722-f901ba0ead4c/scratchpad/fonts/ttf'
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
        extra.append(f'Obra para comparar: <i>{esc(PL[x["ref"]]["t"])}</i>, no <a href="#catalogo">catálogo</a>.')
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

def build_sections():
    src = parse_src()
    S = []
    for s in src:
        h = md2html(s['md'])
        if s['kind'] == 'chapter':
            h += practice_list(s['id'])
        S.append({**s, 'html': h})
        if s['id'] == 'cap8':  # depois da Parte II vem a Parte III
            S.append({'id': 'parte3', 'title': 'Parte III · Exercícios', 'kind': 'part', 'opener': 'ex/part3.jpg',
                      'html': '<h1>Parte III</h1>\n<h2>Exercícios</h2>'})
            S.append({'id': 'exercicios', 'title': 'Como usar os exercícios', 'kind': 'chapter', 'html': md2html(
                "# Como usar os exercícios\n\nOs 91 exercícios estão em quatro níveis. Dentro de cada nível, aparecem na ordem dos capítulos: ranhuras (R), fluxo (F), rostos (C), autorretratos (A), corpo (B) e projeto (P). O código de cada exercício é o mesmo das folhas para imprimir e dos guias para Procreate.\n\n"
                "Cada página traz o desenho-modelo, o tempo e o material sugeridos, a instrução e um critério para saber quando o exercício está pronto. Doze exercícios mostram também as etapas da construção, do esboço ao acabamento.\n\n"
                "Para desenhar por cima, use as folhas para imprimir, que têm o mesmo modelo apagado em azul claro, ou desenhe ao lado do livro, olhando o modelo.")})
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
        rows.append(f'<div class="cat"><img src="img/{k}.jpg" alt="{esc(p["t"])}"/><div><p class="ct"><span class="cn">{i}</span> <i>{esc(p["t"])}</i></p>'
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

As reproduções de obras de Vincent van Gogh são de domínio público e foram obtidas no Wikimedia Commons. Os dados de catálogo vêm do Wikidata e do Wikimedia Commons. As citações das cartas são traduções livres do autor a partir da edição em inglês publicada pelo Van Gogh Museum e pelo Huygens Institute em vangoghletters.org.

Os desenhos-modelo dos exercícios, as demonstrações em etapas, as amostras de marcas, as ilustrações de abertura, a capa e as fotografias de materiais foram criados para este livro com o auxílio de ferramentas de inteligência artificial, a partir de orientações do autor. São interpretações no estilo dos desenhos de Van Gogh e não reproduzem obras dele.

Texto composto em EB Garamond e IBM Plex Mono.""")}

# ---------------------------------------------------------------- PDF
def font_faces():
    css = ''
    for w in (400, 500, 600, 700):
        for st in ('normal', 'italic'):
            for sub in ('latin', 'latin-ext'):
                p = f'{FONTS}/eb-garamond-{sub}-{w}-{st}.ttf'
                if os.path.exists(p):
                    css += f'@font-face{{font-family:"EBG";src:url("file://{p}");font-weight:{w};font-style:{st}}}\n'
    for w in (400, 500):
        for sub in ('latin', 'latin-ext'):
            p = f'{FONTS}/ibm-plex-mono-{sub}-{w}-normal.ttf'
            if os.path.exists(p):
                css += f'@font-face{{font-family:"Plex";src:url("file://{p}");font-weight:{w}}}\n'
    return css

PDF_CSS = """
@page{size:6in 9in;margin:0.72in 0.62in 0.78in 0.62in;
  @top-center{content:string(chap);font:italic 400 8.5pt EBG;color:#8a7a66}
  @bottom-center{content:counter(page);font:400 9pt EBG;color:#6b5d4d}}
@page :left{margin-left:0.6in;margin-right:0.72in}
@page :right{margin-left:0.72in;margin-right:0.6in}
@page bare{@top-center{content:none}@bottom-center{content:none}}
@page cover{margin:0;@top-center{content:none}@bottom-center{content:none}}
@page part{margin:0;@top-center{content:none}@bottom-center{content:none}}
@page :blank{@top-center{content:none}@bottom-center{content:none}}
@page front{@top-center{content:none}}
html{font-family:EBG,serif;font-size:10.6pt;line-height:1.45;color:#231c15;hyphens:auto}
body{margin:0}
p{margin:0 0 .55em;text-align:justify;orphans:2;widows:2}
a{color:inherit;text-decoration:none}
h1{font:500 22pt/1.1 EBG;margin:0 0 .9em;letter-spacing:-.01em;string-set:chap content()}
h1 .lvnum{display:block;font:500 8.5pt Plex;letter-spacing:.18em;text-transform:uppercase;color:#9a7b3c;margin-bottom:.5em}
h2{font:600 12.5pt/1.25 EBG;margin:1.3em 0 .45em;break-after:avoid}
h3{font:600 13pt/1.2 EBG;margin:0 0 .4em}
h4{font:500 7.5pt Plex;letter-spacing:.14em;text-transform:uppercase;color:#9a7b3c;margin:0 0 .45em}
figure{margin:.9em 0;break-inside:avoid;text-align:center}
figure img{max-width:100%;max-height:4.2in}
figure.wide img{max-height:3.6in}
figcaption{font-size:8.6pt;line-height:1.35;color:#5d5144;text-align:left;margin-top:.35em}
.cover{page:cover;height:9in;break-after:page}
.cover img{width:6in;height:9in;display:block}
.front{page:front}
.titlepage{page:bare;break-before:right;text-align:center;padding-top:2.2in}
.titlepage .t{font:500 30pt EBG;margin:0}.titlepage .s{font:italic 400 12.5pt EBG;color:#5d5144;margin:.6em 0 2.6em}
.titlepage .a{font:500 12pt EBG;letter-spacing:.06em}
.copy{page:bare;break-before:page;padding-top:5.4in;font-size:8.6pt;color:#5d5144}.copy p{text-align:left}
.toc{page:front;break-before:right}
.toc h1{string-set:chap ""}
.toc ul{list-style:none;margin:0;padding:0}
.toc li{margin:.18em 0;font-size:10.3pt}
.toc li.part{font:500 8pt Plex;letter-spacing:.12em;text-transform:uppercase;color:#9a7b3c;margin-top:1em}
.toc li.sub{padding-left:1.2em;font-size:9.8pt}
.toc a::after{content:leader('.') target-counter(attr(href),page)}
section.sec{break-before:page}
section.chapter,section.level{break-before:right}
section.frontsec{page:front;break-before:right}
section.part{page:part;break-before:right;height:9in;text-align:center;padding-top:.55in}
section.part img{width:4.5in;height:auto;max-height:6.1in;display:block;margin:0 auto}
section.part .pt{margin-top:.35in;text-align:center}
section.part h1{font:500 11pt Plex;letter-spacing:.3em;text-transform:uppercase;color:#4a3a28;margin:0;string-set:chap ""}
section.part h2{font:500 30pt EBG;margin:.2em 0 0;color:#231c15}
.vida{border-left:2px solid #c9a24a;padding:.2em 0 .2em .9em;margin:0 0 1.2em;font-size:9.8pt;color:#3b3126}
.vida p{text-align:left;margin:0}
.marks{display:grid;grid-template-columns:1fr 1fr;column-gap:.18in;row-gap:.12in;margin:.6em 0 1em}
.marks figure{margin:0}
.marks img{max-height:1.35in;width:100%;object-fit:cover}
.pair{display:grid;grid-template-columns:1fr 1fr;column-gap:.18in;break-inside:avoid;margin:.6em 0}.pair figure{margin:0}
.pair img{max-height:2.3in}
.steps4{display:grid;grid-template-columns:repeat(4,1fr);column-gap:.08in;break-inside:avoid;margin:.6em 0}.steps4 figure{margin:0}
.steps4 img{max-height:1.55in}.steps4 figcaption{font-size:7.4pt}
.steps4.small img{max-height:.95in}
.practice{margin-top:1.4em;border-top:1px solid #d9cbb3;padding-top:.7em;break-inside:avoid}
.practice ul{margin:0;padding:0;list-style:none;font-size:9.3pt}
.practice li{margin:.12em 0}.practice a{font:500 8pt Plex;color:#9a7b3c;margin-right:.4em}
.practice .lvl{font:400 7pt Plex;color:#9b8c78;margin-left:.3em}
.lead{font-size:11.2pt;font-style:italic;color:#3b3126}
.count{font:500 8pt Plex;letter-spacing:.1em;text-transform:uppercase;color:#9b8c78}
section.ex{break-before:page;break-inside:avoid}
.exnum{font:500 9pt Plex;letter-spacing:.14em;color:#9a7b3c;margin:0 0 .2em}
.ex figure.model{margin:.4em 0 .7em}
.ex figure.model img{max-height:3.65in}
.exmeta{font:400 8pt Plex;color:#7a6c5a;text-align:left}
.crit{font-size:10pt}.crit .sc{font-variant:small-caps;letter-spacing:.04em;font-weight:600}
.exref{font-size:8.6pt;color:#6b5d4d;text-align:left}
.exref a{border-bottom:.5pt solid #c9a24a}
table{border-collapse:collapse;width:100%;font-size:9pt;margin:.6em 0 1em}
th{font:500 7.2pt Plex;letter-spacing:.1em;text-transform:uppercase;color:#7a6c5a;text-align:left;border-bottom:.8pt solid #231c15;padding:.3em .4em .3em 0}
td{border-bottom:.4pt solid #ddd0bb;padding:.35em .5em .35em 0;vertical-align:top}
table.chrono td:first-child,table.letters td:first-child{font:500 8.2pt Plex;white-space:nowrap;color:#9a7b3c}
table.idx td:first-child{font:500 8pt Plex}
ol.check li{margin:.35em 0}
dl.gloss dt{font-weight:600;margin-top:.55em}dl.gloss dd{margin:0 0 0 1.2em}
.ref{padding-left:1.2em;text-indent:-1.2em;text-align:left}
.sign{text-align:right;font-style:italic;margin-top:1.4em}
.cat{display:flex;gap:.16in;margin:0 0 .9em;break-inside:avoid;align-items:flex-start}
.cat img{width:1.05in;height:auto;flex:none}
.cat p{text-align:left;margin:0 0 .15em}
.ct{font-size:10pt}.cn{font:500 7.5pt Plex;color:#9a7b3c;margin-right:.3em}
.cc{font-size:8.5pt;color:#5d5144}.cf{font:400 7.2pt Plex;color:#7a6c5a}.cl{font-size:8.5pt}
"""

TOC_ORDER = []

def pdf_html(S):
    parts = [f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Van Gogh a Lápis</title><style>{font_faces()}{PDF_CSS}</style></head><body>']
    parts.append('<div class="cover"><img src="img/cover.jpg"/></div>')
    parts.append('<div class="titlepage"><p class="t">Van Gogh a Lápis</p><p class="s">Ranhuras, fluxo e rostos:<br/>um curso no traço de Vincent</p><p class="a">Pedro Torres</p></div>')
    yr = datetime.date.today().year
    parts.append(f'<div class="copy"><p>© {yr} Pedro Torres. Todos os direitos reservados.</p><p>Nenhuma parte deste livro pode ser reproduzida sem autorização do autor, exceto as folhas de exercício destinadas ao uso pessoal do leitor.</p><p>Primeira edição, {yr}.</p></div>')
    toc = ['<div class="toc"><h1>Sumário</h1><ul>']
    for s in S:
        if s['kind'] == 'part':
            toc.append(f'<li class="part"><a href="#{s["id"]}">{esc(s["title"])}</a></li>')
        elif s['kind'] == 'level':
            toc.append(f'<li class="sub"><a href="#{s["id"]}">{esc(s["title"])}</a></li>')
        else:
            toc.append(f'<li><a href="#{s["id"]}">{esc(s["title"])}</a></li>')
    toc.append('</ul></div>')
    first = True
    for s in S:
        if s['kind'] == 'front' and first:
            parts.extend(toc); first = False
        if s['kind'] == 'part':
            img = s['opener'].replace('ex/', 'img/')
            inner = s['html']
            parts.append(f'<section class="part" id="{s["id"]}"><img src="{img}"/><div class="pt">{inner}</div></section>')
        else:
            cls = {'front': 'frontsec', 'chapter': 'chapter', 'level': 'level', 'back': 'chapter'}[s['kind']]
            parts.append(f'<section class="{cls}" id="{s["id"]}">{s["html"]}</section>')
    parts.append('</body></html>')
    return '\n'.join(parts)

# ---------------------------------------------------------------- EPUB
EPUB_CSS = """
body{font-family:serif;line-height:1.5;margin:0 4%}
h1{font-size:1.7em;line-height:1.15;margin:1.2em 0 .8em;page-break-before:always}
h1 .lvnum{display:block;font-size:.45em;letter-spacing:.15em;text-transform:uppercase;color:#8a6a2c}
h2{font-size:1.2em;margin:1.4em 0 .5em}
h3{font-size:1.15em;margin:.2em 0 .4em}
h4{font-size:.75em;letter-spacing:.12em;text-transform:uppercase;color:#8a6a2c;margin:0 0 .4em}
p{margin:0 0 .6em;text-indent:0}
figure{margin:1em 0;text-align:center;page-break-inside:avoid}
img{max-width:100%;height:auto}
figcaption{font-size:.82em;color:#555;text-align:left;margin-top:.3em}
.vida{border-left:3px solid #c9a24a;padding-left:.8em;margin:0 0 1.2em;font-size:.92em}
.marks figure,.pair figure{margin:.8em 0}
.steps4 figure{display:inline-block;width:47%;margin:.3em 1%;vertical-align:top}
.practice{border-top:1px solid #ccc;margin-top:1.4em;padding-top:.6em;font-size:.9em}
.practice ul{list-style:none;padding:0}.practice .lvl{color:#888;font-size:.85em}
.exnum{font-family:monospace;color:#8a6a2c;letter-spacing:.12em;margin-top:1.5em}
section.ex{page-break-before:always}
.exmeta,.exref{font-size:.85em;color:#666}
.crit .sc{font-variant:small-caps;font-weight:bold}
.lead{font-style:italic}.count{font-size:.8em;color:#888;text-transform:uppercase;letter-spacing:.08em}
table{border-collapse:collapse;width:100%;font-size:.88em}th,td{border-bottom:1px solid #ccc;padding:.3em .4em;text-align:left;vertical-align:top}
dl.gloss dt{font-weight:bold;margin-top:.6em}dl.gloss dd{margin-left:1em}
.sign{text-align:right;font-style:italic}
.cat{margin:0 0 1.4em;page-break-inside:avoid;clear:both;overflow:hidden}.cat img{max-width:38%;float:left;margin:0 .8em .4em 0}.cat div{overflow:hidden}
.cat p{margin:0 0 .2em}.cc,.cf{font-size:.85em;color:#555}.cn{color:#8a6a2c;margin-right:.3em}
.parttitle{text-align:center;margin-top:1em}.parttitle h1{page-break-before:avoid;font-size:.9em;letter-spacing:.25em;text-transform:uppercase;color:#6b5d4d}
.parttitle h2{font-size:1.8em;margin:.2em 0}
.titlepage{text-align:center;margin-top:20%}.titlepage .t{font-size:2em}.titlepage .s{font-style:italic}
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

def build_epub(S, out):
    files = []  # (name, title, body, kind)
    files.append(('titulo.xhtml', 'Folha de rosto', '<div class="titlepage"><p class="t">Van Gogh a Lápis</p><p class="s">Ranhuras, fluxo e rostos: um curso no traço de Vincent</p><p>Pedro Torres</p></div>'
                  f'<p style="margin-top:3em;font-size:.8em;color:#666">© {datetime.date.today().year} Pedro Torres. Todos os direitos reservados.</p>', 'front'))
    idfile = {}
    for i, s in enumerate(S):
        name = f'{i:02d}-{s["id"]}.xhtml'
        if s['kind'] == 'part':
            img = s['opener'].replace('ex/', 'img/')
            body = f'<section id="{s["id"]}"><figure><img src="{img}" alt=""/></figure><div class="parttitle">{s["html"]}</div></section>'
        else:
            body = f'<section id="{s["id"]}">{s["html"]}</section>'
        files.append((name, s['title'], body, s['kind']))
        for m in re.finditer(r'id="([^"]+)"', body):
            idfile[m.group(1)] = name
    def fixlinks(body):
        return re.sub(r'href="#([^"]+)"', lambda m: f'href="{idfile.get(m.group(1), "")}#{m.group(1)}"', body)
    imgs = set()
    bid = 'urn:uuid:' + str(uuid.uuid5(uuid.NAMESPACE_URL, 'van-gogh-a-lapis-pedro-torres'))
    with zipfile.ZipFile(out, 'w') as z:
        z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/style.css', EPUB_CSS, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/cover.xhtml', page('Capa', '<figure style="margin:0;text-align:center"><img src="img/cover.jpg" alt="Capa" style="max-height:100%"/></figure>'), compress_type=zipfile.ZIP_DEFLATED)
        for name, title, body, kind in files:
            x = xhtml(fixlinks(body))
            imgs.update(re.findall(r'src="(img/[^"]+)"', x))
            z.writestr('OEBPS/' + name, page(title, x), compress_type=zipfile.ZIP_DEFLATED)
        imgs.add('img/cover.jpg')
        for im in sorted(imgs):
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
        for k, im in enumerate(sorted(imgs)):
            props = ' properties="cover-image"' if im == 'img/cover.jpg' else ''
            man.append(f'<item id="i{k}" href="{im}" media-type="image/jpeg"{props}/>')
        now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        opf = ('<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid" xml:lang="pt-BR">'
               '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
               f'<dc:identifier id="bid">{bid}</dc:identifier><dc:title>Van Gogh a Lápis</dc:title><dc:creator>Pedro Torres</dc:creator>'
               '<dc:language>pt-BR</dc:language><dc:subject>Desenho</dc:subject>'
               '<dc:description>Um curso de desenho na linguagem de Vincent van Gogh: ranhuras, fluxo, rostos e autorretratos, com 91 exercícios em quatro níveis.</dc:description>'
               f'<meta property="dcterms:modified">{now}</meta><meta name="cover" content="i{sorted(imgs).index("img/cover.jpg")}"/></metadata>'
               f'<manifest>{"".join(man)}</manifest><spine>{"".join(spine)}</spine></package>')
        z.writestr('OEBPS/content.opf', opf, compress_type=zipfile.ZIP_DEFLATED)

if __name__ == '__main__':
    import sys
    S = build_sections()
    S += [catalogue(), ex_index(), CREDITS]
    os.makedirs('out', exist_ok=True)
    open('out/livro.html', 'w').write(pdf_html(S))
    if 'pdf' in sys.argv or len(sys.argv) == 1:
        from weasyprint import HTML
        doc = HTML('out/livro.html', base_url=ROOT).render()
        print('páginas', len(doc.pages))
        doc.write_pdf('out/Van-Gogh-a-Lapis.pdf')
    if 'epub' in sys.argv or len(sys.argv) == 1:
        build_epub(S, 'out/Van-Gogh-a-Lapis.epub')
        print('epub ok')
