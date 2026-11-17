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
| Esc / X | Cancelar acción / detener |

## Comandos
- **Boina Verde:** cuchillo silencioso, carga y esconde cuerpos en arbustos.
- **Francotirador:** disparo a larga distancia (ruidoso, 6 balas).
- **Espía:** disfraz, anestesia silenciosa, señuelo sonoro.
- **Zapador:** carga de tiempo y granadas (fuego amigo).

## Mecánicas
- Conos de visión de los guardias, bloqueados por paredes; los arbustos esconden.
- Sospecha progresiva (`?`) → alarma (`!`); el ruido y los cuerpos descubiertos atraen a las patrullas.
- Los enemigos dormidos despiertan pasado un tiempo.
- Búsqueda de caminos A* con suavizado, vista oblicua con profundidad por filas.

## Estructura
- `js/util.js` utilidades · `js/level.js` mapa, LOS, A* · `js/entities.js` comandos e IA enemiga
- `js/render.js` dibujado · `js/main.js` bucle, entrada, HUD, guardado, reglas
