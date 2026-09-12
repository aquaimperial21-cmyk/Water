// SmartRO theme — premium light tokens.
// New code should import from `@theme/tokens` and `@theme/motion`.
// This module re-exports the modern tokens AND a back-compat MD3-shaped
// surface so any not-yet-migrated screens keep compiling.

export { tokens } from './tokens';
export { motion } from './motion';
export type { Tokens } from './tokens';
import { color, space, radius as r, shadow as sh, text as t } from './tokens';

// Back-compat MD3-style aliases — DO NOT add new keys here, migrate instead.
export const colors = {
  primary: color.accent,
  primaryDark: color.accentPressed,
  primaryContainer: color.accentSoftStrong,
  onPrimary: '#FFFFFF',
  onPrimaryContainer: color.accentInk,
  primaryFixed: color.accentSoft,
  primaryFixedDim: color.accentSoftStrong,
  onPrimaryFixed: color.accentInk,
  onPrimaryFixedVariant: color.accentPressed,

  secondary: color.accent,
  secondaryContainer: color.accentSoft,
  onSecondary: '#FFFFFF',
  onSecondaryContainer: color.accentInk,

  tertiary: color.text,
  tertiaryContainer: color.surfaceMuted,
  onTertiary: '#FFFFFF',
  onTertiaryContainer: color.text,

  surface: color.surface,
  surfaceBright: color.bg,
  surfaceDim: color.surfaceMuted,
  surfaceContainer: color.surfaceMuted,
  surfaceContainerLow: color.surface,
  surfaceContainerLowest: color.surface,
  surfaceContainerHigh: color.surfaceMuted,
  surfaceContainerHighest: color.surfaceSunken,
  surfaceVariant: color.surfaceMuted,

  onSurface: color.text,
  onSurfaceVariant: color.textMuted,
  onBackground: color.text,

  outline: color.borderStrong,
  outlineVariant: color.border,

  error: color.danger,
  errorContainer: color.dangerSoft,
  onError: '#FFFFFF',
  onErrorContainer: color.danger,
  success: color.success,
  successContainer: color.successSoft,
  warning: color.warn,
  warningContainer: color.warnSoft,
  star: color.star,

  bg: color.bg,
  card: color.surface,
  text: color.text,
  textMuted: color.textMuted,
  border: color.border,
  danger: color.danger,
} as const;

export const spacing = {
  xs: space['1'],
  sm: space['2'],
  md: space['4'],
  lg: space['6'],
  xl: space['8'],
  xxl: space['12'],
  gutter: space['4'],
  margin: space['6'],
} as const;

export const radius = {
  none: r.none,
  sm: r.sm,
  md: r.md,
  lg: r.lg,
  xl: r.xl,
  xxl: r['2xl'],
  full: r.full,
} as const;

export const shadow = {
  sm: sh.xs,
  md: sh.sm,
  lg: sh.md,
} as const;

export const type = {
  headlineXl: t.displayXl,
  headlineLg: t.displayLg,
  headlineMd: t.headingLg,
  titleLg: t.headingMd,
  titleMd: t.headingSm,
  bodyLg: t.body,
  bodyMd: t.body,
  bodyMdSemi: t.bodyMedium,
  bodySm: t.bodySm,
  labelMd: t.label,
  labelSm: { ...t.label, fontSize: 11, lineHeight: 14 },
  caption: t.caption,
} as const;

export const typography = type;
