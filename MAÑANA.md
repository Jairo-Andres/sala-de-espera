# MAÑANA · La sala de espera (trabajo de la noche del 2026-10-05)

## Qué construí

Dashboard **"La sala de espera"** en `sala-de-espera/` (React 18 + Vite 5 + Tailwind 3), que consume la API real
`https://datos-abiertos-citas-api.onrender.com` (`/estado`, `/hospitales`, `/oportunidad`). No desplegué ni hice push:
solo un commit local.

Recorrido de la página:

1. **Portada + turnero:** pantalla oscura tipo turno digital ("Turno 001 · Anestesiología · 20,0 días"). Cada turno es el
   último promedio publicado por una unidad para una especialidad, con su periodo y enlace a la fuente. Avanza solo cada 6 s,
   con botones anterior/siguiente/pausar; se detiene al pasar el mouse o con foco, y no se mueve con reduced motion.
   Mientras la API despierta se ve el componente **"Cargando datos…"** de la identidad (tren con 3 paradas y botón Reintentar).
2. **Capítulo 1:** las 9 unidades (4 hospitales, 1 red, 4 subredes), sus periodos, registros y enlace a cada fuente.
3. **Capítulo 2 "Cada reloj marca distinto":** un reloj de 12 meses por unidad; la cuña muestra cuánto abarca un dato (1, 3 o 6
   meses). Agrupa unidades que miden igual (las 4 subredes de Bogotá) y dice si la definición es verificada, explícita, según
   metadato o **asumida**.
4. **Capítulo 3 "La fila":** sala de 30 sillas por unidad; cada silla ocupada es un día de espera (último dato por especialidad).
5. **Explora:** pestañas Evolución (líneas, hasta 6 especialidades, tooltip y tabla), Por especialidad (barras con periodo y
   marca △ si la definición es asumida) y Por mes (mapa año × mes con el valor escrito en cada celda, escala desde 0).
   Debajo, la nota **"Antes de sacar conclusiones"** (los hospitales miden distinto, diferencias pequeñas no significan mucho, etc.).
6. **Archivo Clicsalud 2016–2021:** se elige departamento y especialidad (medicina general u odontología) y muestra promedio
   ponderado por citas y mediana entre IPS por periodo, con tabla. Separado y con aviso: es histórico, mezcla IPS públicas y
   privadas, y no se compara con los hospitales.
7. **Fuentes:** enlace a la fuente de cada unidad, licencias, última carga del ETL, API y LinkedIn.

Bilingüe ES/EN (botón arriba a la derecha, también `?lang=en`), modo claro/oscuro según el sistema.
Pruebas: `npm test` (10 pruebas de vitest sobre las funciones de datos, con fixtures). Script de autoevaluación:
`scripts/auditar.mjs`.

## Capturas finales (ciclo 3)

En `docs/capturas/`:

- Inicio: `390-light-es-inicio.png`, `390-light-en-inicio.png`, `390-dark-es-inicio.png`, `1280-light-es-inicio.png`, `1280-light-en-inicio.png`, `1280-dark-es-inicio.png`
- Página completa: `390-light-es-completa.png`, `1280-light-es-completa.png`, `1280-dark-es-completa.png`
- Pestañas: `*-tab-especialidad.png`, `*-tab-mes.png` (claro y oscuro, 390 y 1280)
- Archivo Clicsalud (Amazonas): `390-light-es-archivo.png`, `1280-light-es-archivo.png`
- Estado "Cargando datos": `390-light-es-cargando.png`

Las capturas de los ciclos 1 y 2 quedaron en `capturas/` (ignorada por git).

## Resultados de axe (WCAG 2.1 A y AA)

| Ciclo | Resultado | Qué se corrigió |
|---|---|---|
| 1 | 2 reglas: `link-in-text-block` (enlaces sin subrayado dentro de texto) y `scrollable-region-focusable` (tablas con scroll) | Enlaces subrayados; tablas con scroll ahora enfocables con `role="region"` |
| 2 | **0 incumplimientos** en 13 vistas | — |
| 3 | **0 incumplimientos** en 17 vistas (390/1280, claro/oscuro, ES/EN, pestañas, archivo y estado de carga) | — |

