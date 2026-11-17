# Commandos 3 – Hombres de Valor

Juego de estrategia táctica en tiempo real inspirado en *Commandos 2*, en 3D isométrico con Three.js y texturas fotográficas reales (CC0).

## Cómo jugar
Abre `index.html` en el navegador (doble clic). Funciona sin servidor: Three.js y las texturas van incluidos en el repositorio.

**Misión:** infiltra a los 4 comandos, vuela el depósito de combustible con la bomba del Zapador y reúne a todos en la extracción. Opcional: roba los documentos del oficial.

## Controles (configuración clásica de Commandos 2)
| Entrada | Acción |
|---|---|
| Clic izquierdo | Seleccionar · andar · usar el objeto equipado |
| Doble clic | Correr (hace ruido) |
| Clic derecho | Cancelar la acción · arrastrar: selección múltiple |
| Shift + clic | Interactuar: cargar/soltar cuerpos, registrar |
| Alt + clic · ← → | Girar la cámara 90° (4 vistas) |
| ↑ ↓ · bordes · clic central · rueda | Desplazar cámara · zoom |
| 1–9 · Ctrl+1–9 · 0 | Elegir comando · añadir/quitar · ninguno |
| Espacio · X | Cuerpo a tierra · cubrirse (disparo automático) |
| Q A S D | Puñetazo · cuchillo · pistola · rifle |
| G F C V E | Granada · botiquín · cigarrillos · vino · alicates |
| W · T · U / J | Examinar · hablar (Espía) · poner/quitar uniforme |
| Tab / Intro | Fijar el cono del enemigo bajo el cursor (en vacío: todos) |
| F1 · F8 · F9 · F10 · F11 · F12 | Ayuda · ocultar HUD · mapa táctico · objetos · enemigos · captura |
| Ctrl+S · Ctrl+L · P | Guardado rápido · carga rápida · pausa |

## Comandos y mochila
Cada comando tiene una mochila en cuadrícula (estilo Tetris); los objetos ocupan casillas según su tamaño
(1×1 granada/cigarrillos, 2×1 cuchillo/pistola/cuerda, 2×2 botiquín/uniforme/bomba, 3×2 rifle).
Arrastra un objeto sobre el retrato de un compañero cercano para dárselo.
- **Boina Verde:** cuchillo, cuerdas, señuelos, cigarrillos, botiquín; puñetazo; carga cuerpos.
- **Francotirador:** rifle de francotirador y munición; puñetazo; carga cuerpos.
- **Espía:** jeringuilla, uniforme, pistola, cebos; hablar para entretener a un guardia; no carga cuerpos.
- **Zapador:** bomba de relojería, granadas, alicates, pistola, ración; puñetazo; carga cuerpos.

## Reglas (según la guía técnica de Commandos 2)
- **Cono de visión de 90°:** zona verde claro cercana (te ven en cualquier postura) y verde oscuro lejana (tumbado eres invisible). Muros, vehículos, árboles y arbustos densos lo cortan.
- **Alertas:** naranja = oyó un ruido · azul = vio algo raro (un cuerpo) · rojo = te ha descubierto y da la alarma.
- **Ruido:** andar/arrastrarse 0 · cuchillo/puñetazo ≈4 m · correr ≈7 m · señuelo ≈12 m · pistola ≈26 m · rifle ≈36 m · explosión: todo el complejo.
- **Enemigos:** soldados (recogen cebos), sargentos (fuego rápido, no se distraen en alerta), oficiales (inmunes a cebos, descubren al instante a cualquier comando de uniforme salvo al Espía), Gestapo (descubre al Espía si pasa más de 2 s en su zona cercana) y francotiradores en torre (cono largo y estrecho, disparan sin aviso).
- **Cuerpos:** cualquier cuerpo a la vista provoca la alarma del sector; escóndelos en arbustos o edificios. El puñetazo deja inconsciente ~28 s: átalo con una cuerda.
- **Salud:** a 0 el comando queda moribundo 15 s; un botiquín lo salva.
- **Objetivos:** principal (volar el depósito y llegar a la extracción) y opcional (documentos del oficial). Valoración final de 5 estrellas.

## Apartado visual
- **Iluminación física (PBR):** materiales con mapas de normales y rugosidad; luz ambiental de un cielo atmosférico real (Sky + PMREM); sol cálido de tarde con sombras suaves.
- **Postprocesado de cine:** render HDR con MSAA, bloom en fuego y destellos, tonemapping ACES, gradación de color cálida, desenfoque «tilt-shift» de maqueta, viñeta y grano.
- **Vegetación real:** copas de árbol hechas con racimos de hojas fotográficas (sombras moteadas), pinos con ramas reales y miles de matas de hierba 3D instanciadas que se mueven con el viento.
- **Suelo:** mezcla de texturas fotográficas a 1024 px con relieve, oclusión ambiental precalculada junto a muros, árboles y objetos, y sombras de nubes en movimiento.
- **Soldados animados:** malla deformable con esqueleto y animaciones capturadas (reposo, andar, correr). Cada personaje se viste por zonas del cuerpo con su uniforme: Boina Verde corpulento con camiseta de tirantes y boina; Francotirador delgado con chaqueta larga marrón, guantes y gorra de tela; Espía alto con gabardina beige y fedora (o uniforme de oficial); Zapador robusto con casco británico, polainas y mochila; soldados en gris campaña con casco alemán, sargentos con gorra de campaña y subfusil, oficiales con gorra de plato y botas de montar, Gestapo con gabardina negra y fedora, francotiradores con camuflaje moteado y capucha con red.
- **Agua** con reflejo del cielo, orillas suaves y espuma; edificios con canalones, bajantes y escalones; partículas 3D y luces de explosión.
- **Calidad adaptativa:** si el equipo no llega a unos 30 fps, se desactivan bloom y tilt-shift y se reduce la resolución.

Requiere un navegador con WebGL 2 y, para ir fluido, una tarjeta gráfica dedicada o integrada reciente.

## Recursos y créditos
- Texturas y atlas de hojas/hierba: [ambientCG](https://ambientcg.com) (CC0). Se regeneran con `python3 tools/build_textures.py`.
- Esqueleto y animaciones del soldado: `Soldier.glb` de los ejemplos de Three.js (personaje de Mixamo). Se regenera con `python3 tools/build_models.py`. La malla original no se dibuja; solo se usa su esqueleto animado.
- Three.js r147 y sus módulos de ejemplo (licencia MIT) en `vendor/`.

Todo va incrustado en `assets/` para que el juego funcione abriendo `index.html` directamente.

## Estructura
- `js/util.js` utilidades · `js/textures.js` ruido y color · `js/level.js` mapa, LOS, A*
- `js/entities.js` comandos e IA enemiga · `js/models.js` materiales, edificios, objetos y vegetación · `js/characters.js` soldados animados
- `js/render3d.js` escena, postprocesado, suelo, hierba, agua, partículas · `js/assets.js` carga de recursos
- `js/items.js` inventario y objetos · `js/input.js` controles · `js/hud.js` interfaz, mochila, mapa táctico
- `js/hudart.js` iconos y retratos · `js/audio.js` sonido · `js/main.js` reglas, bucle, guardado
- `vendor/three.min.js`, `vendor/three-extras.js` Three.js r147 · `assets/textures.js`, `assets/models.js` recursos incrustados
