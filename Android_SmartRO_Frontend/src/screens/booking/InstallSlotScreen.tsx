// Install-slot picker shown after booking is paid. Backend returns a list of
// 4-hour windows respecting INSTALL_LEAD_HOURS; user picks one, server creates
// a Job and assigns a technician.

import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Calendar, Check } from 'lucide-react-native';
import { Bookings, InstallSlot } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { notify } from '../../utils/confirm';
import { tokens } from '@theme/tokens';
import { Aurora } from '@ui/index';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'InstallSlot'>;

export function InstallSlotScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const [slots, setSlots] = React.useState<InstallSlot[] | null>(null);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const s = await Bookings.installSlots(bookingId);
        setSlots(s);
      } catch (e) {
        notify('Could not load slots', apiErrorMessage(e));
      }
    })();
  }, [bookingId]);

  async function confirm() {
    if (!picked) return;
    setSubmitting(true);
    try {
      await Bookings.setInstallSlot(bookingId, picked);
      notify('Installation scheduled', 'A technician will arrive in the selected window.');
      navigation.goBack();
    } catch (e) {
      notify('Could not book slot', apiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Group slots by date for a tidy two-level list
  const byDay = React.useMemo(() => {
    const m: Record<string, InstallSlot[]> = {};
    (slots ?? []).forEach((s) => {
      const day = new Date(s.start).toDateString();
      (m[day] ??= []).push(s);
    });
    return m;
  }, [slots]);

  return (
    <SafeAreaView style={styles.root}>
      <Aurora height={300} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} color={tokens.color.accent} />
          <Text style={styles.eyebrow}>Installation</Text>
        </View>
        <Text style={styles.heading}>Pick a slot</Text>
        <Text style={styles.lede}>Our technician will install your purifier within the 4-hour window.</Text>

        {!slots ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={tokens.color.accent} />
          </View>
        ) : (
          Object.keys(byDay).map((day) => (
            <View key={day} style={{ marginTop: 22 }}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={styles.slotGrid}>
                {byDay[day]!.map((s) => {
                  const chosen = picked === s.start;
                  return (
                    <Pressable
                      key={s.start}
                      onPress={() => setPicked(s.start)}
                      style={[styles.slot, chosen && styles.slotChosen]}
                    >
                      <Text style={[styles.slotText, chosen && styles.slotTextChosen]}>
                        {new Date(s.start).getHours().toString().padStart(2, '0')}:00 –{' '}
                        {new Date(s.end).getHours().toString().padStart(2, '0')}:00
                      </Text>
                      {chosen ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!picked || submitting}
          onPress={confirm}
          style={[styles.cta, (!picked || submitting) && { opacity: 0.5 }]}
        >
          <Text style={styles.ctaText}>{submitting ? 'Booking…' : 'Confirm slot'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  eyebrow: { ...tokens.text.label, color: tokens.color.textMuted, fontSize: 11 },
  heading: { ...tokens.text.displayLg, color: tokens.color.text, marginTop: 4 },
  lede: { ...tokens.text.bodyMd, color: tokens.color.textMuted, marginTop: 6 },
  dayLabel: { ...tokens.text.label, color: tokens.color.textMuted, marginBottom: 8 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  slotChosen: {
    backgroundColor: tokens.color.accent,
    borderColor: tokens.color.accent,
  },
  slotText: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 13 },
  slotTextChosen: { color: '#FFFFFF' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: tokens.color.bg,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  cta: {
    height: 52,
    borderRadius: 24,
    backgroundColor: tokens.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 15 },
});
