# Ronda de UX 1

Slug del problema (no hay ticket). Sale de las primeras pruebas del usuario con la app andando.

## Problema

Probando la app aparecieron cosas que no se entienden o molestan: no se entiende para qué es el
botón "Nota"; metrónomo y teclado son dos botones que abren lo mismo; los marcadores llevan a
una página y no a un lugar ("donde arranca la letra B"). En la revisión general se sumaron: el
aviso "Siguiente" del modo show tapa el último sistema, la barra de anotar tapa la partitura en
celular, "Más opciones" mezcla todo y el recorte se ajusta a ciegas.

## Alcance

Incluye:

1. Barra del lector: un solo botón "Ensayo"; "Nota" solo aparece si la partitura tiene notas de
   inicio; las notas de inicio se graban tocando el teclado; "atrás" dice de dónde venís.
2. Marcadores en un punto de la página (tocás el lugar, le ponés nombre, queda una banderita).
   Al saltar: en vertical va al punto exacto, en paginado la banderita parpadea. El destino de
   un salto puede ser un marcador.
3. Modo show: el aviso "Siguiente" aparece recién al tocar para avanzar en la última página; un
   segundo toque abre la obra siguiente.
4. Barra de anotar en una sola fila (color y grosor en un desplegable).
5. "Más opciones" se parte: ⋯ abre los datos; una hoja "Página" (orden, recorte, mostrar
   anotaciones) que no tapa la partitura, así el recorte se ve en vivo; saltos junto a los
   marcadores; la velocidad de autoscroll va a ajustes de lectura.
6. Detalles: el orden de la biblioteca es un desplegable de verdad; el aviso de instalar se
   puede cerrar; las etiquetas se renombran y borran desde una hoja (también en celular).

7. Modo show: toda la barra de abajo arranca bloqueada y se habilita con un toque de
   confirmación (pedido del usuario durante la implementación: evita tocar algo sin querer en
   escena, pero deja usar las herramientas si se está ensayando la lista). Reemplaza al bloqueo
   que antes era solo de "Anotar".

NO incluye:

- Orden de páginas con miniaturas. El usuario prefiere el texto ("1, 2, 3, 2, 3"): las
  miniaturas de partituras casi no se distinguen y el texto deja repetir páginas fácil.

## Enfoque y por qué

- `Bookmark` suma `x?: number` (opcional, sin índice: no hace falta nueva versión de Dexie).
  `y` ya existía y estaba siempre en 0.
- El modelo de `JumpLink` no cambia: elegir un marcador como destino copia su `page` e `y`.
- La hoja "Página" es no modal (sin fondo oscuro) para ver el recorte mientras se mueve.
- El aviso "Siguiente" cuesta un toque más a cambio de no tapar nunca la música (decisión del
  usuario; la alternativa era un aviso finito arriba que aparece solo).

## Pasos

Los cambios del lector comparten `src/app/ScoreScreen.tsx`, así que salen en un commit; la
biblioteca va en otro.

1. Lector: botón Ensayo, notas de inicio desde el teclado, marcadores en un punto, saltos a
   marcador, aviso "Siguiente" tras el toque, barra de anotar en una fila, hoja "Página",
   barra de abajo bloqueada en modo show.
   Commit: `feat(reader): ronda de UX del lector`
2. Biblioteca: orden desplegable, editar etiquetas, aviso de instalar cerrable.
   Commit: `feat(library): orden desplegable, editar etiquetas y aviso de instalar cerrable`

## Tests

Se actualizan los e2e de lector, lectura avanzada y listas a los flujos nuevos, y se agregan:
marcador en un punto (banderita en la página y scroll al punto en vertical), salto a marcador,
grabar notas de inicio desde el teclado, renombrar etiqueta, cerrar el aviso de instalar.

## Riesgos

- El toque extra en modo show puede sentirse lento en escena: se valida en un ensayo real.
- Sigue sin probarse en dispositivo: lápiz, audio en silencio, gestos táctiles.

## Decisiones abiertas

Ninguna.
