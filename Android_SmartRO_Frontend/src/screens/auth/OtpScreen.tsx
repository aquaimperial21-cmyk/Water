import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Pencil } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { MotiView } from 'moti';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/auth';
import { apiErrorMessage, setStoredUser, setTokens } from '../../api/client';
import { Auth } from '../../api/endpoints';
import {
  confirmPhoneCode,
  finishPhoneSignIn,
  firebaseErrorMessage,
  sendPhoneCode,
} from '../../utils/firebasePhone';
import { tokens } from '@theme/tokens';
import { Aurora } from '@ui/index';
import { notify } from '../../utils/confirm';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

const RESEND_SECONDS = 30;

function maskPhone(p: string) {
  const last4 = p.slice(-4);
  return `+91 ••••• ${last4}`;
}

export function OtpScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const inputs = useRef<Array<TextInput | null>>([]);

  // The code was already sent by PhoneScreen — Firebase holds the pending
  // confirmation, so there is nothing to fetch here.

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
    if (otp.length !== 6) return notify('Invalid OTP', 'Enter the 6-digit code.');
    if (name.trim().length < 2) return notify('Name needed', 'Tell us your name to continue.');
    setLoading(true);
    try {
      // Firebase proves the number; our API turns that into a SmartRO session.
      const idToken = await confirmPhoneCode(otp, phone);
      // Call the API directly so we can play the success animation BEFORE
      // committing the user to the auth store (which swaps nav stacks).
      const data = await Auth.firebaseLogin(idToken, name.trim(), referralCode.trim() || undefined);
      void finishPhoneSignIn();
      setVerified(true);
      // Let the success animation play, then commit session.
      setTimeout(async () => {
        await setTokens(data.accessToken, data.refreshToken);
        await setStoredUser(data.user);
        useAuthStore.setState({ user: data.user });
      }, 900);
    } catch (e) {
      const isApiError = Boolean((e as { response?: unknown })?.response);
      notify('Verification failed', isApiError ? apiErrorMessage(e) : firebaseErrorMessage(e));
      setLoading(false);
    }
  }

  async function onResend() {
    if (seconds > 0) return;
    try {
      await sendPhoneCode(phone, true);
      setSeconds(RESEND_SECONDS);
    } catch (e) {
      notify('Could not resend', firebaseErrorMessage(e));
    }
  }

  const code = digits.join('');
  // Visual hint only — the button is always tappable and validates inside.
  const looksReady = code.length === 6 && name.trim().length >= 2 && !loading;

  // Timer ring math
  const r = 14;
  const c = 2 * Math.PI * r;
  const ringOffset = c - (seconds / RESEND_SECONDS) * c;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Aurora height={420} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* pt-6 flex justify-between */}
          <View style={styles.topRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <ArrowLeft size={18} color={tokens.color.text} />
            </Pressable>
            <Text style={styles.step}>Step 2 of 2</Text>
          </View>

          {verified ? (
            <MotiView
              from={{ opacity: 0, scale: 0.85, translateY: 16 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 480 }}
              style={styles.verifiedWrap}
            >
              {/* Halo stack — sized box that contains the disk + animated rings */}
              <View style={styles.haloBox}>
                <View style={styles.haloBase} />
                <MotiView
                  from={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ type: 'timing', duration: 2000, loop: true }}
                  style={styles.haloPulse}
                />
                <View style={styles.haloMid} />
                <View style={styles.successDisk}>
                  <Check size={36} color="#FFFFFF" strokeWidth={3} />
                </View>
              </View>
              <Text style={styles.verifiedTitle}>Verified</Text>
              <Text style={styles.verifiedSub}>Welcome aboard.</Text>
            </MotiView>
          ) : (
            <>
              {/* mt-10 font-display text-display-md */}
              <Text style={styles.headline}>Enter the code</Text>
              {/* mt-2 sub line + edit button */}
              <View style={styles.subRow}>
                <Text style={styles.sub}>
                  Sent to <Text style={styles.subStrong}>{maskPhone(phone)}</Text>
                </Text>
                <Pressable
                  onPress={() => navigation.goBack()}
                  style={styles.editBtn}
                  hitSlop={8}
                >
                  <Pencil size={12} color={tokens.color.accent} />
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              </View>

              {/* mt-8 flex justify-between gap-2 */}
              <View style={styles.otpRow}>
                {digits.map((d, idx) => {
                  const isFilled = !!d;
                  return (
                    <TextInput
                      key={idx}
                      ref={(el) => { inputs.current[idx] = el; }}
                      value={d}
                      onChangeText={(v) => setDigit(idx, v)}
                      keyboardType="number-pad"
                      maxLength={1}
                      autoFocus={idx === 0}
                      selectTextOnFocus
                      selectionColor={tokens.color.accent}
                      style={[
                        styles.cell,
                        isFilled ? styles.cellFilled : styles.cellEmpty,
                      ]}
                    />
                  );
                })}
              </View>

              {/* mt-5 timer / resend */}
              <View style={styles.timerRow}>
                {seconds > 0 ? (
                  <>
                    <Svg width={32} height={32}>
                      <Circle
                        cx={16}
                        cy={16}
                        r={r}
                        fill="none"
                        strokeWidth={3}
                        stroke={tokens.color.surfaceMuted}
                      />
                      <Circle
                        cx={16}
                        cy={16}
                        r={r}
                        fill="none"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={`${c}`}
                        strokeDashoffset={`${ringOffset}`}
                        stroke={tokens.color.accent}
                        transform={`rotate(-90 16 16)`}
                      />
                    </Svg>
                    <Text style={styles.timerText}>Resend in {seconds}s</Text>
                  </>
                ) : (
                  <Pressable onPress={onResend}>
                    <Text style={styles.resendCta}>Resend code</Text>
                  </Pressable>
                )}
              </View>

              {/* mt-8 name field */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tell us your name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Priya Sharma"
                  placeholderTextColor={tokens.color.textSubtle}
                  autoCapitalize="words"
                  selectionColor={tokens.color.accent}
                  style={styles.nameInput}
                />
              </View>

              {/* Referral code — optional, applied if a friend's code is valid */}
              <View style={[styles.field, { marginTop: 12 }]}>
                <Text style={styles.fieldLabel}>Referral code (optional)</Text>
                <TextInput
                  value={referralCode}
                  onChangeText={(t) => setReferralCode(t.toUpperCase().slice(0, 40))}
                  placeholder="FRIEND-1234"
                  placeholderTextColor={tokens.color.textSubtle}
                  autoCapitalize="characters"
                  selectionColor={tokens.color.accent}
                  style={styles.nameInput}
                />
              </View>

              {/* mt-6 h-14 rounded-2xl gradient cta — always tappable, validates inside */}
              <Pressable
                disabled={loading}
                onPress={onVerify}
                style={({ pressed }) => [
                  styles.cta,
                  !looksReady && styles.ctaDim,
                  pressed && { opacity: 0.95 },
                ]}
              >
                <LinearGradient
                  colors={[tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={styles.ctaText}>
                  {loading ? 'Verifying…' : 'Verify & continue'}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  // px-5 + pt-6 (PhoneShell parity), pb generous so content never clips above the keyboard
  body: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48, flexGrow: 1 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.xs,
  },
  step: { ...tokens.text.label, color: tokens.color.textMuted, fontSize: 11 },

  // mt-10 font-display text-display-md
  headline: {
    marginTop: 40,
    ...tokens.text.displayMd,
    color: tokens.color.text,
  },
  // mt-2
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  sub: { ...tokens.text.bodyMd, color: tokens.color.textMuted, flexShrink: 1 },
  subStrong: { color: tokens.color.text, fontFamily: 'Manrope_700Bold' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: tokens.color.accent },

  // mt-8 flex justify-between gap-2 — fixed-width cells so they always render
  // in a clean row regardless of RN Web flex-gap support.
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  // h-14 w-12 rounded-2xl border bg-surface-raised text-center text-2xl font-bold
  cell: {
    width: 48,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: tokens.color.surface,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 22,
    lineHeight: 26,
    color: tokens.color.text,
    ...tokens.shadow.xs,
  },
  cellEmpty: { borderColor: tokens.color.border, color: tokens.color.textMuted },
  cellFilled: {
    borderColor: tokens.color.accent,
    color: tokens.color.text,
    shadowColor: tokens.color.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  // mt-5 timer
  timerRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timerText: { ...tokens.text.bodySm, color: tokens.color.textMuted },
  resendCta: { fontFamily: 'Manrope_700Bold', color: tokens.color.accent, fontSize: 14 },

  // mt-8 name field
  field: { marginTop: 32 },
  fieldLabel: {
    ...tokens.text.label,
    color: tokens.color.textMuted,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: tokens.color.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.color.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: tokens.color.text,
    ...tokens.shadow.xs,
  },

  // mt-6 h-14 rounded-2xl shadow-glow gradient cta
  cta: {
    marginTop: 24,
    height: 56,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...tokens.shadow.glow,
  },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  // Visually hint "fields incomplete" but keep the button tappable so validation
  // can surface a helpful notify message instead of a silent dead button.
  ctaDim: { opacity: 0.6 },
  ctaText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: '#FFFFFF', letterSpacing: 0.2 },

  devChip: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tokens.color.accentSoft,
    borderWidth: 1,
    borderColor: tokens.color.accentSoftStrong,
  },
  devText: { ...tokens.text.label, color: tokens.color.accentInk, fontSize: 11 },

  // ===== verified state =====
  verifiedWrap: {
    marginTop: 96,
    alignItems: 'center',
  },
  // 96x96 box that contains the centered disk + animated halos
  haloBox: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  haloBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(39,176,125,0.20)',
  },
  haloPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(39,176,125,0.30)',
  },
  haloMid: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 40,
    backgroundColor: 'rgba(39,176,125,0.15)',
  },
  successDisk: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.color.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.color.success,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  verifiedTitle: {
    ...tokens.text.displayMd,
    color: tokens.color.text,
  },
  verifiedSub: {
    marginTop: 4,
    ...tokens.text.bodyMd,
    color: tokens.color.textMuted,
  },
});
