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
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../api/client';
import { tokens } from '@theme/tokens';
import { Aurora, WaterDropLogo } from '@ui/index';
import { notify } from '../../utils/confirm';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Password'>;

export function PasswordScreen({ navigation, route }: Props) {
  const prefill = route.params?.phone?.replace('+91', '') ?? '';
  const [phone, setPhone] = React.useState(prefill);
  const [password, setPassword] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [focused, setFocused] = React.useState<'phone' | 'password' | null>(null);

  const signInWithPassword = useAuthStore((s) => s.signInWithPassword);
  const valid = phone.length === 10 && password.length > 0;

  async function onSubmit() {
    if (!valid || loading) return;
    setLoading(true);
    try {
      await signInWithPassword(`+91${phone}`, password);
      // The navigator swaps stacks as soon as the store holds a user.
    } catch (e) {
      notify('Could not sign in', apiErrorMessage(e));
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Aurora height={400} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
              <ArrowLeft size={20} color={tokens.color.text} />
            </Pressable>
            <WaterDropLogo size={28} />
            <View style={styles.back} />
          </View>

          <View style={styles.lockHero}>
            <View style={styles.lockRing}>
              <Lock size={28} color={tokens.color.accent} strokeWidth={2.2} />
            </View>
          </View>

          <Text style={styles.headline}>Welcome back</Text>
          <Text style={styles.lede}>
            Sign in with the password you set on this account.
          </Text>

          <View style={styles.fieldStack}>
            <View>
              <Text style={styles.fieldLabel}>Mobile number</Text>
              <View style={[styles.inputRow, focused === 'phone' && styles.inputRowFocus]}>
                <View style={styles.cc}>
                  <Text style={styles.flag}>🇮🇳</Text>
                  <Text style={styles.ccText}>+91</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                  keyboardType="phone-pad"
                  placeholder="98XXX XXXXX"
                  placeholderTextColor={tokens.color.textSubtle}
                  style={styles.input}
                  selectionColor={tokens.color.accent}
                  maxLength={10}
                  autoFocus={!prefill}
                />
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={[styles.inputRow, focused === 'password' && styles.inputRowFocus]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  secureTextEntry={!show}
                  placeholder="Your password"
                  placeholderTextColor={tokens.color.textSubtle}
                  style={[styles.input, styles.passwordInput]}
                  selectionColor={tokens.color.accent}
                  autoCapitalize="none"
                  autoComplete="password"
                  onSubmitEditing={onSubmit}
                  returnKeyType="go"
                  autoFocus={Boolean(prefill)}
                />
                <Pressable onPress={() => setShow((v) => !v)} hitSlop={8} style={styles.eye}>
                  {show
                    ? <EyeOff size={18} color={tokens.color.textMuted} />
                    : <Eye size={18} color={tokens.color.textMuted} />}
                </Pressable>
              </View>
            </View>

            <Pressable
              disabled={!valid || loading}
              onPress={onSubmit}
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
              <Text style={[styles.ctaText, (!valid || loading) && { color: tokens.color.textSubtle }]}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Text>
              <ArrowRight
                size={16}
                color={valid && !loading ? '#FFFFFF' : tokens.color.textSubtle}
                strokeWidth={2.4}
              />
            </Pressable>

            {/* An OTP sign-in is also the password reset: get in with a code,
                then set a new password from your profile. */}
            <Pressable onPress={() => navigation.navigate('Phone')} hitSlop={8} style={styles.altRow}>
              <Text style={styles.altText}>
                Forgot it? <Text style={styles.altLink}>Sign in with an OTP</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  body: { flex: 1, paddingHorizontal: 20 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
  },
  back: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  lockHero: { marginTop: 44, marginBottom: 28, alignSelf: 'center' },
  lockRing: {
    height: 88,
    width: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.accentTint,
    borderWidth: 1,
    borderColor: tokens.color.accentSoft,
  },

  headline: { ...tokens.text.displayLg, color: tokens.color.text, textAlign: 'center' },
  lede: {
    marginTop: 12,
    ...tokens.text.bodyMd,
    color: tokens.color.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  fieldStack: { marginTop: 36, gap: 16 },

  fieldLabel: { ...tokens.text.label, color: tokens.color.textMuted, marginBottom: 8 },
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
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    letterSpacing: 1.4,
    color: tokens.color.text,
  },
  passwordInput: { letterSpacing: 0.6 },
  eye: { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },

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
  ctaText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: '#FFFFFF' },

  altRow: { alignItems: 'center', paddingTop: 2 },
  altText: { ...tokens.text.bodySm, color: tokens.color.textMuted },
  altLink: { color: tokens.color.accentInk, fontFamily: 'Manrope_700Bold' },
});
