/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'shine': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        /* Loader animations */
        'loader-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'loader-pulse-ring': {
          '0%': { opacity: '0.6', transform: 'scale(0.85)' },
          '50%': { opacity: '0.2', transform: 'scale(1.1)' },
          '100%': { opacity: '0.6', transform: 'scale(0.85)' },
        },
        'loader-dot': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        'loader-shimmer': {
          '0%': { backgroundPosition: '100% 0' },
          '100%': { backgroundPosition: '-100% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'scale-in': 'scale-in 0.35s ease-out forwards',
        'float': 'float 4s ease-in-out infinite',
        'shine': 'shine 2.5s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 1.5s ease-in-out infinite',
        'bounce-in': 'bounce-in 0.5s ease-out forwards',
        'loader-spin': 'loader-spin 0.85s cubic-bezier(0.5, 0, 0.5, 1) infinite',
        'loader-pulse-ring': 'loader-pulse-ring 2s ease-in-out infinite',
        'loader-dot': 'loader-dot 1.2s ease-in-out infinite both',
        'loader-shimmer': 'loader-shimmer 1.8s ease-in-out infinite',
      },
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
