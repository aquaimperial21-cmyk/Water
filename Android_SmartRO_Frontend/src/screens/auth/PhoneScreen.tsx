import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { firebaseErrorMessage, sendPhoneCode } from '../../utils/firebasePhone';
import { tokens } from '@theme/tokens';
import { Aurora, WaterDrop, WaterDropLogo } from '@ui/index';
import { notify } from '../../utils/confirm';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Phone'>;

export function PhoneScreen({ navigation }: Props) {
  // Never pre-fill in a shipped build: the seeded demo number belongs to a real
  // person in production, and the CTA lights up on it before the user types.
  const [phone, setPhone] = React.useState(__DEV__ ? '9876543210' : '');
  const [loading, setLoading] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  const valid = phone.length === 10;

  async function onContinue() {
    const e164 = `+91${phone.replace(/\s+/g, '')}`;
    if (!/^\+\d{10,15}$/.test(e164)) {
      notify('Invalid number', 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      await sendPhoneCode(e164);
      navigation.navigate('Otp', { phone: e164 });
    } catch (e) {
      notify('Could not send code', firebaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Aurora height={460} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.body}>
          {/* pt-6 flex justify-between */}
          <View style={styles.topRow}>
            <WaterDropLogo size={28} />
            <Text style={styles.step}>Step 1 of 2</Text>
          </View>

          {/* mt-12 mb-8 — h-32 w-32 with two animated halos + 64 drop */}
          <View style={styles.dropHero}>
            <MotiView
              from={{ scale: 1, opacity: 0.55 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ type: 'timing', duration: 2000, loop: true, repeatReverse: false }}
              style={styles.haloPulse}
            />
            <View style={styles.haloOuter} />
            <View style={styles.haloInner} />
            <WaterDrop size={64} />
          </View>

          {/* font-display text-display-lg text-center */}
          <Text style={styles.headline}>
            Clean water,{'\n'}
            <Text style={{ color: tokens.color.accent }}>on tap.</Text>
          </Text>

          {/* mt-3 text-center text-body-md text-muted-foreground */}
          <Text style={styles.lede}>
            Rental purifiers across India. Filters, service & install — all included.
          </Text>

          {/* mt-10 space-y-4 (children gap 16) */}
          <View style={styles.fieldStack}>
            {/* label "Mobile number" + mt-2 input row */}
            <View>
              <Text style={styles.fieldLabel}>Mobile number</Text>
              <View style={[styles.inputRow, focused && styles.inputRowFocus]}>
                <View style={styles.cc}>
                  <Text style={styles.flag}>🇮🇳</Text>
                  <Text style={styles.ccText}>+91</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  keyboardType="phone-pad"
                  placeholder="98XXX XXXXX"
                  placeholderTextColor={tokens.color.textSubtle}
                  style={styles.input}
                  autoFocus
                  selectionColor={tokens.color.accent}
                  maxLength={10}
                />
              </View>
            </View>

            {/* rounded-xl bg-primary-tint border border-primary-soft px-3.5 py-2.5 */}
            <View style={styles.notice}>
              <ShieldCheck size={14} color={tokens.color.accent} />
              <Text style={styles.noticeText}>
                We'll text you a one-time code. Your number stays private.
              </Text>
            </View>

            {/* h-14 rounded-2xl text-body-lg font-bold gradient-accent shadow-glow */}
            <Pressable
              disabled={!valid || loading}
              onPress={onContinue}
              style={({ pressed }) => [
                styles.cta,
                (!valid || loading) && styles.ctaDisabled,
                pressed && valid && !loading && { opacity: 0.95 },
              ]}
            >
              <LinearGradient
                colors={
                  valid && !loading
                    ? [tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]
                    : [tokens.color.surfaceMuted, tokens.color.surfaceMuted]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text
                style={[
                  styles.ctaText,
                  (!valid || loading) && { color: tokens.color.textSubtle },
                ]}
              >
                {loading ? 'Sending…' : 'Send code'}
              </Text>
              <ArrowRight
                size={16}
                color={valid && !loading ? '#FFFFFF' : tokens.color.textSubtle}
                strokeWidth={2.4}
              />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Password', { phone: phone.length === 10 ? `+91${phone}` : undefined })}
              hitSlop={8}
              style={styles.altRow}
            >
              <Text style={styles.altText}>
                Already set a password? <Text style={styles.altLink}>Sign in with it</Text>
              </Text>
            </Pressable>
          </View>

          {/* mt-6 text-center text-xs text-muted-foreground leading-relaxed */}
          <Text style={styles.terms}>
            By continuing you agree to ImperialAqua's{' '}
            <Text style={styles.link}>Terms</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  // PhoneShell px-5 + content
  body: { flex: 1, paddingHorizontal: 20 },

  // pt-6
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
  },
  step: { ...tokens.text.label, color: tokens.color.textMuted, fontSize: 11 },

  // mt-12 mb-8, h-32 w-32, grid place-items-center
  dropHero: {
    marginTop: 48,
    marginBottom: 32,
    alignSelf: 'center',
    height: 128,
    width: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // bg-primary/15 animate-ring-pulse — outer pulse ring
  haloPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 64,
    backgroundColor: 'rgba(35,186,251,0.55)',
  },
  // bg-primary/15 absolute inset-0
  haloOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 64,
    backgroundColor: 'rgba(35,186,251,0.15)',
  },
  // bg-primary/10 absolute inset-3 (12px inset)
  haloInner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 52,
    backgroundColor: 'rgba(35,186,251,0.10)',
  },

  // text-display-lg text-center
  headline: {
    ...tokens.text.displayLg,
    color: tokens.color.text,
    textAlign: 'center',
  },
  // mt-3 text-center text-body-md text-muted-foreground
  lede: {
    marginTop: 12,
    ...tokens.text.bodyMd,
    color: tokens.color.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // mt-10 space-y-4 (children gap 16)
  fieldStack: { marginTop: 40, gap: 16 },

  // text-eyebrow uppercase text-muted-foreground
  fieldLabel: {
    ...tokens.text.label,
    color: tokens.color.textMuted,
    marginBottom: 8,
  },
  // rounded-2xl bg-surface-raised border, focus-within: border-primary + ring
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: tokens.color.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.color.border,
    overflow: 'hidden',
    ...tokens.shadow.xs,
  },
  inputRowFocus: {
    borderColor: tokens.color.accent,
    shadowColor: tokens.color.accent,
    shadowOpacity: 0.2,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  // border-r border-border bg-surface-warm px-4
  cc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    backgroundColor: tokens.color.surfaceWarm,
    borderRightWidth: 1,
    borderRightColor: tokens.color.border,
  },
  flag: { fontSize: 16 },
  ccText: { ...tokens.text.bodyLg, color: tokens.color.text, fontFamily: 'Manrope_700Bold' },
  // px-4 py-4 text-title-md font-semibold tracking-wider
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    letterSpacing: 1.4,
    color: tokens.color.text,
  },

  // rounded-xl bg-primary-tint border-primary-soft px-3.5 py-2.5
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: tokens.color.accentTint,
    borderWidth: 1,
    borderColor: tokens.color.accentSoft,
  },
  noticeText: { flex: 1, ...tokens.text.bodySm, color: tokens.color.accentInk },

  // h-14 rounded-2xl shadow-glow
  cta: {
    height: 56,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...tokens.shadow.glow,
  },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  ctaText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
  },

  altRow: { alignItems: 'center', paddingTop: 2 },
  altText: { ...tokens.text.bodySm, color: tokens.color.textMuted },
  altLink: { color: tokens.color.accentInk, fontFamily: 'Manrope_700Bold' },

  // mt-6 text-center text-xs leading-relaxed
  terms: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: tokens.color.textMuted,
    fontFamily: 'Manrope_400Regular',
  },
  link: {
    color: tokens.color.text,
    fontFamily: 'Manrope_700Bold',
    textDecorationLine: 'underline',
  },
});
