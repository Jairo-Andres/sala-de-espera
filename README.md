# La sala de espera · oportunidad de citas en Colombia

**Español** · [English](#english)

¿Cuántos días espera un paciente por una cita médica en Colombia? Algunos hospitales públicos lo publican en datos abiertos, cada uno a su manera. Este dashboard muestra lo que dicen esos datos, unificados por la [API de datos abiertos](https://github.com/Jairo-Andres/datos-abiertos-citas-api), sin sacar conclusiones que los datos no sostienen.

```
datos.gov.co y portal de Bogotá → ETL (pandas) → API FastAPI (Render) → este dashboard (React + Vite + Tailwind, Vercel)
```

- **Demo:** https://sala-de-espera-bice.vercel.app
- **API:** https://datos-abiertos-citas-api.onrender.com ([docs](https://datos-abiertos-citas-api.onrender.com/docs))

## Qué muestra

Arriba hay un **selector de periodo** (Desde 2023, por defecto; Desde 2020; Todo) que se pasa a la API como `desde_anio` y filtra toda la sala salvo el Archivo Clicsalud. Los datos con más de un año llevan la marca **"Dato de AAAA"**. Si la última carga del ETL tiene fuentes caídas o más de 8 días, aparece un aviso; en el pie, el estado de la carga ("Al día", fecha y fuentes ok).

1. **Tu ciudad:** promedio por especialidad en la ciudad elegida (Bogotá por defecto), con `/resumen`. Dice si es ponderado por citas o promedio simple (Bogotá no publica citas).
1. **Quién espera más:** con `/ranking`, un bloque por especialidad, definición y periodo (nunca un ranking único), con el periodo de cada dato. Las series con una sola unidad van aparte, en una tabla.
1. **Hallazgos ("Lo que sí dicen los datos"):** 4 tarjetas calculadas en vivo que solo comparan una unidad consigo misma o con la norma: la mayor brecha entre especialidades del mismo hospital, el mayor aumento de una misma serie, cuántos datos de medicina general y odontología están dentro del plazo de 3 días hábiles de la Resolución 1552 de 2013 y cuántas unidades publican. Promedios anuales ponderados por citas, solo años completos.
1. **Turnero:** cada turno es un dato real (el último promedio publicado por una unidad para una especialidad), con su periodo y enlace a la fuente.
2. **Capítulo 1:** las unidades incluidas (hospitales, red y subredes), su periodo cubierto y su fuente.
3. **Capítulo 2, "Cada reloj marca distinto":** cómo mide cada unidad (mes, trimestre o semestre; desde la solicitud o desde la fecha deseada; si la definición es explícita o asumida).
4. **Capítulo 3, "La fila":** una silla por cada día de espera, último dato de cada unidad para la especialidad elegida.
5. **Explora:** evolución en el tiempo, comparación por especialidad y mapa por mes, cada uno con su tabla.
6. **Archivo Clicsalud (2016–2021):** por departamento y ciudad (listas que vienen de la API), lo que reportaron las IPS en cada trimestre o semestre: promedio ponderado por citas, citas, número de IPS y mediana entre IPS, en una sola llamada a `/resumen?agrupar_por=periodo`. Lleva el sello "Histórico 2016–2021" según el campo `historico` de la API.

Llamadas a la API al cargar: `/estado`, `/hospitales?tipo=hospital,red,subred`, `/oportunidad?tipo=hospital,red,subred&desde_anio=…` (solo el periodo elegido) y `/ranking`. Tu ciudad y el Archivo piden `/resumen` por su cuenta. Requiere la versión de la API que acepta `tipo` con varios valores y `mediana_unidades` (commits 0b3bbb6 y 9198087 del repo de la API): **despliega primero la API**.

Diseño "La sala de espera" con la identidad visual común del portafolio ("Rutas + Cota", ruta **D** Datos). Mobile-first, bilingüe (ES/EN), modo claro y oscuro según el sistema, y respeta `prefers-reduced-motion`.

La imagen para compartir (`public/og.png`) se regenera con `node scripts/og/generar.mjs`.

## Correrlo en local

Requisitos: Node 20 o superior.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # pruebas de las funciones de datos (vitest)
```

Por defecto usa la API de Render. Para otra URL, copia `.env.example` a `.env` y cambia `VITE_API_URL`.

### Autoevaluación (capturas + accesibilidad)

```bash
npm run build
npx vite preview --port 4173      # en otra terminal
node scripts/auditar.mjs capturas/actual
```

Toma capturas a 390 px y 1280 px (claro, oscuro, ES y EN) y pasa axe-core con las reglas WCAG 2.1 A y AA. Las capturas y el resultado de la última ejecución están en [`docs/capturas/`](docs/capturas/).

## Despliegue (Vercel, plan Hobby)

1. *Add New → Project*, importa este repo. Vercel detecta Vite: build `npm run build`, salida `dist`.
2. (Opcional) En *Environment Variables*, `VITE_API_URL` con la URL de la API.
3. Deploy. No hay secretos: la API es pública y de solo lectura.

## Qué revisar si algo se cae

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "Cargando datos…" tarda hasta un minuto | Render duerme la API tras ~15 min sin uso | Es normal. Antes de una demo, abre la API un minuto antes |
| "No pudimos traer los datos" | La API no despertó a tiempo, o Supabase pausó la base | Pulsa *Reintentar*. Si sigue, revisa `/health` de la API y su README |
| Error de CORS en la consola | La API dejó de enviar `Access-Control-Allow-Origin` | Revisa la configuración de CORS en la API |
| El archivo Clicsalud no muestra departamentos o ciudades | `/resumen` no respondió | Revisa `/resumen?agrupar_por=departamento&tipo=ips` en la API |
| Todo falla con HTTP 422 | La API desplegada es anterior a `tipo` con varios valores | Despliega la última versión de la API en Render |
| Aviso amarillo de datos viejos o fuentes caídas | El ETL semanal falló o Supabase se pausó | Sigue "Qué revisar si algo se cae" en el README de la API |
| Las fuentes tipográficas se ven distintas | Google Fonts bloqueado | El sitio usa la fuente de respaldo; no afecta los datos |

## La sala de las EPS (`#eps`)

Segunda sala: los días que **Nueva EPS**, **Salud Total** y **EPS Sura** reportan cada mes para asignar citas (Resolución 1552 de 2013), comparados con los estándares de referencia de la Circular Externa 038 de 2025. La interfaz solo lee `public/data/eps/sala-eps.json`; nunca descarga nada de las EPS en vivo.

```
página índice de Nueva EPS + PDF acumulado de Sura → pipeline/eps (Python) → data/eps (CSV por EPS y año + estado de fuentes) → public/data/eps/sala-eps.json → sala
```

- **Pipeline:** `pip install -r pipeline/requirements.txt` (y Poppler para `pdftotext`), luego `python -m pipeline.eps.run`. Opciones: `--dry-run`, `--offline` (solo caché), `--incremental` (reutiliza los meses ya publicados de Nueva EPS).
- **Salud Total:** publica una fila por clínica; la sala suma solo consultas de primera vez del PBS y calcula Σ días / Σ citas por departamento y a nivel nacional. Se lee desde octubre de 2024 (formato por IPS); los meses anteriores y los PDF de red aliada de enero y febrero de 2025 usan otro formato y quedan registrados como no soportados.
- **Validación:** promedios recalculados desde las sumas y contrastados con el PDF (tolerancia 0,05 días o el redondeo de la fuente), días negativos, cero citas, filas incompletas o repetidas, departamentos y especialidades no reconocidos, meses fuera de secuencia, saltos mes a mes y contraste con el total nacional. Lo bloqueante se publica como "sin dato" con su motivo; nada se corrige en silencio.
- **Pruebas:** `python -m pytest pipeline/eps/tests` (PDF reales como fixtures, que no se versionan: `python -m pipeline.eps.tests.bajar_fixtures`) y `npm test`.
- **Automatización:** `.github/workflows/eps-datos.yml` corre los días 12 y 20 de cada mes. Es *dry-run* hasta que la variable del repositorio `EPS_PUBLICAR` sea `true`.
- **Uso de las fuentes:** robots.txt de ambos sitios permite el acceso. Solo se publican cifras agregadas que la norma obliga a hacer públicas, con enlace a cada PDF; los PDF no se vuelven a publicar. User-Agent identificable y pausas entre peticiones.
- **Vista previa y accesibilidad:** `node scripts/auditar-eps.mjs capturas/eps` (capturas 1440/390, ES/EN, estados especiales y axe-core).

### Qué revisar si algo se cae (sala EPS)

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El workflow falla con "cambió de formato" | Una EPS cambió las columnas del PDF | Revisa `data/eps/estado_fuentes.json` y ajusta el parser; la sala sigue con lo último validado |
| "Falló la última revisión" en Salud de las fuentes | La página no respondió o bloqueó el acceso | Espera al reintento del día 20; si sigue, revisa la URL en `pipeline/eps/config.py` |
| Nueva EPS dice "no respondió a la revisión automática" | Cloudflare de Nueva EPS responde 403 a las IP de GitHub Actions (desde oct. 2026); desde un equipo normal responde 200 | La sala conserva el último dato bueno. Una vez al mes corre `python -m pipeline.eps.run --incremental` en tu equipo y sube los cambios de `data/eps` y `public/data/eps`. No se usan proxies ni cabeceras falsas |
| Falta contributivo de enero de 2022 en Nueva EPS | El PDF de la EPS responde 404 | No hay arreglo de nuestro lado; queda como "sin dato" |
| Aparece un mes con "sin dato" | No pasó una regla bloqueante | Es intencional; el motivo está en la bandera del registro |

## Licencia

Código bajo licencia MIT. Los datos son de cada entidad vía datos.gov.co (CC BY-SA 4.0) y el portal de datos abiertos de Bogotá (CC BY 4.0).

---

## English

How many days does a patient wait for a medical appointment in Colombia? Some public hospitals publish it as open data, each in its own way. This dashboard shows what that data says, unified by the [open-data API](https://github.com/Jairo-Andres/datos-abiertos-citas-api), without drawing conclusions the data can't support.

- **Demo:** https://sala-de-espera-bice.vercel.app
- **API:** https://datos-abiertos-citas-api.onrender.com ([docs](https://datos-abiertos-citas-api.onrender.com/docs))

### What it shows

At the top, a **period selector** (Since 2023, the default; Since 2020; All) is sent to the API as `desde_anio` and filters the whole room except the Clicsalud archive. Values more than a year old carry a **"Data from YYYY"** tag. If the last ETL run had failing sources or is older than 8 days, a warning appears; the footer shows the load status ("Up to date", date and sources ok).

1. **Your city:** average per specialty in the chosen city (Bogotá by default), from `/resumen`. It says whether it is weighted by appointments or a simple average (Bogotá does not publish appointment counts).
1. **Who waits longest:** from `/ranking`, one block per specialty, definition and period length (never a single ranking), with the period of each value. Series with a single unit are listed separately in a table.
1. **Findings ("What the data does show"):** 4 live cards that only compare a unit with itself or with the regulation: the largest gap between specialties in the same hospital, the largest increase in one series, how many general medicine and dentistry values are within the 3-business-day limit of Resolution 1552 of 2013, and how many units publish. Yearly averages weighted by appointments, complete years only.
1. **Queue display:** every ticket is real data (the latest average a unit published for a specialty), with its period and a link to the source.
2. **Chapter 1:** the units included (hospitals, a network and sub-networks), their period and source.
3. **Chapter 2, "Every clock ticks differently":** how each unit measures (month, quarter or half-year; from the request or from the desired date; explicit or assumed definition).
4. **Chapter 3, "The queue":** one chair per day of waiting, latest value per unit for the chosen specialty.
5. **Explore:** trend over time, comparison by specialty and a month-by-month map, each with its data table.
6. **Clicsalud archive (2016–2021):** by department and city (lists come from the API), what providers reported each quarter or half-year: appointment-weighted average, appointments, number of providers and median across providers, in a single call to `/resumen?agrupar_por=periodo`. It carries the "Historical 2016–2021" seal based on the API's `historico` field.

Requires the API version that accepts several comma-separated `tipo` values and returns `mediana_unidades`: **deploy the API first**.

Shares the portfolio's visual identity ("Rutas + Cota", route **D** Data). Mobile-first, bilingual (ES/EN), light and dark mode, and respects `prefers-reduced-motion`.

### Run locally

```bash
npm install
npm run dev
npm test
```

Uses the Render API by default; set `VITE_API_URL` in `.env` to change it.

Self-check: `npm run build`, then `npx vite preview --port 4173` and `node scripts/auditar.mjs capturas/actual` (screenshots at 390 and 1280 px plus axe-core, WCAG 2.1 A/AA). Latest results: [`docs/capturas/`](docs/capturas/).

### Deployment (Vercel, Hobby plan)

Import the repo in Vercel (Vite is detected: `npm run build`, output `dist`), optionally set `VITE_API_URL`, and deploy. There are no secrets.

### What to check if something goes down

| Symptom | Likely cause | What to do |
|---|---|---|
| "Loading data…" takes up to a minute | Render sleeps the API after ~15 idle minutes | Expected. Open the API a minute before a demo |
| "We couldn't load the data" | The API didn't wake up in time, or Supabase paused the database | Press *Try again*; then check the API's `/health` and README |
| CORS error in the console | The API stopped sending `Access-Control-Allow-Origin` | Check the API's CORS settings |
| The Clicsalud archive shows no departments or cities | `/resumen` did not respond | Check `/resumen?agrupar_por=departamento&tipo=ips` on the API |
| Everything fails with HTTP 422 | The deployed API predates multi-value `tipo` | Deploy the latest API version on Render |
| Yellow warning about stale data or failing sources | The weekly ETL failed or Supabase paused | Follow "What to check if something goes down" in the API README |

### The insurers’ room (`#eps`)

A second room with the monthly waiting days that **Nueva EPS**, **Salud Total** and **EPS Sura** report (Resolution 1552 of 2013), compared with the reference standards of External Circular 038 of 2025. A Python pipeline (`pipeline/eps`) discovers, downloads, parses and validates the PDFs; anything that fails a blocking rule is published as "no data" with its reason. Run it with `python -m pipeline.eps.run` (`--dry-run`, `--offline`, `--incremental`), test it with `python -m pytest pipeline/eps/tests`. The monthly GitHub Actions workflow stays in dry-run until the repository variable `EPS_PUBLICAR` is `true`. Only aggregate figures are published, linking to each original PDF.

If Nueva EPS shows "did not respond to the automated check": its Cloudflare returns 403 to GitHub Actions IPs (since Oct 2026) while a regular computer gets 200. The room keeps the last good data; once a month run `python -m pipeline.eps.run --incremental` locally and push `data/eps` and `public/data/eps`. No proxies or spoofed headers are used. The January 2022 contributivo PDF returns 404 at the source and stays as "no data".

### License

Code under the MIT license. Data belongs to each entity via datos.gov.co (CC BY-SA 4.0) and Bogotá's open data portal (CC BY 4.0).

---

[LinkedIn](https://www.linkedin.com/in/jairo-andres31-analyst)
