import { useLang } from '../lib/i18n.js';
import { API_URL } from '../lib/api.js';

export default function Pie({ estado, unidades }) {
  const { t, lang } = useLang();
  const lista = unidades ? [...unidades.values()].sort((a, b) => a.corto.localeCompare(b.corto, 'es')) : [];
  const carga = estado?.ultima_carga_etl?.fecha;
  return (
    <footer className="bg-superficie" aria-labelledby="fuentes-titulo">
      <div className="mx-auto grid max-w-contenido gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 id="fuentes-titulo" className="text-2xl">{t.fuentesTitulo}</h2>
          <p className="mt-3 max-w-xl text-texto-suave">{t.fuentesTexto}</p>
          {lista.length > 0 && (
            <ul className="mt-5 grid gap-2 text-sm">
              {lista.map((u) => (
                <li key={u.id}>
                  <a href={u.fuente_url} target="_blank" rel="noreferrer">{u.nombre}</a>
                  <span className="text-texto-suave"> · {u.municipio}, {u.departamento}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid content-start gap-4 text-sm">
          <p>
            <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer" className="font-bold">{t.api}</a>
            {carga && (
              <span className="mt-1 block font-mono text-texto-suave">
                {t.ultimaCarga}: {new Date(carga).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            )}
          </p>
          <p>
            <a href="https://github.com/Jairo-Andres/datos-abiertos-citas-api" target="_blank" rel="noreferrer">{t.codigo} (API + ETL)</a>
          </p>
          <p className="flex items-center gap-2 border-t border-borde pt-4">
            <span className="ja-bullet ja-bullet--d" aria-hidden="true">D</span>
            <span>
              {t.hecho} ·{' '}
              <a href="https://www.linkedin.com/in/jairo-andres31-analyst" target="_blank" rel="noreferrer">{t.linkedin}</a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
