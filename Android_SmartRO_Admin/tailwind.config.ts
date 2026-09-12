import type { Config } from 'tailwindcss';

// ImperialAqua palette — mirrors smartro-water/src/index.css 1:1 so admin
// and customer share the exact same hex values.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand cyan-blue (primary)
        brand: {
          DEFAULT: '#23BAFB',
          glow: '#66D9FF',
          soft: '#E1F6FE',
          tint: '#F0FAFF',
          ink: '#06386B',
          dark: '#0888CC',
        },
        // Companion brand-blue (deeper)
        deep: {
          DEFAULT: '#2A74F4',
          soft: '#E7EFFE',
        },
        // Ink — text colors
        ink: {
          DEFAULT: '#151D28',
          soft: '#3B4554',
          muted: '#657081',
          subtle: '#9099A4',
        },
        // Surfaces
        canvas: '#FAF8F5',
        surface: {
          DEFAULT: '#FFFFFF',
          warm: '#F9F6F1',
          muted: '#EFECE7',
          sunken: '#F4F1EC',
        },
        line: {
          DEFAULT: '#E6E2DB',
          strong: '#BFC6CF',
        },
        // Status
        success: { DEFAULT: '#27B07D', soft: '#E7F9F2' },
        warning: { DEFAULT: '#F59714', soft: '#FEF2E2' },
        danger: { DEFAULT: '#E63737', soft: '#FDEDED' },
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica', 'Arial'],
        display: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui'],
      },
      fontSize: {
        'display-xl': ['2.75rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-lg': ['2.25rem', { lineHeight: '1.08', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display-md': ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'title-lg': ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '700' }],
        'title-md': ['1.125rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-sm': ['1rem', { lineHeight: '1.35', fontWeight: '600' }],
        'body-md': ['0.9375rem', { lineHeight: '1.55', fontWeight: '500' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '500' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0.02em' }],
        eyebrow: ['0.6875rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '0.12em' }],
      },
      borderRadius: {
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 2px hsl(215 30% 12% / 0.04), 0 1px 1px hsl(215 30% 12% / 0.03)',
        card: '0 4px 16px -4px hsl(215 30% 12% / 0.08), 0 2px 6px -2px hsl(215 30% 12% / 0.04)',
        elevated: '0 24px 48px -16px hsl(215 30% 12% / 0.18), 0 8px 16px -8px hsl(215 30% 12% / 0.08)',
        glow: '0 12px 32px -8px hsl(198 96% 56% / 0.45)',
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #23BAFB, #66D9FF)',
        'gradient-deep': 'linear-gradient(135deg, #2A74F4, #23BAFB)',
        aurora:
          'radial-gradient(120% 80% at 0% 0%, hsl(198 100% 88% / 0.55), transparent 60%), radial-gradient(100% 70% at 100% 0%, hsl(218 100% 90% / 0.55), transparent 55%), radial-gradient(120% 100% at 50% 100%, hsl(40 60% 96% / 0.9), transparent 60%), linear-gradient(180deg, #FAF8F5, #FAF8F5)',
      },
    },
  },
  plugins: [],
};
export default config;
