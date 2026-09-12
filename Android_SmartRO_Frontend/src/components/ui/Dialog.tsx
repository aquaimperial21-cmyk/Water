import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { tokens } from '@theme/tokens';
import { Button } from './Button';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  children?: React.ReactNode;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  destructive,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  children,
}: Props) {
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <AnimatePresence>
        {open ? (
          <View style={StyleSheet.absoluteFillObject}>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 200 }}
              style={[StyleSheet.absoluteFillObject, styles.backdrop]}
            >
              <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
            </MotiView>
            <View style={styles.center} pointerEvents="box-none">
              <MotiView
                from={{ scale: 0.96, opacity: 0, translateY: 8 }}
                animate={{ scale: 1, opacity: 1, translateY: 0 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ type: 'spring', damping: 22, stiffness: 240 }}
                style={styles.card}
              >
                <Text style={styles.title}>{title}</Text>
                {description ? <Text style={styles.desc}>{description}</Text> : null}
                {children ? <View style={{ marginTop: tokens.space['3'] }}>{children}</View> : null}
                <View style={styles.actions}>
                  <Button title={cancelLabel} variant="outline" size="md" onPress={onClose} />
                  <Button
                    title={confirmLabel}
                    variant={destructive ? 'destructive' : 'primary'}
                    size="md"
                    onPress={() => {
                      onConfirm?.();
                      onClose();
                    }}
                  />
                </View>
              </MotiView>
            </View>
          </View>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(12,10,9,0.40)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.space['6'] },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius['2xl'],
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: tokens.space['6'],
    width: '100%',
    maxWidth: 420,
    ...tokens.shadow.md,
  },
  title: { ...tokens.text.headingMd, color: tokens.color.text },
  desc: { ...tokens.text.body, color: tokens.color.textMuted, marginTop: tokens.space['2'] },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.space['2'],
    marginTop: tokens.space['5'],
  },
});
