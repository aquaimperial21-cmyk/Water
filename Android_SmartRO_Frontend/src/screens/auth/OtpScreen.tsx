import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { Bubbles } from '../../components/Bubbles';
import { useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../api/client';
import { Auth } from '../../api/endpoints';
import { colors, spacing, type, radius, shadow } from '../../theme';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

export function OtpScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(30);
  const inputs = useRef<Array<TextInput | null>>([]);
  const signIn = useAuthStore((s) => s.signIn);

  useEffect(() => {
    Auth.requestOtp(phone)
      .then((r) => r.devOtp && setDevOtp(r.devOtp))
      .catch(() => {});
  }, [phone]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  function setDigit(idx: number, value: string) {
    const v = value.replace(/[^0-9]/g, '').slice(0, 1);
    const next = [...digits];
    next[idx] = v;
    setDigits(next);
    if (v && idx < 5) inputs.current[idx + 1]?.focus();
    if (!v && idx > 0) inputs.current[idx - 1]?.focus();
  }

  async function onVerify() {
    const otp = digits.join('');
    if (otp.length !== 6) return Alert.alert('Invalid OTP', 'Enter the 6-digit code.');
    setLoading(true);
    try {
      await signIn(phone, otp, name || undefined);
    } catch (e) {
      Alert.alert('Verification failed', apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (seconds > 0) return;
    try {
      const r = await Auth.requestOtp(phone);
      if (r.devOtp) setDevOtp(r.devOtp);
      setSeconds(30);
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e));
    }
  }

  const filled = digits.filter(Boolean).length;
  const lastFour = phone.slice(-4);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceBright }}>
      {/* Gradient header */}
      <LinearGradient
        colors={[colors.primaryFixed, colors.surfaceContainer]}
        style={styles.headerWrap}
      >
        <Bubbles
          bubbles={[
            { size: 160, top: -50, right: -30, color: colors.primary, opacity: 0.06 },
            { size: 90, bottom: -20, left: 20, color: colors.primary, opacity: 0.05 },
          ]}
        />
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={22} color={colors.onPrimaryFixed} />
          </Pressable>
        </View>
        <View style={styles.headerBody}>
          <View style={styles.shieldIcon}>
            <MaterialIcons name="verified-user" size={28} color={colors.primary} />
          </View>
          <Text style={[type.headlineLg, { color: colors.onPrimaryFixed, fontSize: 28 }]}>
            Verify your number
          </Text>
          <Text style={styles.headerSub}>
            We sent a 6-digit code to <Text style={styles.phoneMask}>+91 ••••• {lastFour}</Text>
          </Text>
        </View>
      </LinearGradient>

      <Screen padded contentStyle={{ paddingTop: spacing.lg }}>
        {/* OTP cells */}
        <View style={styles.otpRow}>
          {digits.map((d, idx) => {
            const isFilled = !!d;
            const isCurrent = idx === filled && !isFilled;
            return (
              <TextInput
                key={idx}
                ref={(r) => { inputs.current[idx] = r; }}
                value={d}
                onChangeText={(v) => setDigit(idx, v)}
                keyboardType="number-pad"
                maxLength={1}
                style={[
                  styles.otpCell,
                  isFilled && styles.otpCellFilled,
                  isCurrent && styles.otpCellCurrent,
                ]}
                selectTextOnFocus
              />
            );
          })}
        </View>

        {/* Resend */}
        <Pressable onPress={onResend} disabled={seconds > 0} style={styles.resendWrap}>
          {seconds > 0 ? (
            <Text style={styles.resend}>
              Resend in <Text style={styles.resendTimer}>{seconds}s</Text>
            </Text>
          ) : (
            <Text style={styles.resend}>
              Didn't get it? <Text style={styles.resendCta}>Resend</Text>
            </Text>
          )}
        </Pressable>

        {/* Profile completion */}
        <View style={styles.divider} />
        <Text style={[type.titleMd, { color: colors.onSurface, marginBottom: 4 }]}>Complete your profile</Text>
        <Text style={[type.caption, { color: colors.onSurfaceVariant, marginBottom: spacing.md }]}>
          Helps our team route service tickets to you faster.
        </Text>
        <Input label="Full Name" value={name} onChangeText={setName} placeholder="Priya Mehta" />
        <Input
          label="Email Address (optional)"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Button title="Verify & continue" onPress={onVerify} loading={loading} fullWidth iconRight="arrow-forward" />

        {devOtp ? (
          <View style={styles.devChip}>
            <MaterialIcons name="vpn-key" size={14} color={colors.primary} />
            <Text style={styles.devText}>Dev OTP: {devOtp}</Text>
          </View>
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerRow: { paddingHorizontal: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.5)' },
  headerBody: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  shieldIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  headerSub: { ...type.bodyMd, color: colors.onPrimaryFixedVariant, marginTop: 6 },
  phoneMask: { fontFamily: 'Manrope_700Bold', color: colors.onPrimaryFixed },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: spacing.md },
  otpCell: {
    flex: 1,
    height: 64,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    fontSize: 24,
    fontFamily: 'Manrope_700Bold',
    color: colors.onSurface,
    ...({ outlineStyle: 'none' } as object),
  },
  otpCellFilled: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,89,187,0.06)',
  },
  otpCellCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
  },

  resendWrap: { alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  resend: { ...type.bodyMd, color: colors.onSurfaceVariant },
  resendTimer: { color: colors.onSurface, fontFamily: 'Manrope_700Bold' },
  resendCta: { color: colors.primary, fontFamily: 'Manrope_700Bold' },

  divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.lg },

  devChip: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,89,187,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  devText: { ...type.labelSm, color: colors.primary, fontSize: 11 },
});
