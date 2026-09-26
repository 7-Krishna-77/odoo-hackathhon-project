/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          900: '#0b0f1a', // deep slate-900 background
          800: '#111827',
        },
        panel: {
          800: 'rgba(30, 35, 51, 0.55)', // charcoal-800 glass
          border: 'rgba(148, 163, 184, 0.12)',
        },
        indigo: {
          accent: '#6366f1', // electric indigo
          soft: 'rgba(99, 102, 241, 0.15)',
        },
        emerald: {
          pill: '#10b981',
          soft: 'rgba(16, 185, 129, 0.15)',
        },
        amber: {
          warn: '#f59e0b',
          soft: 'rgba(245, 158, 11, 0.15)',
        },
        crimson: {
          bad: '#ef4444',
          soft: 'rgba(239, 68, 68, 0.15)',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        glow: '0 0 20px rgba(99, 102, 241, 0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
