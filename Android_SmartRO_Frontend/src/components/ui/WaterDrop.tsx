import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { tokens } from '@theme/tokens';

type Tone = 'accent' | 'white' | 'ink';

type Props = {
  size?: number;
  tone?: Tone;
  pulse?: boolean; // accepted for API parity, no animation needed for the brand mark itself
};

/**
 * ImperialAqua brand mark — crown + drop.
 * Re-creates the web `WaterDropMark` in pure RN SVG.
 */
export function WaterDrop({ size = 28, tone = 'accent' }: Props) {
  const fill =
    tone === 'white' ? '#FFFFFF' : tone === 'ink' ? tokens.color.text : tokens.color.accent;
  const glow =
    tone === 'white' ? 'rgba(255,255,255,0.85)' : tokens.color.accentGlow;
  const crown =
    tone === 'white' ? '#FFFFFF' : tokens.color.brandBlue;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Defs>
          <LinearGradient id="iaDropGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={glow} />
            <Stop offset="1" stopColor={fill} />
          </LinearGradient>
          <LinearGradient id="iaCrownGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={crown} />
            <Stop offset="1" stopColor={fill} />
          </LinearGradient>
        </Defs>
        {/* Crown */}
        <Path
          d="M9 9 L13.5 13 L17 6.5 L20 11.5 L23 6.5 L26.5 13 L31 9 L29.5 15 L10.5 15 Z"
          fill="url(#iaCrownGrad)"
        />
        <Circle cx="9" cy="9" r="1.4" fill={crown} />
        <Circle cx="20" cy="6.5" r="1.6" fill={crown} />
        <Circle cx="31" cy="9" r="1.4" fill={crown} />
        {/* Drop */}
        <Path
          d="M20 16 c0 0 9 9 9 16 a9 9 0 1 1 -18 0 c0 -7 9 -16 9 -16 z"
          fill="url(#iaDropGrad)"
        />
        {/* Highlight */}
        <Path
          d="M16.5 26 c -1 1.4 -1 3.4 0 4.8"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

export function WaterDropLogo({
  size = 28,
  tone = 'accent',
  style,
}: {
  size?: number;
  tone?: Tone;
  style?: ViewStyle;
}) {
  const isWhite = tone === 'white';
  return (
    <View style={[logoStyles.row, style]}>
      <WaterDrop size={size} tone={tone} />
      <Text
        style={[
          logoStyles.brand,
          { color: isWhite ? '#FFFFFF' : tokens.color.text },
        ]}
      >
        Imperial
        <Text style={{ color: isWhite ? '#FFFFFF' : tokens.color.accent }}>Aqua</Text>
      </Text>
    </View>
  );
}

const logoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    letterSpacing: -0.4,
  },
});
