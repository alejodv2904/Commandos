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
- **Enemigos:** soldados (recogen cebos), sargentos (fuego rápido, no se distraen en alerta), oficiales (inmunes a cebos, descubren disfraces con la barra azul) y francotiradores en torre (cono largo y estrecho, disparan sin aviso).
- **Cuerpos:** cualquier cuerpo a la vista provoca la alarma del sector; escóndelos en arbustos o edificios. El puñetazo deja inconsciente ~28 s: átalo con una cuerda.
- **Salud:** a 0 el comando queda moribundo 15 s; un botiquín lo salva.
- **Objetivos:** principal (volar el depósito y llegar a la extracción) y opcional (documentos del oficial). Valoración final de 5 estrellas.

## Apartado visual
- Vista isométrica 3D (cámara ortográfica a ~30°, como Commandos 2) con Three.js.
- Texturas fotográficas reales de [ambientCG](https://ambientcg.com) (licencia CC0): hierba, tierra, grava, ladrillo, yeso, hormigón, tablones, tejas, pizarra, chapa ondulada, corteza, hojas, tela y metal.
- Suelo mezclado por shader según el tipo de terreno, con bordes orgánicos y variación a gran escala.
- Edificios en 3D con dos fachadas visibles, entramado, ventanas, contraventanas, chimeneas y tejados a cuatro aguas; al entrar un comando se ven por dentro.
- Sol con sombras proyectadas en tiempo real, árboles que se mecen, río con agua animada y puentes.
- Soldados en 3D animados (andar, agacharse, apuntar, caer), con el uniforme y el tocado de cada uno.
- Partículas 3D (fuego, humo, restos, fogonazos) con luz de explosión y temblor de cámara.
- Interfaz con retratos, mochila de acciones, cursor propio y expediente de misión; sonido sintetizado.

## Texturas
`assets/textures.js` contiene las texturas incrustadas, para que el juego funcione abriendo el archivo directamente.
Se regeneran con `python3 tools/build_textures.py` (requiere Pillow e Internet).

## Estructura
- `js/util.js` utilidades · `js/textures.js` ruido y color · `js/level.js` mapa, LOS, A*
- `js/entities.js` comandos e IA enemiga · `js/models.js` materiales y modelos 3D · `js/render3d.js` escena, cámara, partículas
- `js/items.js` inventario y objetos · `js/input.js` controles · `js/hud.js` interfaz, mochila, mapa táctico
- `js/hudart.js` iconos y retratos · `js/audio.js` sonido · `js/main.js` reglas, bucle, guardado
- `vendor/three.min.js` Three.js r147 (licencia MIT) · `assets/textures.js` texturas CC0
