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
        canvas: '#F8F9FA',
        rule: '#E5E7EB',
        ink: {
          900: '#0F172A',
          700: '#334155',
          500: '#64748B',
          300: '#94A3B8',
        },
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
        md: '6px',
        lg: '8px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};
export default config;
