# Commandos 3 – Hombres de Valor

Juego de estrategia táctica en tiempo real inspirado en *Commandos 2*, hecho con HTML5 Canvas y JavaScript puro (sin dependencias).

## Cómo jugar
Abre `index.html` en el navegador (o sirve la carpeta con `python3 -m http.server`).

**Misión:** infiltra a los 4 comandos, destruye el depósito de combustible con la carga del Zapador y reúne a todos en la zona de extracción (arriba a la izquierda). Si cae un comando, la misión fracasa.

## Controles (como en Commandos 2)
| Entrada | Acción |
|---|---|
| Clic izquierdo | Seleccionar comando / mover (doble clic o Shift: correr) |
| Arrastrar | Selección múltiple |
| Clic derecho | Ejecutar la acción elegida |
| 1 · 2 · 3 | Elegir acción del comando |
| Espacio | Pausa (se pueden dar órdenes en pausa) |
| F1–F4 / Tab | Seleccionar comando |
| WASD / flechas / bordes / clic central | Cámara; rueda = zoom |
| F5 / F9 | Guardado / carga rápida |
| C | Agacharse / levantarse |
| V | Conos de visión: todos / solo los señalados |
| M | Activar / desactivar sonido |
| Esc / X | Cancelar acción / detener |

## Comandos
- **Boina Verde:** cuchillo silencioso, carga y esconde cuerpos en arbustos.
- **Francotirador:** disparo a larga distancia (ruidoso, 6 balas).
- **Espía:** disfraz, anestesia silenciosa, señuelo sonoro.
- **Zapador:** carga de tiempo y granadas (fuego amigo).

## Mecánicas
- Conos de visión verdes de dos zonas, como en Commandos 2: en la zona clara solo ven a quien va de pie; en la oscura, también a los agachados. Paredes, árboles y vehículos bloquean la vista; los arbustos ocultan.
- Sospecha progresiva (`?`) → alarma (`!`); el ruido y los cuerpos descubiertos atraen a las patrullas.
- Edificios con interior: al entrar un comando, el tejado se retira y se ve el interior.
- Siluetas de los comandos cuando quedan tapados por edificios o árboles.

## Apartado visual (todo generado por código, sin imágenes)
- Terreno pintado píxel a píxel con ruido: hierba, tierra, grava, caminos con rodadas, orillas, río animado y puentes.
- Edificios con fachadas (entramado, ladrillo, madera, hormigón), ventanas con contraventanas y tejados a cuatro aguas de teja, pizarra o chapa.
- Camiones, jeep, tiendas, torres de vigilancia, sacos terreros, cajas, bidones y depósito de combustible.
- Sombras proyectadas, árboles con copa y balanceo, partículas (fuego, humo, restos, fogonazos), bengala de extracción.
- Interfaz con retratos, mochila de acciones, cursor propio y expediente de misión.
- Sonido sintetizado con Web Audio (disparos, explosiones, alarma, ambiente).

## Estructura
- `js/util.js` utilidades · `js/textures.js` ruido y color · `js/level.js` mapa, LOS, A*
- `js/entities.js` comandos e IA enemiga · `js/sprites.js` personajes, edificios, objetos, iconos y retratos
- `js/render.js` terreno, profundidad, partículas · `js/audio.js` sonido · `js/main.js` bucle, entrada, interfaz, guardado
