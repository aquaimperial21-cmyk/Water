import React from 'react';
import {
  ActivityIndicator,
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
import { ArrowLeft, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Auth } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { tokens } from '@theme/tokens';
import { Aurora } from '@ui/index';
import { notify } from '../../utils/confirm';
import type { RootStackParamList } from '../../navigation';

const MIN_LENGTH = 8;

export function SetPasswordScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [hasPassword, setHasPassword] = React.useState<boolean | null>(null);
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    Auth.me()
      .then((p) => setHasPassword(Boolean(p?.hasPassword)))
      .catch(() => setHasPassword(false));
  }, []);

  const longEnough = next.length >= MIN_LENGTH;
  const matches = next.length > 0 && next === confirm;
  const ready = longEnough && matches && (!hasPassword || current.length > 0) && !saving;

  async function onSave() {
    if (!ready) return;
    setSaving(true);
    try {
      await Auth.setPassword(next, hasPassword ? current : undefined);
      notify(
        hasPassword ? 'Password changed' : 'Password set',
        'You can now sign in with your mobile number and this password.'
      );
      nav.goBack();
    } catch (e) {
      notify('Could not save', apiErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Aurora height={320} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.back}>
            <ArrowLeft size={20} color={tokens.color.text} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {hasPassword ? 'Change password' : 'Set a password'}
          </Text>
          <View style={styles.back} />
        </View>

        {hasPassword === null ? (
          <View style={styles.loading}>
            <ActivityIndicator color={tokens.color.accent} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.notice}>
              <ShieldCheck size={14} color={tokens.color.accent} />
              <Text style={styles.noticeText}>
                {hasPassword
                  ? 'You can still sign in with an OTP at any time.'
                  : 'A password lets you skip the OTP next time. You can always sign in with an OTP instead.'}
              </Text>
            </View>

            {hasPassword ? (
              <Field
                label="Current password"
                value={current}
                onChange={setCurrent}
                secure={!show}
                autoFocus
              />
            ) : null}

            <Field
              label={hasPassword ? 'New password' : 'Password'}
              value={next}
              onChange={setNext}
              secure={!show}
              autoFocus={!hasPassword}
              hint={`At least ${MIN_LENGTH} characters`}
              ok={longEnough}
            />

            <Field
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
              secure={!show}
              hint={confirm.length > 0 && !matches ? 'Passwords don’t match' : undefined}
              ok={matches}
              error={confirm.length > 0 && !matches}
            />

            <Pressable onPress={() => setShow((v) => !v)} hitSlop={8} style={styles.showRow}>
              {show
                ? <EyeOff size={15} color={tokens.color.textMuted} />
                : <Eye size={15} color={tokens.color.textMuted} />}
              <Text style={styles.showText}>{show ? 'Hide passwords' : 'Show passwords'}</Text>
            </Pressable>

            <Pressable
              disabled={!ready}
              onPress={onSave}
              style={({ pressed }) => [
                styles.cta,
                !ready && styles.ctaDisabled,
                pressed && ready && { opacity: 0.95 },
              ]}
            >
              <LinearGradient
                colors={
                  ready
                    ? [tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]
                    : [tokens.color.surfaceMuted, tokens.color.surfaceMuted]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={[styles.ctaText, !ready && { color: tokens.color.textSubtle }]}>
                {saving ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure: boolean;
  autoFocus?: boolean;
  hint?: string;
  ok?: boolean;
  error?: boolean;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocus,
          props.error && styles.inputRowError,
        ]}
      >
        <TextInput
          value={props.value}
          onChangeText={props.onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={props.secure}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={props.autoFocus}
          placeholder="••••••••"
          placeholderTextColor={tokens.color.textSubtle}
          style={styles.input}
          selectionColor={tokens.color.accent}
        />
        {props.ok ? (
          <View style={styles.tick}>
            <Check size={16} color={tokens.color.accent} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      {props.hint ? (
        <Text style={[styles.hint, props.error && styles.hintError]}>{props.hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  back: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...tokens.text.bodyLg, fontFamily: 'Manrope_800ExtraBold', color: tokens.color.text },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 16 },

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
  inputRowFocus: { borderColor: tokens.color.accent },
  inputRowError: { borderColor: tokens.color.danger ?? '#C2402F' },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Manrope_700Bold',
    fontSize: 17,
    letterSpacing: 0.6,
    color: tokens.color.text,
  },
  tick: { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },

  hint: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 6, marginLeft: 4 },
  hintError: { color: tokens.color.danger ?? '#C2402F' },

  showRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 2 },
  showText: { ...tokens.text.bodySm, color: tokens.color.textMuted },

  cta: {
    marginTop: 8,
    height: 56,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.glow,
  },
  ctaDisabled: { shadowOpacity: 0, elevation: 0 },
  ctaText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: '#FFFFFF' },
});
