import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f3f6fa',
          100: '#e2eaf3',
          200: '#bfd0e3',
          300: '#8aaecb',
          400: '#5687b0',
          500: '#356b96',
          600: '#27557d',
          700: '#1F4E78',
          800: '#1a3e60',
          900: '#152f48',
          950: '#0d1d2c',
        },
        gold: {
          50: '#fdf8ec',
          100: '#faedc6',
          200: '#f5db8b',
          300: '#eec24f',
          400: '#dba82a',
          500: '#BF8F00',
          600: '#a07700',
          700: '#7d5c00',
          800: '#594200',
          900: '#3d2d00',
        },
        success: { DEFAULT: '#548235' },
        warning: { DEFAULT: '#BF7F00' },
        danger: { DEFAULT: '#9C2A2A' },
        canvas: '#F6F7F9',
        surface: '#FFFFFF',
        rule: '#EBEDF0',
        'rule-strong': '#DDE1E6',
        ink: {
          900: '#0F172A',
          700: '#334155',
          500: '#64748B',
          300: '#94A3B8',
        },
      },
      screens: {
        wide: '1440px',
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', '1rem'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.04)',
        'card-hover': '0 2px 4px -1px rgb(15 23 42 / 0.06), 0 4px 12px -2px rgb(15 23 42 / 0.08)',
        pop: '0 4px 12px -2px rgb(15 23 42 / 0.10), 0 8px 24px -4px rgb(15 23 42 / 0.12)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};
export default config;
