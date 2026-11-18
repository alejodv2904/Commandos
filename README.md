# Commandos 3 – Hombres de Valor

Juego de estrategia táctica en tiempo real inspirado en *Commandos 2*, en 3D isométrico con Three.js y texturas fotográficas reales (CC0).

## Cómo jugar
Abre `index.html` en el navegador (doble clic). Funciona sin servidor: Three.js y las texturas van incluidos en el repositorio.

**Campaña:** el menú principal da acceso al selector de las 21 misiones de la biblia de diseño (2 entrenamientos, 10 de campaña y 9 bonus). Por ahora son jugables:

| Misión | Escuadrón | Resumen |
|---|---|---|
| **E2 · Fuego Cruzado** (desierto, día) | Espía, Explosivos, Francotirador, Conductor | Cada especialista tiene su tarea: el Espía de uniforme cruza el control y neutraliza al oficial; Explosivos corta la alambrada, limpia el campo de minas con el detector y vuela el muro del cañón; el Francotirador sube a la torre de agua y elimina a los vigías de las azoteas; el Conductor recoge al escuadrón en el camión y sale por el cañón. |
| **1 · Frecuencia Muerta** (Atacama, noche) | Ladrón y Seductora | Tres terrazas con focos giratorios y farolas. Corta la electricidad en la subestación, abre la cúpula con ganzúas, descarga los datos, sabotea el motor de la antena y escapa en el todoterreno. Hay 20 chips escondidos y dos objetivos secundarios. |
| **X · Operación Depósito** | Boina Verde, Francotirador, Espía, Zapador | La misión original de prueba. |

Las demás misiones y los bonus (se desbloquean reuniendo los 20 chips de su misión) aparecen en el selector pero aún están en desarrollo. El progreso, las estrellas y los chips se guardan en el navegador.

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

## Nuevos comandos y objetos (fase 1)
- **Conductor:** conduce el camión (Shift + clic para subir y bajar; clic para dirigirlo), pistola silenciada y granadas de humo (15 s de nube que corta la visión).
- **Ladrón:** el más bajo y rápido; trepa los muros de las terrazas (solo él), abre puertas cerradas con ganzúas (K), roba bolsillos por la espalda (R) y se mueve casi sin ruido.
- **Seductora:** va de civil, así que solo los oficiales sospechan si se queda cerca; con el lápiz labial (L) atrae a soldados y técnicos, que se acercan embobados mientras ella no se mueva.
- **Explosivos:** detector de minas (M) que revela las minas cercanas; Shift + clic sobre una revelada para desactivarla. Pisar una mina sin detectar es mortal, también para los vehículos.
- Noche con farolas y focos giratorios: fuera de la luz los guardias ven mucho menos. Cortar la electricidad apaga todo.

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
- **Soldados animados:** malla deformable con esqueleto y animaciones capturadas (reposo, andar, correr), vestida por zonas del cuerpo con el uniforme de cada personaje.
- **Complexión y estatura de cada personaje** (según las estaturas de Commandos 2, exageradas ×1,8 respecto al soldado de 1,78 m para que se lean con la cámara lejana): el Boina Verde (1,98 m) es el más alto, con hombros, pecho y brazos mucho más anchos; el Francotirador (1,85 m) y el Espía (1,82 m) son altos y delgados; el Zapador (1,78 m) es robusto y barrigón; los oficiales y la Gestapo son algo más altos que la tropa. La complexión se consigue engordando o adelgazando la malla alrededor de cada hueso y separando los huesos de hombros y caderas, sin alterar las animaciones.
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
- `js/missions.js` campaña (21 misiones) y objetivos · `js/vehicles.js` vehículos · `js/entities.js` comandos e IA enemiga · `js/models.js` materiales, edificios, objetos y vegetación · `js/characters.js` soldados animados
- `js/render3d.js` escena, postprocesado, suelo, hierba, agua, partículas · `js/assets.js` carga de recursos
- `js/items.js` inventario y objetos · `js/input.js` controles · `js/hud.js` interfaz, mochila, mapa táctico
- `js/hudart.js` iconos y retratos · `js/audio.js` sonido · `js/main.js` reglas, bucle, guardado
- `vendor/three.min.js`, `vendor/three-extras.js` Three.js r147 · `assets/textures.js`, `assets/models.js` recursos incrustados
