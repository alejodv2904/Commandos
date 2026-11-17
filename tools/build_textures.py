#!/usr/bin/env python3
"""Descarga texturas CC0 de ambientCG y las incrusta en assets/textures.js.

Uso:  python3 tools/build_textures.py
Las texturas son de https://ambientcg.com (licencia CC0, dominio público).
"""
import base64, io, os, sys, urllib.request, zipfile
from PIL import Image, ImageEnhance

# nombre en el juego: (id ambientCG, tamaño, incluir normal map[, brillo])
TEXTURES = {
    'grass':    ('Grass004', 512, False),
    'grass2':   ('Ground037', 512, False),
    'dirt':     ('Ground109', 512, False),
    'road':     ('Ground054', 512, False),
    'forest':   ('Ground048', 512, False),
    'gravel':   ('Gravel022', 512, False),
    'bricks':   ('Bricks066', 512, True),
    'plaster':  ('Plaster001', 512, False),
    'concrete': ('Concrete034', 512, False),
    'siding':   ('Planks037A', 512, True),
    'tiles':    ('RoofingTiles014A', 512, True),
    'slate':    ('RoofingTiles013A', 512, True, 2.3),
    'metal':    ('CorrugatedSteel005', 512, True),
    'floor':    ('WoodFloor041', 512, False),
    'crate':    ('Planks021', 256, False),
    'canvas':   ('Fabric030', 256, False),
    'paint':    ('Metal032', 256, False),
    'bark':     ('Bark012', 256, False),
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

def main():
    out = ['// Generado por tools/build_textures.py — texturas CC0 de ambientCG.com', 'window.TEX = {']
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
