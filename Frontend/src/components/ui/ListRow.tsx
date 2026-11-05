import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { tokens } from '@theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  style?: ViewStyle;
  showChevron?: boolean;
};

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  destructive,
  style,
  showChevron = true,
}: Props) {
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => onPress && (opacity.value = withTiming(0.6, { duration: 80 }))}
      onPressOut={() => onPress && (opacity.value = withTiming(1, { duration: 160 }))}
      style={[styles.row, animatedStyle, style]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, destructive && { color: tokens.color.danger }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {onPress && showChevron && !trailing ? (
        <ChevronRight size={18} color={tokens.color.textSubtle} />
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space['3'],
    paddingVertical: tokens.space['4'],
    paddingHorizontal: tokens.space['5'],
  },
  leading: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...tokens.text.bodyMedium, color: tokens.color.text, fontSize: 15 },
  subtitle: {
    ...tokens.text.bodySm,
    color: tokens.color.textMuted,
    marginTop: 2,
  },
});

export function ListGroup({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[groupStyles.group, style]}>
      {items.map((c, i) => (
        <View key={i}>
          {c}
          {i < items.length - 1 ? <View style={groupStyles.divider} /> : null}
        </View>
      ))}
    </View>
  );
}

const groupStyles = StyleSheet.create({
  group: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.color.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: tokens.color.divider, marginLeft: tokens.space['5'] + 36 + tokens.space['3'] },
});
