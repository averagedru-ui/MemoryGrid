/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d0d0f',
          secondary: '#141416',
          tertiary: '#1a1a1f',
          hover: '#1f1f26',
        },
        border: {
          subtle: '#2a2a35',
          DEFAULT: '#3a3a48',
        },
        text: {
          primary: '#e8e8f0',
          secondary: '#9090a8',
          muted: '#60607a',
        },
        accent: {
          purple: '#7c6af7',
          blue: '#4f9ef7',
          cyan: '#00d4ff',
          pink: '#f76af7',
          glow: 'rgba(124, 106, 247, 0.4)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
