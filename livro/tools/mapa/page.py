import json, math, sys
sys.path.insert(0, '.')
exec(open('mkmap.py').read().split("names = {")[0])  # reutiliza P()
B = json.load(open('base.json'))
Wpx, Hpx = 6 * 96, 9 * 96
STOPS = [(1, 'Borinage', '1879–1880', 3.92, 50.43, (-10, 12, 'end')),
         (2, 'Bruxelas', '1880–1881', 4.35, 50.85, (10, 4)),
         (3, 'Etten', '1881', 4.64, 51.57, (10, -2)),
         (4, 'Haia', '1881–1883', 4.30, 52.08, (-10, -8, 'end')),
         (5, 'Drenthe', '1883', 6.85, 52.72, (10, 4)),
         (6, 'Nuenen', '1883–1885', 5.55, 51.47, (10, 4)),
         (7, 'Antuérpia', '1885–1886', 4.40, 51.22, (-10, -1, 'end')),
         (8, 'Paris', '1886–1888', 2.35, 48.86, (10, 12)),
         (9, 'Arles', '1888–1889', 4.63, 43.68, (-10, 10, 'end')),
         (10, 'Saint-Rémy', '1889–1890', 4.83, 43.79, (10, -2)),
         (11, 'Auvers-sur-Oise', '1890', 2.17, 49.07, (-10, -6, 'end'))]
EXTRA = [('Zundert', 'nasce em 1853', 4.66, 51.47, (-6, 13, 'end')), ('Londres', '1873–1876', -0.13, 51.51, (8, -6))]
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{Wpx}" height="{Hpx}" viewBox="0 0 {Wpx} {Hpx}">',
       '<defs><clipPath id="c"><rect width="100%" height="100%"/></clipPath></defs>',
       f'<rect width="{Wpx}" height="{Hpx}" fill="#E8E2D4"/><g clip-path="url(#c)">']
for name, d in B['paths']:
    svg.append(f'<path d="{d}" fill="#D3C5A6" stroke="#EEE8DC" stroke-width="1.1" stroke-linejoin="round"/>')
# rótulos de país
for txt, lon, lat in [('PAÍSES BAIXOS', 5.9, 52.35), ('BÉLGICA', 4.9, 50.25), ('FRANÇA', 2.6, 46.6), ('INGLATERRA', -0.6, 51.95), ('ALEMANHA', 7.6, 51.0), ('Mar do Norte', 2.6, 53.0), ('Mediterrâneo', 4.6, 43.25)]:
    x, y = P(lon, lat)
    it = 'italic' if txt[0].islower() or txt.startswith('Mar') or txt.startswith('Med') else 'normal'
    svg.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" font-family="Sans" font-size="7" letter-spacing="1.4" fill="#8D8069" font-style="{it}">{txt}</text>')
# rota
pts = [P(lon, lat) for _, _, _, lon, lat, _ in STOPS]
d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1
    cx, cy = mx - dy / L * L * .12, my + dx / L * L * .12
    d += f' Q{cx:.1f},{cy:.1f} {x1:.1f},{y1:.1f}'
svg.append(f'<path d="{d}" fill="none" stroke="#A8673A" stroke-width="1.8" stroke-dasharray="5 3.5" stroke-linecap="round"/>')
for name, yrs, lon, lat, off in EXTRA:
    x, y = P(lon, lat)
    svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2" fill="#E8E2D4" stroke="#6E6253" stroke-width="1"/>')
    anc = off[2] if len(off) > 2 else 'start'
    svg.append(f'<text x="{x+off[0]:.1f}" y="{y+off[1]:.1f}" text-anchor="{anc}" font-family="Sans" font-size="7.2" fill="#6E6253">{name} <tspan font-style="italic">{yrs}</tspan></text>')
for n, name, yrs, lon, lat, off in STOPS:
    x, y = P(lon, lat)
    svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="#1E1913"/>')
    svg.append(f'<text x="{x:.1f}" y="{y+2.6:.1f}" text-anchor="middle" font-family="Sans" font-weight="700" font-size="7.2" fill="#F4EFE6">{n}</text>')
    anc = off[2] if len(off) > 2 else 'start'
    svg.append(f'<text x="{x+off[0]:.1f}" y="{y+off[1]:.1f}" text-anchor="{anc}" font-family="Sans" font-weight="700" font-size="8" fill="#1E1913">{name}'
               f'<tspan font-weight="400" fill="#6E6253"> {yrs}</tspan></text>')
svg.append('</g>')
# título no mar
svg.append(f'<text x="34" y="66" font-family="Disp" font-size="22" fill="#1E1913">O caminho</text><text x="34" y="92" font-family="Disp" font-size="22" fill="#1E1913">de Vincent</text>')
svg.append(f'<text x="34" y="112" font-family="Serif" font-style="italic" font-size="11" fill="#1E1913">Onze endereços em dez anos de desenho</text>')
# escala
x0, y0 = P(-1.4, 44.0); x1, _ = P(-1.4 + 100 / (111.32 * math.cos(math.radians(44))), 44.0)
svg.append(f'<path d="M{x0:.1f},{y0:.1f} H{x1:.1f}" stroke="#1E1913" stroke-width="1.2"/><text x="{x0:.1f}" y="{y0-5:.1f}" font-family="Sans" font-size="6.5" fill="#1E1913">100 km</text>')
svg.append('</svg>')
open('mapa.svg', 'w').write(''.join(svg))
