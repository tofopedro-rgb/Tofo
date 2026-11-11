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

As reproduções de obras de Vincent van Gogh são de domínio público e foram obtidas no Wikimedia Commons. A reprodução do *Retrato de Joseph Roulin* usada na capa vem do Open Content Program do J. Paul Getty Museum, em Los Angeles. Os dados de catálogo vêm do Wikidata e do Wikimedia Commons. As citações das cartas são traduções livres do autor a partir da edição em inglês publicada pelo Van Gogh Museum e pelo Huygens Institute em vangoghletters.org.

Os desenhos-modelo dos exercícios, as demonstrações em etapas, as amostras de marcas, as ilustrações de abertura das partes e as fotografias de materiais foram criados para este livro com o auxílio de ferramentas de inteligência artificial, a partir de orientações do autor. São interpretações no estilo dos desenhos de Van Gogh e não reproduzem obras dele.

Texto composto em EB Garamond e Archivo.""")}

# ---------------------------------------------------------------- PDF (edição ilustrada)
FONTDIR = os.path.join(ROOT, 'fonts')
PARTS = {'parte1': ('01', 'Parte I', 'Dez anos de desenho',
                    'Entre a decisão de ser artista, em 1880, e a morte, em 1890, passaram-se dez anos. Ele fez nesse tempo cerca de 850 pinturas e mais de mil desenhos. Esta parte acompanha esses dez anos pelo que mudou no traço.'),
         'parte2': ('02', 'Parte II', 'A linguagem',
                    'Os materiais, as marcas, a direção do traço, o rosto, os autorretratos, o corpo, a ordem em que ele construía uma folha e a maneira de copiar um mestre. Um capítulo para cada coisa.'),
         'parte3': ('03', 'Parte III', 'Exercícios',
                    'Os 91 exercícios, em quatro níveis. Cada um parte de um desenho-modelo e diz quando está pronto. Cada um indica também o capítulo que explica a teoria.'),
         'parte4': ('04', 'Parte IV', 'Prática',
                    'Um plano de estudo de oito semanas e uma autoavaliação, para transformar a leitura em hábito.')}
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
table.chrono td:first-child,table.letters td:first-child{font:700 7.8pt Sans;white-space:nowrap}
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

/* capa */
.cover{page:full;position:relative;width:6in;height:9in;background:#2A2119;color:#FBF8F1;break-after:page;bookmark-level:1;bookmark-label:"Capa"}
.cover .art{position:absolute;top:0;bottom:0;left:.13in;right:0;background:url("img/cover-roulin.jpg") 46% 0/118% auto no-repeat}
.cover .topsh{position:absolute;left:.13in;right:0;top:0;height:1.1in;background:linear-gradient(to bottom,rgba(20,15,10,.32),rgba(20,15,10,0))}
.cover .shade{position:absolute;left:.13in;right:0;bottom:0;height:5in;background:linear-gradient(to bottom,rgba(20,15,10,0),rgba(20,15,10,.55) 45%,rgba(20,15,10,.66))}
.cover .spine{position:absolute;top:0;bottom:0;left:0;width:.13in;background:#F7F4EE}
.cover .ed{position:absolute;top:.38in;left:.13in;right:0;text-align:center;font:500 10.5pt Sans;letter-spacing:.2em}
.cover .t{position:absolute;left:.13in;right:0;top:5.75in;text-align:center;font:400 50pt/1 Serif;letter-spacing:-.012em;white-space:nowrap}
.cover .d{position:absolute;left:.13in;right:0;top:6.57in;text-align:center;font:italic 400 15pt Serif}
.cover .coll{position:absolute;bottom:.42in;left:.13in;right:0;text-align:center;font:italic 400 10.5pt Serif}

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
.partimg{page:full;break-before:page;width:6in;height:9in}
.partimg img{width:6in;height:9in;object-fit:cover;display:block}
.part{page:part;break-before:page;position:relative;width:6in;height:9in;color:#1E1913}
.part .plab{position:absolute;left:.55in;top:1.72in;font:500 7.4pt Sans;margin:0}
.part .prule{position:absolute;left:.55in;right:.55in;top:1.95in;border-top:.6pt solid #1E1913}
.part .pnum{position:absolute;left:.5in;top:2.1in;font:400 118pt/1 Disp;margin:0}
.part h1{position:absolute;left:.55in;top:3.85in;width:4.4in;font-size:23pt;margin:0}
.part .pintro{position:absolute;left:.55in;top:4.95in;width:3.4in;font-size:9.6pt;text-align:left}

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
.exsolo img{max-width:100%;max-height:4.3in}
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
.ficha td{border-top:.6pt solid #A39682;border-bottom:none;padding:.05in 0}
.ficha td:first-child{width:.95in;color:#6E6253}
.catlist{break-before:page}
.cat{display:flex;gap:.18in;margin:0 0 .22in;break-inside:avoid;align-items:flex-start;border-top:.6pt solid #CFC4B0;padding-top:.14in}
.cat .im{width:1.75in;flex:none;text-align:left}
.cat img{max-width:1.75in;max-height:1.95in}
.cat p{text-align:left;margin:0 0 .18em}
.cat .ct{font:400 10.4pt/1.25 Serif}
.cat .cn{font:400 9pt Disp;margin-right:.35em}
.cat .cc{font:400 7.2pt/1.42 Sans;color:#6E6253}
.cat .cf{font:400 6.8pt/1.4 Sans;color:#6E6253}
.cat .cl{font-size:9pt;line-height:1.38}

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
    plab = f'{part[1]} · {part[2]}' if part else ''
    short = re.sub(r':.*', '', n.group(2) if n else title)
    rh = f'<span class="rh">{short}</span>'
    if n:
        head = f'<div class="chhead"><p class="chlab">Capítulo {n.group(1)}<br/>{plab}</p><p class="chnum">{n.group(1)}</p><h1>{n.group(2)}</h1></div>'
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
        ref = f'<p class="exref">Obra para comparar: <i>{esc(PL[x["ref"]]["t"])}</i>, no <a href="#catalogo">catálogo</a>.</p>'
    foot = (f'<div class="exfoot"><div class="desc"><p>{esc(x["d"])}</p></div>'
            f'<div class="done"><b>Pronto quando</b> {esc(x["c"])}</div></div>')
    return f'<section class="ex{" half" if half else ""}" id="ex-{x["id"]}">{head}{meta}{art}{foot}{ref}</section>'

def level_pdf(code, lid, ln, name, intro, chapnames):
    items = [x for x in EX if x['lv'] == code]
    lst = ''.join(f'<p><b><a href="#ex-{x["id"]}">{x["id"].upper()}</a></b>{esc(x["t"])}</p>' for x in items)
    out = [f'<section class="level" id="{lid}"><span class="rh">Exercícios · {ln}</span>'
           f'<div class="lvhead"><p class="chlab">Parte III · Exercícios</p><p class="chnum">{ln[-1]}</p><h1>{ln}<br/>{name}</h1></div>'
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
    out = ['<section class="chap" id="catalogo"><span class="rh">Catálogo das obras</span>'
           '<div class="chhead nonum"><p class="chlab">Catálogo</p><h1>Catálogo das obras</h1></div>'
           '<p>As obras de Van Gogh citadas no livro e indicadas nos exercícios, em ordem aproximada de data. Seis delas aparecem primeiro, '
           'em página inteira, para ver de perto. Quando disponíveis, seguem os números de catálogo F (de la Faille) e JH (Hulsker), '
           'as dimensões (altura por largura) e o acervo.</p></section>']
    for k in sorted(ICONS, key=lambda k: num[k]):
        p = PL[k]; f, inst = ficha(k)
        rows = [('Catálogo', f.get('cat')), ('Medidas', f.get('dim')), ('Acervo', inst)]
        tr = ''.join(f'<tr><td>{a}</td><td>{esc(b)}</td></tr>' for a, b in rows if b)
        out.append(f'<section class="iconimg"><img src="img/{k}.jpg" alt="{esc(p["t"])}"/></section>')
        out.append(f'<section class="iconinfo" id="cat-{k}"><div class="ptop"><span>Catálogo das obras</span><span>Prancha {num[k]}</span></div>'
                   f'<p class="no">{num[k]}</p><h2>{esc(p["t"])}</h2><p class="cc">{esc(p["c"])}</p><p class="cl">{esc(p.get("l", ""))}</p>'
                   + (f'<table class="ficha">{tr}</table>' if tr else '') + '</section>')
    cards = []
    for k in order:
        if k in ICONS:
            continue
        p = PL[k]; f, inst = ficha(k)
        fi = ' · '.join(v for v in [f.get('cat'), f.get('dim'), inst] if v)
        cards.append(f'<div class="cat" id="cat-{k}"><div class="im"><img src="img/{k}.jpg" alt="{esc(p["t"])}"/></div><div>'
                     f'<p class="ct"><span class="cn">{num[k]}</span><i>{esc(p["t"])}</i></p><p class="cc">{esc(p["c"])}</p>'
                     + (f'<p class="cf">{esc(fi)}</p>' if fi else '') + f'<p class="cl">{esc(p.get("l", ""))}</p></div></div>')
    out.append('<section class="catlist"><span class="rh">Catálogo das obras</span>' + ''.join(cards) + '</section>')
    return ''.join(out)

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
    P.append('<div class="cover"><div class="art"></div><div class="topsh"></div><div class="shade"></div><div class="spine"></div>'
             '<div class="ed">PEDRO TORRES</div><div class="t">Van Gogh a Lápis</div><div class="d">Teoria e prática para desenhar como Vincent</div>'
             '<div class="coll">91 exercícios em quatro níveis</div></div>')
    P.append('<div class="titlepage"><p class="t">Van Gogh a Lápis</p><p class="s">Teoria e prática para<br/>desenhar como Vincent</p><p class="a">PEDRO TORRES</p></div>')
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
    for s in S:
        k = s['kind']
        if k == 'part':
            part = PARTS[s['id']]
            n, lab, name, intro = part
            img = s['opener'].replace('ex/', 'img/')
            P.append(f'<section class="partimg"><img src="{img}" alt=""/></section>')
            P.append(f'<section class="part" id="{s["id"]}" style="bookmark-level:1;bookmark-label:\'{lab} · {name}\'">'
                     f'<p class="plab">{lab}</p><div class="prule"></div><p class="pnum">{n}</p><h1>{name}</h1><p class="pintro">{intro}</p></section>')
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
        else:
            head, body, t = chapter_head(s, part if k == 'chapter' else None)
            lvl = 2 if k == 'chapter' else 1
            lab = s['title'].replace("'", "’")
            P.append(f'<section class="chap" id="{s["id"]}" style="bookmark-level:{lvl};bookmark-label:\'{lab}\'">{head}{body}</section>')
    P.append('</body></html>')
    html_ = '\n'.join(P)
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
            img = s['opener'].replace('ex/', 'img/')
            n_, lab_, name_, intro_ = PARTS[s['id']]
            body = (f'<section id="{s["id"]}"><figure><img src="{img}" alt=""/></figure><div class="parttitle"><p class="pn">{n_}</p>'
                    f'<h1>{lab_}</h1><h2>{name_}</h2><p>{intro_}</p></div></section>')
        else:
            body = f'<section id="{s["id"]}">{s["html"]}</section>'
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
            if small:
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
    S += [catalogue(), ex_index(), CREDITS]
    os.makedirs('out', exist_ok=True)
    args = sys.argv[1:] or ['cover', 'pdf', 'epub']
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
