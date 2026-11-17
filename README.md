# Commandos 3 – Hombres de Valor

Juego de estrategia táctica en tiempo real inspirado en *Commandos 2*, en 3D isométrico con Three.js y texturas fotográficas reales (CC0).

## Cómo jugar
Abre `index.html` en el navegador (doble clic). Funciona sin servidor: Three.js y las texturas van incluidos en el repositorio.

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
- `js/hudart.js` iconos y retratos · `js/audio.js` sonido · `js/main.js` bucle, entrada, interfaz, guardado
- `vendor/three.min.js` Three.js r147 (licencia MIT) · `assets/textures.js` texturas CC0