Detalle: `docs/capturas/axe.json`. Ojo: axe no lo cubre todo (por ejemplo, el orden de lectura o qué tan claro es el texto);
falta una pasada con lector de pantalla.

## Decisiones de diseño

- **Sin ranking único.** Las unidades miden distinto (periodo y definición), así que el capítulo 2 lo explica antes de cualquier
  gráfico y las comparaciones entre unidades llevan periodo y marca de definición asumida.
- **El turnero va en la portada** para que en 5 segundos se entienda de qué va: un número de días real y de dónde sale.
  El número de turno solo ordena la lista (lo dice la nota del turnero).
- **Turnero siempre oscuro** (como una pantalla real) con los dígitos en el amarillo de la ruta D, que sobre oscuro sí tiene contraste.
  En fondo claro el amarillo no se usa como texto ni como barra: uso `--ink-d` (#7A5B00), como pide la guía.
- **Relojes en vez de relojes decorativos:** cada reloj dice algo (cuánto del año abarca un dato), en lugar de ser adorno.
- **La fila con 30 sillas fijas:** con los datos actuales los valores de una especialidad suelen estar entre 3 y 6 días; con una sala
  fija se ve la proporción y no solo una hilera corta.
- **Mapa por mes con escala desde 0:** en el ciclo 2 la escala iba del mínimo al máximo y en Aguadas una diferencia de 0,6 días
  se veía como de claro a oscuro. Lo cambié para no exagerar.
- **Clicsalud aparte:** es otra fuente, termina en 2021 y no distingue públicas de privadas. Resumirlo por departamento (ponderado por
  citas + mediana) es un cálculo mío sobre los datos de la API, y la página lo dice. La lista de departamentos la saqué de
  `/hospitales?tipo=ips` hoy.
- **Gráficos en SVG propio** (sin librería) para controlar contraste, etiquetas directas y tamaño en móvil; el bundle queda en ~63 kB gzip.

## Suposiciones (por confirmar)

- La identidad visual no estaba en la carpeta `identidad-visual/` de tu equipo (la carpeta no existe). Copié **sin modificar**
  `tokens.css`, `components.css`, `tailwind.config.js` y los favicons desde `identidad-visual-v1.zip` de la biblioteca del proyecto.
  Mis ajustes van aparte en `src/index.css` (por ejemplo, `.ja-card { grid-template-columns: minmax(0, 1fr) }` para que los
  gráficos no desborden en móvil).
- El enlace "Código" del pie apunta a `github.com/Jairo-Andres/datos-abiertos-citas-api` (el del badge del README de la API).
  El repo de este dashboard aún no existe en GitHub; cuando lo subas, conviene añadir su enlace.
- Licencia MIT con el mismo titular que la API ("Jairo Andrés").

## Qué falta

- **Desplegar en Vercel** y subir el repo con GitHub Desktop (no hice push ni deploy, como pediste).
- Probar con lector de pantalla (NVDA o TalkBack) y con zoom al 200 %.
- En móvil el turnero queda a media pantalla al abrir; se podría acortar el texto de la portada para que se vea completo.
- El título "La sala de espera" aparece dos veces arriba en móvil (cabecera y portada); se podría ocultar en la cabecera hasta hacer scroll.
- Imagen para compartir en LinkedIn (`og:image`) y metadatos Open Graph.
- Si la API cambia nombres de departamentos, actualizar la lista de `Clicsalud.jsx` (o pedirle a la API un endpoint `/departamentos`).
- Post de LinkedIn: aún no hay una "conclusión principal" que los datos sostengan como titular; lo honesto hoy es el hallazgo de que
  cada hospital mide distinto y que pocos publican.
