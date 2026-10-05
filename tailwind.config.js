/**
 * Jairo Andrés · Sistema de diseño "Rutas + Cota" v1.0
 *
 * Tailwind CSS v3. En Tailwind v4 se usa igual con:
 *   @import "tailwindcss";
 *   @config "./tailwind.config.js";
 *
 * Los colores apuntan a las variables de tokens.css, así que el modo oscuro
 * cambia solo (sistema o <html data-theme="dark">) sin escribir clases dark:.
 * Importa tokens.css antes que Tailwind.
 *
 * Nota: los colores con var() no admiten modificadores de opacidad (bg-fondo/50).
 * Los colores de marca fijos (marca.*) sí, porque son hex.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        marca: {
          grafito: '#1A1D21',
          b: '#1959D1',
          d: '#F2B705',
          q: '#C2185B',
          cota: '#8A5A2B',
        },
        fondo: 'var(--color-bg)',
        superficie: {
          DEFAULT: 'var(--color-surface)',
          2: 'var(--color-surface-2)',
        },
        borde: {
          DEFAULT: 'var(--color-border)',
          fuerte: 'var(--color-border-strong)',
        },
        texto: {
          DEFAULT: 'var(--color-fg)',
          suave: 'var(--color-fg-muted)',
        },
        acento: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          sobre: 'var(--color-on-accent)',
        },
        foco: 'var(--color-focus)',
        cota: 'var(--color-cota)',
        ruta: {
          b: 'var(--route-b)',
          d: 'var(--route-d)',
          q: 'var(--route-q)',
          'sobre-b': 'var(--on-route-b)',
          'sobre-d': 'var(--on-route-d)',
          'sobre-q': 'var(--on-route-q)',
        },
        tinta: {
          b: 'var(--ink-b)',
          d: 'var(--ink-d)',
          q: 'var(--ink-q)',
        },
        estado: {
          bueno: 'var(--status-good)',
          'bueno-fondo': 'var(--status-good-bg)',
          regular: 'var(--status-warn)',
          'regular-punto': 'var(--status-warn-dot)',
          'regular-fondo': 'var(--status-warn-bg)',
          malo: 'var(--status-bad)',
          'malo-fondo': 'var(--status-bad-bg)',
        },
        grafico: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          6: 'var(--chart-6)',
          rejilla: 'var(--chart-grid)',
          eje: 'var(--chart-axis)',
        },
        secuencial: {
          100: 'var(--seq-100)',
          200: 'var(--seq-200)',
          300: 'var(--seq-300)',
          400: 'var(--seq-400)',
          500: 'var(--seq-500)',
          600: 'var(--seq-600)',
          700: 'var(--seq-700)',
        },
      },
      fontFamily: {
        display: ['Overpass', '"Arial Narrow"', 'Arial', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible"', '"Atkinson Hyperlegible Next"', 'Verdana', 'system-ui', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono"', 'ui-monospace', '"Cascadia Mono"', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.4' }],
        sm: ['0.875rem', { lineHeight: '1.45' }],
        base: ['1rem', { lineHeight: '1.55' }],
        md: ['1.125rem', { lineHeight: '1.5' }],
        lg: ['1.25rem', { lineHeight: '1.4' }],
        xl: ['1.5625rem', { lineHeight: '1.3' }],
        '2xl': ['1.953rem', { lineHeight: '1.2' }],
        '3xl': ['2.441rem', { lineHeight: '1.1' }],
        '4xl': ['3.052rem', { lineHeight: '1.1' }],
        display: ['clamp(2.441rem, 6vw + 1rem, 4.768rem)', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
      },
      letterSpacing: {
        display: '-0.015em',
        label: '0.08em',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '14px',
        senal: '25%',
      },
      borderWidth: {
        ruta: '6px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      maxWidth: {
        contenido: '72rem',
      },
      minHeight: {
        tap: '2.75rem',
      },
      minWidth: {
        tap: '2.75rem',
      },
      backgroundImage: {
        topo: 'var(--texture-topo)',
      },
      transitionDuration: {
        rapido: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        lento: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        salida: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
