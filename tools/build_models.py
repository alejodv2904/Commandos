#!/usr/bin/env python3
"""Incrusta el modelo del soldado (Soldier.glb de los ejemplos de Three.js r147, personaje
de Mixamo) en assets/models.js para que el juego funcione abriendo index.html directamente."""
import base64, os, urllib.request
URL = 'https://raw.githubusercontent.com/mrdoob/three.js/r147/examples/models/gltf/Soldier.glb'
data = urllib.request.urlopen(urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'}), timeout=120).read()
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'models.js')
with open(out, 'w') as f:
    f.write('// Generado por tools/build_models.py — Soldier.glb (ejemplos de Three.js, personaje de Mixamo)\n')
    f.write("window.MODELS = { soldier: '" + base64.b64encode(data).decode() + "' };\n")
print('escrito', out, os.path.getsize(out) // 1024, 'KB')
