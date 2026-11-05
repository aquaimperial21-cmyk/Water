// ImperialAqua design tokens — pixel-matched to the Lovable web prototype
// (smartro-water/src/index.css). Each hex below is the exact rendering of
// the corresponding HSL custom property in that file.

export const color = {
  // Surfaces — warm off-white base
  bg: '#FAF8F5',                 // hsl(40 33% 97%)
  surface: '#FFFFFF',            // hsl(0 0% 100%)
  surfaceWarm: '#F9F6F1',        // hsl(38 40% 96%)
  surfaceMuted: '#EFECE7',       // hsl(40 20% 92%)
  surfaceSunken: '#EFECE7',      // alias of muted
  secondary: '#F4F1EC',          // hsl(40 25% 94%)

  // Lines & inputs
  border: '#E6E2DB',             // hsl(38 18% 88%)
  borderStrong: '#BFC6CF',       // hsl(215 14% 78%)
  divider: '#E6E2DB',
  input: '#E6E2DB',

  // Ink
  text: '#151D28',               // hsl(215 30% 12%) — foreground
  textMuted: '#657081',          // hsl(215 12% 45%) — muted-foreground
  textSubtle: '#657081',
  inkSoft: '#3B4554',            // hsl(215 18% 28%)
  textInverse: '#FAF8F5',

  // Hydrating cyan-blue accent
  accent: '#23BAFB',             // hsl(198 96% 56%) — primary
  accentHover: '#0FA5F0',
  accentPressed: '#0888CC',
  accentGlow: '#66D9FF',         // hsl(195 100% 70%) — primary-glow
  accentSoft: '#E1F6FE',         // hsl(198 96% 94%) — primary-soft / accent
  accentSoftStrong: '#E1F6FE',
  accentTint: '#F0FAFF',         // hsl(198 100% 97%) — primary-tint
  accentRing: 'rgba(35,186,251,0.20)',
  accentInk: '#06386B',          // hsl(210 90% 22%) — primary-ink / accent-foreground

  // Brand mid-blue (deeper companion)
  brandBlue: '#2A74F4',          // hsl(218 90% 56%)
  brandBlueSoft: '#E7EFFE',      // hsl(218 90% 95%)

  // Status
  success: '#27B07D',            // hsl(158 64% 42%)
  successSoft: '#E7F9F2',        // hsl(158 60% 94%)
  warn: '#F59714',               // hsl(35 92% 52%)
  warning: '#F59714',
  warnSoft: '#FEF2E2',           // hsl(35 92% 94%)
  warningSoft: '#FEF2E2',
  danger: '#E63737',             // hsl(0 78% 56%) — destructive
  dangerSoft: '#FDEDED',         // hsl(0 78% 96%)

  star: '#F59714',

  // Aurora gradient stops (matches the radial layers in the web `.aurora`)
  // Top-left cyan wash → hsl(198 100% 88% / 0.85)
  // Top-right brand blue → hsl(218 100% 90% / 0.7)
  // Warm fade → hsl(40 60% 96% / 0.9) into background
  auroraFrom: '#C2EAFF',         // hsl(198 100% 88%)
  auroraVia: '#D6E3FF',          // hsl(218 100% 90%)
  auroraTo: '#FAF6EB',           // hsl(40 60% 96%)

  // Gradient endpoints
  gradientAccentFrom: '#23BAFB', // primary
  gradientAccentTo: '#66D9FF',   // primary-glow
  gradientDeepFrom: '#2A74F4',   // brand-blue
  gradientDeepTo: '#23BAFB',     // primary
} as const;

export const space = {
  '0': 0,
  px: 1,
  '0.5': 2,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
} as const;

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  // Web --shadow-sm: 0 1px 2px hsl(215 30% 12% / 0.04), 0 1px 1px hsl(215 30% 12% / 0.03)
  xs: {
    shadowColor: '#151D28',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  // --shadow-md: 0 4px 16px -4px hsl(215 30% 12% / 0.08)
  sm: {
    shadowColor: '#151D28',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  md: {
    shadowColor: '#151D28',
    shadowOpacity: 0.10,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  // --shadow-lg: 0 24px 48px -16px hsl(215 30% 12% / 0.18)
  lg: {
    shadowColor: '#151D28',
    shadowOpacity: 0.18,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 24 },
    elevation: 12,
  },
  // --shadow-glow: 0 12px 32px -8px hsl(var(--primary) / 0.45)
  glow: {
    shadowColor: '#23BAFB',
    shadowOpacity: 0.45,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

const FAMILY = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  black: 'Manrope_800ExtraBold',
};

export const text = {
  displayXl: { fontFamily: FAMILY.black, fontSize: 44, lineHeight: 48, letterSpacing: -1.2 },
  displayLg: { fontFamily: FAMILY.bold, fontSize: 36, lineHeight: 40, letterSpacing: -0.9 },
  displayMd: { fontFamily: FAMILY.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  headingLg: { fontFamily: FAMILY.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  headingMd: { fontFamily: FAMILY.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  headingSm: { fontFamily: FAMILY.bold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  titleLg: { fontFamily: FAMILY.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  titleMd: { fontFamily: FAMILY.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  titleSm: { fontFamily: FAMILY.bold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: FAMILY.regular, fontSize: 16, lineHeight: 24 },
  bodyLg: { fontFamily: FAMILY.medium, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: FAMILY.medium, fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: FAMILY.medium, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: FAMILY.medium, fontSize: 14, lineHeight: 20 },
  bodySmRegular: { fontFamily: FAMILY.regular, fontSize: 14, lineHeight: 20 },
  bodySmMedium: { fontFamily: FAMILY.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: FAMILY.medium, fontSize: 12, lineHeight: 16 },
  label: {
    fontFamily: FAMILY.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  eyebrow: {
    fontFamily: FAMILY.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  mono: { fontFamily: FAMILY.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
} as const;

export const tokens = {
  color,
  space,
  radius,
  shadow,
  text,
} as const;

export type Tokens = typeof tokens;
