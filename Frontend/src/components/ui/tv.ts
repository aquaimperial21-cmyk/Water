// Tiny variant helper — class-variance-authority shape, returning RN style objects.
// Usage:
//   const button = tv({
//     base: { borderRadius: 12 },
//     variants: {
//       intent: { primary: { backgroundColor: '#0EA5B7' }, ghost: {} },
//       size: { md: { paddingVertical: 10 } },
//     },
//     defaultVariants: { intent: 'primary', size: 'md' },
//   });
//   button({ intent: 'ghost' }); // -> merged style object

import type { ViewStyle, TextStyle } from 'react-native';

type AnyStyle = ViewStyle | TextStyle | (ViewStyle & TextStyle);

type VariantMap = Record<string, Record<string, AnyStyle>>;

type VariantProps<V extends VariantMap> = {
  [K in keyof V]?: keyof V[K];
};

export function tv<V extends VariantMap>(config: {
  base?: AnyStyle;
  variants: V;
  defaultVariants?: VariantProps<V>;
}) {
  return (props?: VariantProps<V>): AnyStyle => {
    const merged: AnyStyle = { ...(config.base ?? {}) };
    const resolved = { ...(config.defaultVariants ?? {}), ...(props ?? {}) } as Record<string, string | undefined>;
    for (const key in config.variants) {
      const variantValue = resolved[key];
      if (variantValue == null) continue;
      const styleForVariant = config.variants[key][variantValue];
      if (styleForVariant) Object.assign(merged, styleForVariant);
    }
    return merged;
  };
}

export type Variant<T extends (props?: any) => any> = NonNullable<Parameters<T>[0]>;
