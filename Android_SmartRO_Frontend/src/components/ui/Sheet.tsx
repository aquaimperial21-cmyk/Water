import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@theme/tokens';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
};

export function Sheet({ open, onClose, title, description, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <AnimatePresence>
        {open ? (
          <View style={StyleSheet.absoluteFillObject}>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 220 }}
              style={[StyleSheet.absoluteFillObject, styles.backdrop]}
            >
              <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
            </MotiView>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.kav}
              pointerEvents="box-none"
            >
              <MotiView
                from={{ translateY: 80, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                exit={{ translateY: 80, opacity: 0 }}
                transition={{ type: 'spring', damping: 22, stiffness: 220 }}
                style={[
                  styles.sheet,
                  { paddingBottom: Math.max(insets.bottom, tokens.space['5']) },
                ]}
              >
                <View style={styles.handle} />
                {title ? (
                  <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                    {description ? <Text style={styles.desc}>{description}</Text> : null}
                  </View>
                ) : null}
                <View style={{ paddingHorizontal: tokens.space['5'] }}>{children}</View>
              </MotiView>
            </KeyboardAvoidingView>
          </View>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(12,10,9,0.40)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: tokens.radius['2xl'],
    borderTopRightRadius: tokens.radius['2xl'],
    paddingTop: tokens.space['3'],
    borderTopWidth: 1,
    borderColor: tokens.color.border,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.color.borderStrong,
    marginBottom: tokens.space['3'],
  },
  header: {
    paddingHorizontal: tokens.space['5'],
    paddingBottom: tokens.space['4'],
  },
  title: { ...tokens.text.headingMd, color: tokens.color.text },
  desc: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 4 },
});
