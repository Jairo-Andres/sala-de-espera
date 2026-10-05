# La sala de espera · oportunidad de citas en Colombia

**Español** · [English](#english)

¿Cuántos días espera un paciente por una cita médica en Colombia? Algunos hospitales públicos lo publican en datos abiertos, cada uno a su manera. Este dashboard muestra lo que dicen esos datos, unificados por la [API de datos abiertos](https://github.com/Jairo-Andres/datos-abiertos-citas-api), sin sacar conclusiones que los datos no sostienen.

```
datos.gov.co y portal de Bogotá → ETL (pandas) → API FastAPI (Render) → este dashboard (React + Vite + Tailwind, Vercel)
```

- **Demo:** pendiente de desplegar en Vercel.
- **API:** https://datos-abiertos-citas-api.onrender.com ([docs](https://datos-abiertos-citas-api.onrender.com/docs))

## Qué muestra

1. **Turnero:** cada turno es un dato real (el último promedio publicado por una unidad para una especialidad), con su periodo y enlace a la fuente.
2. **Capítulo 1:** las unidades incluidas (hospitales, red y subredes), su periodo cubierto y su fuente.
3. **Capítulo 2, "Cada reloj marca distinto":** cómo mide cada unidad (mes, trimestre o semestre; desde la solicitud o desde la fecha deseada; si la definición es explícita o asumida).
4. **Capítulo 3, "La fila":** una silla por cada día de espera, último dato de cada unidad para la especialidad elegida.
5. **Explora:** evolución en el tiempo, comparación por especialidad y mapa por mes, cada uno con su tabla.
6. **Archivo Clicsalud (2016–2021):** resumen por departamento de lo que reportaron las IPS (promedio ponderado por citas y mediana), separado del resto porque es otra fuente y es histórica.

Diseño "La sala de espera" con la identidad visual común del portafolio ("Rutas + Cota", ruta **D** Datos). Mobile-first, bilingüe (ES/EN), modo claro y oscuro según el sistema, y respeta `prefers-reduced-motion`.

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
| El archivo Clicsalud no muestra un departamento | El nombre cambió en la API | Actualiza la lista `DEPARTAMENTOS` en `src/components/Clicsalud.jsx` |
| Las fuentes tipográficas se ven distintas | Google Fonts bloqueado | El sitio usa la fuente de respaldo; no afecta los datos |

## Licencia

Código bajo licencia MIT. Los datos son de cada entidad vía datos.gov.co (CC BY-SA 4.0) y el portal de datos abiertos de Bogotá (CC BY 4.0).

---

## English

How many days does a patient wait for a medical appointment in Colombia? Some public hospitals publish it as open data, each in its own way. This dashboard shows what that data says, unified by the [open-data API](https://github.com/Jairo-Andres/datos-abiertos-citas-api), without drawing conclusions the data can't support.

- **Demo:** not deployed to Vercel yet.
- **API:** https://datos-abiertos-citas-api.onrender.com ([docs](https://datos-abiertos-citas-api.onrender.com/docs))

### What it shows

1. **Queue display:** every ticket is real data (the latest average a unit published for a specialty), with its period and a link to the source.
2. **Chapter 1:** the units included (hospitals, a network and sub-networks), their period and source.
3. **Chapter 2, "Every clock ticks differently":** how each unit measures (month, quarter or half-year; from the request or from the desired date; explicit or assumed definition).
4. **Chapter 3, "The queue":** one chair per day of waiting, latest value per unit for the chosen specialty.
5. **Explore:** trend over time, comparison by specialty and a month-by-month map, each with its data table.
6. **Clicsalud archive (2016–2021):** per-department summary of what providers reported (appointment-weighted average and median), kept apart because it is a different, historical source.

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
| A department doesn't load in the Clicsalud archive | Its name changed in the API | Update `DEPARTAMENTOS` in `src/components/Clicsalud.jsx` |

### License

Code under the MIT license. Data belongs to each entity via datos.gov.co (CC BY-SA 4.0) and Bogotá's open data portal (CC BY 4.0).

---

[LinkedIn](https://www.linkedin.com/in/jairo-andres31-analyst)
