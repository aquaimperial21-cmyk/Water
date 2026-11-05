import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContext } from '@react-navigation/native';
import { tokens } from '@theme/tokens';

// A wash eases from `from` to `to` and back, forever. Module-level, so a
// re-render never restarts the drift.
type Drift = {
  from: { translateX: number; translateY: number };
  to: { translateX: number; translateY: number };
  duration: number;
};

const CYAN_DRIFT: Drift = {
  from: { translateX: -20, translateY: -12 },
  to: { translateX: 14, translateY: 8 },
  duration: 6000,
};
const BLUE_DRIFT: Drift = {
  from: { translateX: 22, translateY: 6 },
  to: { translateX: -16, translateY: -10 },
  duration: 7200,
};

const CYAN_COLORS = ['rgba(35,186,251,0.55)', 'rgba(35,186,251,0)'] as const;
const CYAN_START = { x: 0.4, y: 0.4 };
const CYAN_END = { x: 1, y: 1 };
const BLUE_COLORS = ['rgba(42,116,244,0.32)', 'rgba(42,116,244,0)'] as const;
const BLUE_START = { x: 0.6, y: 0.4 };
const BLUE_END = { x: 0, y: 1 };
const WARM_COLORS = ['rgba(250,246,235,0)', tokens.color.bg] as const;
const WARM_START = { x: 0.5, y: 0.55 };
const WARM_END = { x: 0.5, y: 1 };

/**
 * ImperialAqua aurora hero backdrop.
 * Replicates the web `.aurora` — three soft radial-feel washes that fade
 * into the warm background. Each blob drifts slowly to feel "alive".
 * It drifts only while its screen is focused: screens stay mounted when
 * hidden, and a hidden aurora would keep animating for nothing.
 */
export const Aurora = React.memo(function Aurora({
  height = 460,
  style,
}: {
  height?: number;
  style?: ViewStyle;
  /** Accepted for back-compat; visual mix is fixed. */
  intensity?: number;
}) {
  const running = useScreenFocused();
  return (
    <View style={[styles.wrap, { height }, style]} pointerEvents="none">
      {/* Top-left cyan wash, drifts down-right */}
      <DriftingWash drift={CYAN_DRIFT} running={running} style={[styles.blob, styles.cyanBlob]}>
        <LinearGradient
          colors={CYAN_COLORS}
          start={CYAN_START}
          end={CYAN_END}
          style={StyleSheet.absoluteFillObject}
        />
      </DriftingWash>

      {/* Top-right brand-blue wash, drifts up-left */}
      <DriftingWash drift={BLUE_DRIFT} running={running} style={[styles.blob, styles.blueBlob]}>
        <LinearGradient
          colors={BLUE_COLORS}
          start={BLUE_START}
          end={BLUE_END}
          style={StyleSheet.absoluteFillObject}
        />
      </DriftingWash>

      {/* Warm bottom wash that grounds into the page */}
      <LinearGradient
        colors={WARM_COLORS}
        start={WARM_START}
        end={WARM_END}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
});

// Whether the screen this sits on is focused. Outside a navigator there is no
// screen to lose focus, so it counts as focused (useIsFocused throws there).
function useScreenFocused(): boolean {
  const navigation = React.useContext(NavigationContext);
  const [focused, setFocused] = React.useState(() => navigation?.isFocused() ?? true);
  React.useEffect(() => {
    if (!navigation) return;
    // Focus may have changed between the first render and subscribing.
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  return focused;
}

// One drifting wash. Stopping freezes it where it is; starting again carries
// on from there.
function DriftingWash({
  drift,
  running,
  style,
  children,
}: {
  drift: Drift;
  running: boolean;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  // 0 = at `from`, 1 = at `to`.
  const t = useSharedValue(0);

  React.useEffect(() => {
    if (!running) return;
    // Head for the far end, then swing end to end forever, so a drift
    // resumed part-way still covers its full range.
    const at = t.value;
    const end = at < 0.5 ? 1 : 0;
    t.value = withSequence(
      withTiming(end, { duration: Math.abs(end - at) * drift.duration }),
      withRepeat(withTiming(1 - end, { duration: drift.duration }), -1, true),
    );
    return () => cancelAnimation(t);
  }, [running, drift, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [drift.from.translateX, drift.to.translateX]) },
      { translateY: interpolate(t.value, [0, 1], [drift.from.translateY, drift.to.translateY]) },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
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
  cyanBlob: { top: -40, left: -40, width: 320, height: 320 },
  blueBlob: { top: -50, right: -60, width: 300, height: 300 },
});
