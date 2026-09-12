// "Notify me when you launch in <city>" capture for visitors browsing
// non-serviceable cities. Anonymous-friendly: phone + city name are all we
// need; user-id is set automatically if the visitor is signed in.

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell } from 'lucide-react-native';
import { Support } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { notify } from '../../utils/confirm';
import { tokens } from '@theme/tokens';
import { Aurora } from '@ui/index';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Waitlist'>;

export function WaitlistScreen({ route, navigation }: Props) {
  const { cityName } = route.params;
  const [phone, setPhone] = React.useState('');
  const [pincode, setPincode] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!/^\d{10}$/.test(phone)) return notify('Phone', 'Enter your 10-digit mobile number');
    setBusy(true);
    try {
      await Support.waitlist({ phone: `+91${phone}`, cityName, pincode: pincode || undefined });
      notify("You're on the list", `We'll text you the moment we launch in ${cityName}.`);
      navigation.goBack();
    } catch (e) {
      notify('Could not submit', apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <Aurora height={300} />
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Bell size={32} color={tokens.color.accent} />
        </View>
        <Text style={styles.title}>We're not in {cityName} yet</Text>
        <Text style={styles.lede}>
          Drop your number and we'll text you the moment SmartRO launches there. No spam.
        </Text>

        <Text style={styles.label}>Phone</Text>
        <View style={styles.inputRow}>
          <Text style={styles.cc}>+91</Text>
          <TextInput
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
            placeholder="98XXX XXXXX"
            placeholderTextColor={tokens.color.textSubtle}
            keyboardType="phone-pad"
            style={styles.input}
            selectionColor={tokens.color.accent}
          />
        </View>

        <Text style={[styles.label, { marginTop: 12 }]}>Pincode (optional)</Text>
        <TextInput
          value={pincode}
          onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="411045"
          placeholderTextColor={tokens.color.textSubtle}
          keyboardType="number-pad"
          style={styles.singleInput}
          selectionColor={tokens.color.accent}
        />

        <Pressable
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [styles.cta, busy && { opacity: 0.5 }, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>{busy ? 'Submitting…' : 'Notify me'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  body: { paddingHorizontal: 20, paddingTop: 12 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: tokens.color.accentTint,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { ...tokens.text.displayMd, color: tokens.color.text },
  lede: { ...tokens.text.bodyMd, color: tokens.color.textMuted, marginTop: 6, marginBottom: 24 },
  label: { ...tokens.text.label, color: tokens.color.textMuted, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    overflow: 'hidden',
  },
  cc: {
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: tokens.color.surfaceWarm,
    borderRightWidth: 1, borderRightColor: tokens.color.border,
    fontFamily: 'Manrope_700Bold', fontSize: 14, color: tokens.color.text,
  },
  input: { flex: 1, padding: 14, fontFamily: 'Manrope_700Bold', fontSize: 16, color: tokens.color.text },
  singleInput: {
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    fontFamily: 'Manrope_700Bold', fontSize: 16, color: tokens.color.text,
  },
  cta: {
    marginTop: 22,
    height: 52,
    borderRadius: 24,
    backgroundColor: tokens.color.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 15 },
});
