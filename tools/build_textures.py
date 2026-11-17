#!/usr/bin/env python3
"""Descarga texturas CC0 de ambientCG y las incrusta en assets/textures.js.

Uso:  python3 tools/build_textures.py
Las texturas son de https://ambientcg.com (licencia CC0, dominio público).
"""
import base64, io, math, os, sys, urllib.request, zipfile
from PIL import Image, ImageEnhance

# nombre en el juego: (id ambientCG, tamaño, incluir normal map[, brillo])
TEXTURES = {
    'grass':    ('Grass004', 1024, True),
    'grass2':   ('Ground037', 1024, False),
    'dirt':     ('Ground109', 1024, True),
    'road':     ('Ground054', 1024, True),
    'forest':   ('Ground048', 1024, True),
    'gravel':   ('Gravel022', 512, False),
    'bricks':   ('Bricks066', 512, True),
    'plaster':  ('Plaster001', 512, True),
    'concrete': ('Concrete034', 512, True),
    'siding':   ('Planks037A', 512, True),
    'tiles':    ('RoofingTiles014A', 512, True),
    'slate':    ('RoofingTiles013A', 512, True, 2.3),
    'metal':    ('CorrugatedSteel005', 512, True),
    'floor':    ('WoodFloor041', 512, True),
    'crate':    ('Planks021', 512, True),
    'canvas':   ('Fabric030', 256, False),
    'paint':    ('Metal032', 256, False),
    'bark':     ('Bark012', 512, True),
    'leaves':   ('ScatteredLeaves008', 512, False),
}

def fetch(asset):
    url = f'https://ambientcg.com/get?file={asset}_1K-JPG.zip'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return zipfile.ZipFile(io.BytesIO(r.read()))

def encode(img, size, gain=1.0):
    img = img.convert('RGB').resize((size, size), Image.LANCZOS)
    if gain != 1.0: img = ImageEnhance.Brightness(img).enhance(gain)
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=80, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

def atlas(asset):
    z = fetch(asset); files = z.namelist()
    col = Image.open(z.open(next(f for f in files if f.endswith('_Color.jpg')))).convert('RGB')
    op = Image.open(z.open(next(f for f in files if f.endswith('_Opacity.jpg')))).convert('L')
    im = col.copy(); im.putalpha(op); return im

def pieces(im, cols, rows):
    w, h = im.size; out = []
    for j in range(rows):
        for i in range(cols):
            p = im.crop((i * w // cols, j * h // rows, (i + 1) * w // cols, (j + 1) * h // rows))
            bb = p.getbbox()
            if bb: out.append(p.crop(bb))
    return out

def webp(img):
    buf = io.BytesIO(); img.save(buf, 'WEBP', quality=82, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

def tint(p, k):
    r, g, b, a = p.split()
    return Image.merge('RGBA', [x.point(lambda v, kk=kk: max(0, min(255, int(v * kk)))) for x, kk in zip((r, g, b), k)] + [a])

def foliage():
    import random
    rnd = random.Random(7)
    out = {}
    # racimo de hojas para copas de árbol (hojas de LeafSet024)
    leaves = pieces(atlas('LeafSet024'), 3, 3)
    for name, base in (('leafA', (0.85, 1.0, 0.75)), ('leafB', (0.75, 0.92, 0.6))):
        S = 512; card = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        for n in range(70):
            a = rnd.random() * 6.283; d = (rnd.random() ** 0.6) * S * 0.36
            cx = S / 2 + math.cos(a) * d; cy = S / 2 + math.sin(a) * d
            l = rnd.choice(leaves); sz = int(S * (0.13 + rnd.random() * 0.08))
            l = l.resize((sz, int(sz * l.size[1] / l.size[0])), Image.LANCZOS).rotate(rnd.random() * 360, expand=True, resample=Image.BICUBIC)
            shade = 0.55 + 0.45 * (1 - d / (S * 0.36)) * 0.4 + rnd.random() * 0.35
            l = tint(l, tuple(c * shade for c in base))
            card.alpha_composite(l, (int(cx - l.size[0] / 2), int(cy - l.size[1] / 2)))
        out[name] = webp(card)
    # rama de conífera (LeafSet019): la central del atlas
    br = pieces(atlas('LeafSet019'), 1, 3)
    b = max(br, key=lambda p: p.size[0] * p.size[1])
    b = b.resize((512, int(512 * b.size[1] / b.size[0])), Image.LANCZOS)
    out['pine'] = webp(tint(b, (0.8, 0.95, 0.8)))
    # mata de hierba (Foliage001 + Foliage003): hojas que nacen abajo en abanico
    blades = pieces(atlas('Foliage001'), 9, 1) + pieces(atlas('Foliage003'), 4, 1)
    for name, base in (('grassA', (0.95, 1.0, 0.7)), ('grassB', (1.05, 1.0, 0.6))):
        W, H = 512, 512; card = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for n in range(26):
            bl = rnd.choice(blades)
            h = int(H * (0.5 + rnd.random() * 0.48)); w = max(6, int(bl.size[0] * h / bl.size[1]))
            bl = bl.resize((w, h), Image.LANCZOS).rotate((rnd.random() - 0.5) * 40, expand=True, resample=Image.BICUBIC)
            shade = 0.7 + rnd.random() * 0.45
            bl = tint(bl, tuple(c * shade for c in base))
            x = int(W / 2 + (rnd.random() - 0.5) * W * 0.55 - bl.size[0] / 2)
            card.alpha_composite(bl, (max(0, min(W - bl.size[0], x)), H - bl.size[1]))
        out[name] = webp(card)
    return out

def main():
    out = ['// Generado por tools/build_textures.py — texturas CC0 de ambientCG.com', 'window.TEX = {']
    for name, data in foliage().items():
        out.append(f"  {name}: '{data}',")
        print(name, file=sys.stderr)
    for name, spec in TEXTURES.items():
        asset, size, normal = spec[:3]
        gain = spec[3] if len(spec) > 3 else 1.0
        z = fetch(asset)
        files = z.namelist()
        col = next(f for f in files if f.endswith('_Color.jpg'))
        out.append(f"  {name}: '{encode(Image.open(z.open(col)), size, gain)}',")
        if normal:
            nf = next((f for f in files if f.endswith('_NormalGL.jpg')), None)
            if nf: out.append(f"  {name}_n: '{encode(Image.open(z.open(nf)), size)}',")
        print(name, asset, file=sys.stderr)
    out.append('};')
    path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'textures.js')
    with open(path, 'w') as f: f.write('\n'.join(out) + '\n')
    print('escrito', path, os.path.getsize(path) // 1024, 'KB', file=sys.stderr)

if __name__ == '__main__':
    main()
