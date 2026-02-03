/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        careplus: {
          primary: 'var(--brand-primary, #0d9488)',
          secondary: 'var(--brand-secondary, #0f766e)',
          accent: 'var(--brand-primary, #14b8a6)',
        },
        theme: {
          bg: 'var(--theme-bg)',
          'bg-elevated': 'var(--theme-bg-elevated)',
          surface: 'var(--theme-surface)',
          'surface-hover': 'var(--theme-surface-hover)',
          border: 'var(--theme-border)',
          'border-subtle': 'var(--theme-border-subtle)',
          text: 'var(--theme-text)',
          'text-secondary': 'var(--theme-text-secondary)',
          muted: 'var(--theme-text-muted)',
          'text-inverse': 'var(--theme-text-inverse)',
          'input-bg': 'var(--theme-input-bg)',
          'input-border': 'var(--theme-input-border)',
          'focus-ring': 'var(--theme-focus-ring)',
        },
      },
    },
  },
  plugins: [],
};
