/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Paleta atlética sobre fondo azul-negro: lima como color de acción y
        // cian como secundario. El lima es muy claro, así que todo lo que va
        // encima suyo usa `onAccent` (casi negro) en vez de blanco.
        bg:               '#0f131c',
        surface:          '#0f131c',
        surfaceLowest:    '#0a0e16',
        surfaceLow:       '#181c24',
        surfaceContainer: '#1c2028',
        surfaceHigh:      '#262a33',
        surfaceHighest:   '#31353e',
        border:           '#2a2f3a',
        text:             '#dfe2ee',
        textSecondary:    '#9ba2b4',
        textTertiary:     '#767d8d',
        accent:           '#c3f400',
        accentDim:        '#abd600',
        onAccent:         '#161e00',
        cyan:             '#00dbe9',
        cyanSoft:         '#7df4ff',
        // Semánticos de estado de cuota: al día = lima, por vencer = cian,
        // vencido = rojo.
        success:          '#c3f400',
        warning:          '#00dbe9',
        danger:           '#ffb4ab',
        dangerStrong:     '#93000a',
      },
      letterSpacing: {
        caps: '0.08em',
      },
      boxShadow: {
        glow:      '0 0 12px rgba(195, 244, 0, 0.35)',
        glowSoft:  '0 0 8px rgba(195, 244, 0, 0.25)',
        glowCyan:  '0 0 8px rgba(0, 219, 233, 0.35)',
      },
    },
  },
  plugins: [],
};
