import React, { useEffect, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react-native';
import { tokens } from '@theme/tokens';
import { Dialog } from './Dialog';
import {
  dismissToast,
  getMessagesSnapshot,
  settleConfirm,
  subscribeMessages,
  type MessageTone,
  type ToastMessage,
} from '../../utils/messages';

const TONE: Record<MessageTone, { fg: string; soft: string; Icon: typeof Info }> = {
  success: { fg: tokens.color.success, soft: tokens.color.successSoft, Icon: CircleCheck },
  error: { fg: tokens.color.danger, soft: tokens.color.dangerSoft, Icon: CircleAlert },
  warning: { fg: tokens.color.warning, soft: tokens.color.warningSoft, Icon: TriangleAlert },
  info: { fg: tokens.color.accent, soft: tokens.color.accentSoft, Icon: Info },
};

const HAPTIC: Partial<Record<MessageTone, Haptics.NotificationFeedbackType>> = {
  success: Haptics.NotificationFeedbackType.Success,
  error: Haptics.NotificationFeedbackType.Error,
  warning: Haptics.NotificationFeedbackType.Warning,
};

/**
 * Renders every toast and confirm dialog raised through `utils/messages`.
 * Mount once, near the app root, inside <SafeAreaProvider>.
 */
export function MessageHost() {
  const { toasts, confirm } = useSyncExternalStore(subscribeMessages, getMessagesSnapshot, getMessagesSnapshot);
  const insets = useSafeAreaInsets();

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.stack, { top: insets.top + tokens.space['2'] }, Platform.OS === 'web' && WEB_FIXED]}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastCard key={t.id} item={t} />
          ))}
        </AnimatePresence>
      </View>

      <Dialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        description={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        cancelLabel={confirm?.cancelLabel}
        destructive={confirm?.destructive}
        hideCancel={confirm?.acknowledgeOnly}
        onConfirm={() => confirm && settleConfirm(confirm.id, true)}
        onClose={() => confirm && settleConfirm(confirm.id, false)}
      />
    </>
  );
}

function ToastCard({ item }: { item: ToastMessage }) {
  const { fg, soft, Icon } = TONE[item.tone];

  useEffect(() => {
    const haptic = HAPTIC[item.tone];
    if (haptic !== undefined && Platform.OS !== 'web') {
      Haptics.notificationAsync(haptic).catch(() => {});
    }
    const timer = setTimeout(() => dismissToast(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.tone, item.duration]);

  return (
    <MotiView
      from={{ opacity: 0, translateY: -12, scale: 0.98 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      exit={{ opacity: 0, translateY: -8, scale: 0.98 }}
      transition={{ type: 'timing', duration: 180 }}
      style={styles.cardWrap}
    >
      <Pressable
        onPress={() => dismissToast(item.id)}
        accessibilityRole="alert"
        accessibilityLiveRegion={item.tone === 'error' ? 'assertive' : 'polite'}
        accessibilityHint="Tap to dismiss"
        style={({ pressed }) => [styles.card, { borderLeftColor: fg }, pressed && { opacity: 0.92 }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: soft }]}>
          <Icon size={18} color={fg} strokeWidth={2.4} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{item.title}</Text>
          {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
        </View>
        <X size={16} color={tokens.color.textMuted} strokeWidth={2.2} style={styles.close} />
      </Pressable>
    </MotiView>
  );
}

// react-native-web: pin to the viewport so page scroll doesn't carry toasts away.
const WEB_FIXED = { position: 'fixed' } as unknown as ViewStyle;

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: tokens.space['4'],
    right: tokens.space['4'],
    alignItems: 'center',
    gap: tokens.space['2'],
    zIndex: 1000,
    elevation: 1000,
  },
  cardWrap: { width: '100%', maxWidth: 480 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space['3'],
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: tokens.color.border,
    paddingVertical: tokens.space['3'],
    paddingLeft: tokens.space['3'],
    paddingRight: tokens.space['3'],
    ...tokens.shadow.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingTop: 1 },
  title: { ...tokens.text.bodySm, fontFamily: 'Manrope_700Bold', color: tokens.color.text },
  message: { ...tokens.text.bodySmRegular, color: tokens.color.textMuted, marginTop: 2 },
  close: { marginTop: 2 },
});
