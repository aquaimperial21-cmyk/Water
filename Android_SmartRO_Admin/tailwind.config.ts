import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0E7C66',
          dark: '#0a5d4d',
          light: '#e9f5f1',
        },
        ink: {
          DEFAULT: '#0F1B2D',
          muted: '#6B7585',
        },
        line: '#E4E9EE',
        canvas: '#F7F9FB',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica', 'Arial'],
      },
    },
  },
  plugins: [],
};
export default config;
