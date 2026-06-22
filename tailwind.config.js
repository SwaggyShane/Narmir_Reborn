/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/src/**/*.{js,jsx,ts,tsx}",
    "./client/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark Fantasy Core Palette
        void: {
          950: '#0a0a0a',
          900: '#111111',
          850: '#1a1a1a',
          800: '#222222',
        },
        blood: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        ember: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        shadow: {
          400: '#64748b',
          500: '#475569',
          600: '#334155',
        },
        arcane: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
      },
      fontFamily: {
        serif: ['Cinzel', 'Playfair Display', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-ember': '0 0 15px -3px rgb(249 115 22 / 0.5)',
        'glow-blood': '0 0 15px -3px rgb(239 68 68 / 0.5)',
        'glow-arcane': '0 0 15px -3px rgb(139 92 246 / 0.5)',
      }
    },
  },
  plugins: [],
}
