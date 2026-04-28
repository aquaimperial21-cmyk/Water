// SmartRO theme — MD3 tokens lifted from Stitch design system
// (Manrope, deep-blue primary, white surface, soft glass cards)

export const colors = {
  // Primary blue family
  primary: '#0059bb',
  primaryDark: '#004493',
  primaryContainer: '#0070ea',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#fefcff',
  primaryFixed: '#d8e2ff',
  primaryFixedDim: '#adc7ff',
  onPrimaryFixed: '#001a41',
  onPrimaryFixedVariant: '#004493',

  // Secondary teal accent
  secondary: '#00696b',
  secondaryContainer: '#56f5f8',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#006e70',

  // Tertiary
  tertiary: '#385d92',
  tertiaryContainer: '#5275ac',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#fefcff',

  // Surface family
  surface: '#f6faff',
  surfaceBright: '#f6faff',
  surfaceDim: '#d4dbe3',
  surfaceContainer: '#e8eff7',
  surfaceContainerLow: '#edf4fc',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerHigh: '#e2e9f1',
  surfaceContainerHighest: '#dce3eb',
  surfaceVariant: '#dce3eb',

  // On surface
  onSurface: '#151c22',
  onSurfaceVariant: '#414754',
  onBackground: '#151c22',

  // Outline
  outline: '#717786',
  outlineVariant: '#c1c6d7',

  // Status
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',
  success: '#1d8a4f',
  successContainer: '#cfead8',
  warning: '#b48a00',
  warningContainer: '#fff0c2',
  star: '#ffb800',

  // Convenience aliases (kept for any legacy reference)
  bg: '#f6faff',
  card: '#ffffff',
  text: '#151c22',
  textMuted: '#414754',
  border: '#c1c6d7',
  danger: '#ba1a1a',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  gutter: 16,
  margin: 24,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#003366',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  md: {
    shadowColor: '#003366',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  lg: {
    shadowColor: '#003366',
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const;

// Manrope-based type scale matching Stitch font tokens
export const type = {
  headlineXl: { fontFamily: 'Manrope_700Bold', fontSize: 40, lineHeight: 48, letterSpacing: -0.8 },
  headlineLg: { fontFamily: 'Manrope_700Bold', fontSize: 32, lineHeight: 40, letterSpacing: -0.32 },
  headlineMd: { fontFamily: 'Manrope_600SemiBold', fontSize: 24, lineHeight: 32 },
  titleLg: { fontFamily: 'Manrope_700Bold', fontSize: 20, lineHeight: 28 },
  titleMd: { fontFamily: 'Manrope_600SemiBold', fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: 'Manrope_400Regular', fontSize: 18, lineHeight: 28 },
  bodyMd: { fontFamily: 'Manrope_400Regular', fontSize: 16, lineHeight: 24 },
  bodyMdSemi: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, lineHeight: 24 },
  bodySm: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 20 },
  labelMd: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
  },
  labelSm: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.55,
    textTransform: 'uppercase' as const,
  },
  caption: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 16 },
} as const;

// Legacy alias used by some old imports
export const typography = type;
