import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { tokens } from '@theme/tokens';

/**
 * ImperialAqua aurora hero backdrop.
 * Replicates the web `.aurora` — three soft radial-feel washes that fade
 * into the warm background. Each blob drifts slowly to feel "alive".
 */
export function Aurora({
  height = 460,
  style,
}: {
  height?: number;
  style?: ViewStyle;
  /** Accepted for back-compat; visual mix is fixed. */
  intensity?: number;
}) {
  return (
    <View style={[styles.wrap, { height }, style]} pointerEvents="none">
      {/* Top-left cyan wash, drifts down-right */}
      <MotiView
        from={{ translateX: -20, translateY: -12 }}
        animate={{ translateX: 14, translateY: 8 }}
        transition={{ type: 'timing', duration: 6000, loop: true, repeatReverse: true }}
        style={[styles.blob, { top: -40, left: -40, width: 320, height: 320 }]}
      >
        <LinearGradient
          colors={['rgba(35,186,251,0.55)', 'rgba(35,186,251,0)']}
          start={{ x: 0.4, y: 0.4 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </MotiView>

      {/* Top-right brand-blue wash, drifts up-left */}
      <MotiView
        from={{ translateX: 22, translateY: 6 }}
        animate={{ translateX: -16, translateY: -10 }}
        transition={{ type: 'timing', duration: 7200, loop: true, repeatReverse: true }}
        style={[styles.blob, { top: -50, right: -60, width: 300, height: 300 }]}
      >
        <LinearGradient
          colors={['rgba(42,116,244,0.32)', 'rgba(42,116,244,0)']}
          start={{ x: 0.6, y: 0.4 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </MotiView>

      {/* Warm bottom wash that grounds into the page */}
      <LinearGradient
        colors={['rgba(250,246,235,0)', tokens.color.bg]}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
});
