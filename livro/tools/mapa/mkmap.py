import json, math
T = json.load(open('package/countries-10m.json'))
sc, tr = T['transform']['scale'], T['transform']['translate']
arcs = []
for a in T['arcs']:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy
        pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
    arcs.append(pts)
def arc(i):
    return arcs[i] if i >= 0 else arcs[~i][::-1]
def ring(r):
    pts = []
    for i in r:
        a = arc(i); pts.extend(a if not pts else a[1:])
    return pts
LON0, LON1, LAT0, LAT1 = -1.9, 8.5, 43.1, 53.6
W = 6.0
k = math.cos(math.radians(48.4))
H = W * (LAT1 - LAT0) / ((LON1 - LON0) * k)
def P(lon, lat):
    return ((lon - LON0) * k / ((LON1 - LON0) * k) * W * 96, (LAT1 - lat) / (LAT1 - LAT0) * H * 96)
names = {'528': 'nl', '056': 'be', '250': 'fr', '826': 'uk', '276': 'de', '442': 'lu', '756': 'ch', '380': 'it', '724': 'es'}
paths = []
for g in T['objects']['countries']['geometries']:
    gid = g.get('id')
    if gid not in names: continue
    polys = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]
    d = ''
    for poly in polys:
        for r in poly:
            pts = ring(r)
            if not any(LON0 - 3 < p[0] < LON1 + 3 and LAT0 - 3 < p[1] < LAT1 + 3 for p in pts): continue
            d += 'M' + 'L'.join(f'{P(*p)[0]:.1f},{P(*p)[1]:.1f}' for p in pts[::1]) + 'Z'
    if d:
        paths.append((names[gid], d))
json.dump({'W': W, 'H': H, 'paths': paths}, open('base.json', 'w'))
print(W, H, len(paths))
