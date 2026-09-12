import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { notify } from '../../utils/confirm';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Filter as FilterIcon,
  Headphones,
  Lock,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react-native';
import { Booking, Bookings, Catalog, Kyc, Product, PlanCityPrice } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { tokens } from '@theme/tokens';
import { Stepper } from '@ui/index';
import { paiseToInr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Booking'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type Phase = 'creating' | 'identity' | 'sign' | 'paying' | 'done';
const PHASE_INDEX: Record<Phase, number> = {
  creating: 0,
  identity: 0,
  sign: 1,
  paying: 2,
  done: 3,
};

const STEPS = ['Identity', 'Sign', 'Pay', 'Done'];

export function BookingScreen({ route, navigation }: Props) {
  const { productId, planId, cityId } = route.params;
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = React.useState<Phase>('creating');
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [product, setProduct] = React.useState<Product | null>(null);
  const [price, setPrice] = React.useState<PlanCityPrice | null>(null);
  const [aadhaar, setAadhaar] = React.useState('');
  const [pan, setPan] = React.useState('');
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await Bookings.create({ productId, planId, cityId });
        if (!alive) return;
        setBooking(b);
        setProduct(b.product ?? null);
        // Best effort: fetch matching plan/city price for accurate display
        try {
          const all = await Catalog.pricing(productId, cityId);
          const match = all.find((p) => p.planId === planId) ?? all[0];
          if (alive) setPrice(match ?? null);
        } catch {}
        setPhase('identity');
      } catch (e) {
        if (alive) setError(apiErrorMessage(e));
      }
    })();
    return () => { alive = false; };
  }, [productId, planId, cityId]);

  async function submitKyc() {
    if (!/^\d{4}$/.test(aadhaar)) return notify('Aadhaar', 'Enter the last 4 digits');
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan.toUpperCase())) return notify('PAN', 'Format ABCDE1234F');
    setWorking(true);
    try {
      await Kyc.submit({ aadhaarLast4: aadhaar, pan: pan.toUpperCase() });
      setPhase('sign');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setWorking(false);
    }
  }

  async function signAndPay() {
    if (!booking) return;
    setWorking(true);
    try {
      await Bookings.signAgreement(booking.id);
      setPhase('paying');
      await Bookings.pay(booking.id);
      setPhase('done');
    } catch (e) {
      setError(apiErrorMessage(e));
      setPhase('sign');
    } finally {
      setWorking(false);
    }
  }

  if (error) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.errorWrap}>
          <View style={styles.errorIcon}>
            <X size={28} color={tokens.color.danger} strokeWidth={2.4} />
          </View>
          <Text style={styles.errorTitle}>Booking failed</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const monthly = price?.monthlyPricePaise ?? 0;
  const deposit = price?.depositPaise ?? 0;
  const subtotal = monthly + deposit;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;
  const months = Math.max(1, Math.round((price?.plan?.durationDays ?? 30) / 30));

  return (
    <View style={styles.root}>
      {/* Floating top bar */}
      <SafeAreaView edges={['top']} style={styles.topWrap}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (phase === 'identity' ? navigation.goBack() : phase === 'sign' ? setPhase('identity') : navigation.goBack())}
            style={styles.iconBtn}
            hitSlop={10}
          >
            <ArrowLeft size={18} color={tokens.color.text} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topEyebrow}>Checkout</Text>
            <Text style={styles.topTitle} numberOfLines={1}>
              {product?.name ?? 'Subscription'}
            </Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Stepper steps={STEPS} current={PHASE_INDEX[phase]} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 200,
          paddingTop: insets.top + 110,
        }}
      >
        {/* Order summary */}
        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <Text style={styles.eyebrow}>Order summary</Text>
            <Text style={styles.summaryTag}>{months}-month plan</Text>
          </View>
          <SumRow label="First month" value={paiseToInr(monthly)} />
          <SumRow label="Refundable deposit" value={deposit === 0 ? 'Waived' : paiseToInr(deposit)} />
          <SumRow label="GST 18%" value={paiseToInr(gst)} />
          <View style={styles.summaryDivider} />
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>Total today</Text>
            <Text style={styles.summaryTotalValue}>{paiseToInr(total)}</Text>
          </View>
        </View>

        {/* Step body */}
        <View style={{ marginTop: 24 }}>
          {phase === 'creating' ? (
            <View style={styles.creatingBox}>
              <ActivityIndicator color={tokens.color.accent} />
              <Text style={styles.creatingText}>Creating your booking…</Text>
            </View>
          ) : null}

          {phase === 'identity' ? (
            <View>
              <Text style={styles.h2}>Verify your identity</Text>
              <Text style={styles.h2Sub}>Required by RBI for rental subscriptions.</Text>

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Aadhaar (last 4)</Text>
              <TextInput
                value={aadhaar}
                onChangeText={(t) => setAadhaar(t.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                placeholderTextColor={tokens.color.textSubtle}
                keyboardType="number-pad"
                style={styles.input}
                selectionColor={tokens.color.accent}
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>PAN</Text>
              <TextInput
                value={pan}
                onChangeText={(t) => setPan(t.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F"
                placeholderTextColor={tokens.color.textSubtle}
                autoCapitalize="characters"
                style={styles.input}
                selectionColor={tokens.color.accent}
              />

              <View style={styles.lockNote}>
                <Lock size={14} color={tokens.color.success} />
                <Text style={styles.lockNoteText}>
                  Encrypted at rest. Never shared without your consent.
                </Text>
              </View>
            </View>
          ) : null}

          {phase === 'sign' ? (
            <View>
              <Text style={styles.h2}>Sign agreement</Text>
              <Text style={styles.h2Sub}>Plain English. No fine print games.</Text>
              <View style={{ marginTop: 16, gap: 10 }}>
                {[
                  { t: 'Lock-in period', d: `${months} month${months > 1 ? 's' : ''}, then month-to-month.` },
                  { t: '7-day trial', d: 'Full refund of deposit + first month if you cancel within 7 days of install.' },
                  { t: 'Recurring billing', d: `${paiseToInr(monthly)} every month. Set up autopay from My Plan, or recharge manually.` },
                  { t: 'Return policy', d: 'Cancel anytime after lock-in — deposit refunded after pickup & inspection.' },
                  { t: 'Maintenance covered', d: 'All filters, service & visits included.' },
                ].map((b) => (
                  <View key={b.t} style={styles.bullet}>
                    <View style={styles.bulletDot}>
                      <Check size={11} color={tokens.color.accentInk} strokeWidth={3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bulletTitle}>{b.t}</Text>
                      <Text style={styles.bulletBody}>{b.d}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Pressable onPress={() => {}} style={{ marginTop: 12 }}>
                <Text style={styles.linkBtn}>Read full agreement</Text>
              </Pressable>
            </View>
          ) : null}

          {phase === 'paying' ? (
            <View style={styles.payingBox}>
              <MotiView
                from={{ scale: 1, opacity: 0.55 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ type: 'timing', duration: 2000, loop: true }}
                style={styles.payingHalo}
              />
              <View style={styles.payingDisk}>
                <LinearGradient
                  colors={[tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <CreditCard size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.payingTitle}>Processing payment…</Text>
              <Text style={styles.payingBody}>Don't close this screen.</Text>
              <MotiView
                from={{ rotate: '0deg' }}
                animate={{ rotate: '360deg' }}
                transition={{ type: 'timing', duration: 1200, loop: true }}
                style={{ marginTop: 16 }}
              >
                <ActivityIndicator color={tokens.color.accent} />
              </MotiView>
            </View>
          ) : null}

          {phase === 'done' ? (
            <MotiView
              from={{ rotateX: '90deg', opacity: 0 }}
              animate={{ rotateX: '0deg', opacity: 1 }}
              transition={{ type: 'timing', duration: 500 }}
              style={styles.doneBox}
            >
              <View style={styles.successHalo} />
              <MotiView
                from={{ scale: 1, opacity: 0.55 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ type: 'timing', duration: 2000, loop: true }}
                style={styles.successHalo}
              />
              <View style={styles.successDisk}>
                <Check size={36} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={styles.doneTitle}>You're all set</Text>
              <Text style={styles.doneBody}>A confirmation has been sent to your phone.</Text>

              <View style={styles.factRow}>
                <FactTile icon={<Truck size={18} color={tokens.color.accentInk} />} title="48 hr" sub="Install" />
                <FactTile icon={<FilterIcon size={18} color={tokens.color.accentInk} />} title="Filters" sub="Included" />
                <FactTile icon={<Headphones size={18} color={tokens.color.accentInk} />} title="24/7" sub="Support" />
              </View>
            </MotiView>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      {phase === 'identity' || phase === 'sign' || phase === 'done' ? (
        <View
          style={[styles.footerWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          {phase === 'identity' ? (
            <CtaButton
              disabled={aadhaar.length !== 4 || pan.length !== 10 || working}
              loading={working}
              onPress={submitKyc}
              icon={<ShieldCheck size={16} color="#FFFFFF" />}
              label="Continue to agreement"
            />
          ) : null}
          {phase === 'sign' ? (
            <CtaButton
              loading={working}
              disabled={working}
              onPress={signAndPay}
              label="Sign & continue to payment"
            />
          ) : null}
          {phase === 'done' ? (
            <View style={{ gap: 10 }}>
              {booking ? (
                <CtaButton
                  onPress={() => (nav as any).navigate('InstallSlot', { bookingId: booking.id })}
                  label="Pick installation slot"
                />
              ) : null}
              <Pressable
                onPress={() => (nav as any).navigate('MyPlan')}
                style={({ pressed }) => [{ alignItems: 'center', paddingVertical: 12, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={styles.linkBtn}>Go to My Plan</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={sumRowStyles.row}>
      <Text style={sumRowStyles.label}>{label}</Text>
      <Text style={sumRowStyles.value}>{value}</Text>
    </View>
  );
}

function FactTile({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <View style={tileStyles.tile}>
      <View style={tileStyles.iconBox}>{icon}</View>
      <Text style={tileStyles.title}>{title}</Text>
      <Text style={tileStyles.sub}>{sub}</Text>
    </View>
  );
}

function CtaButton({
  onPress,
  label,
  disabled,
  loading,
  icon,
}: {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const enabled = !disabled && !loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      style={({ pressed }) => [
        ctaStyles.btn,
        !enabled && ctaStyles.btnDisabled,
        pressed && enabled && { opacity: 0.95 },
      ]}
    >
      <LinearGradient
        colors={
          enabled
            ? [tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]
            : [tokens.color.surfaceMuted, tokens.color.surfaceMuted]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {icon}
      <Text
        style={[
          ctaStyles.text,
          !enabled && { color: tokens.color.textSubtle },
        ]}
      >
        {loading ? 'Working…' : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },

  topWrap: {
    backgroundColor: 'rgba(250,248,245,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  iconBtn: {
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
  topEyebrow: { ...tokens.text.label, color: tokens.color.textSubtle, fontSize: 9.5 },
  topTitle: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: tokens.color.text, marginTop: 1 },

  summary: {
    backgroundColor: tokens.color.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 18,
    ...tokens.shadow.sm,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eyebrow: { ...tokens.text.label, color: tokens.color.textSubtle },
  summaryTag: { fontFamily: 'Manrope_700Bold', color: tokens.color.accent, fontSize: 12 },
  summaryDivider: { height: 1, backgroundColor: tokens.color.border, marginTop: 10 },
  summaryTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  summaryTotalLabel: { fontFamily: 'Manrope_700Bold', fontSize: 15, color: tokens.color.text },
  summaryTotalValue: { fontFamily: 'Manrope_800ExtraBold', fontSize: 22, color: tokens.color.text },

  h2: { ...tokens.text.headingLg, color: tokens.color.text },
  h2Sub: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 2 },

  fieldLabel: { ...tokens.text.label, color: tokens.color.textSubtle, marginBottom: 6 },
  input: {
    backgroundColor: tokens.color.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.color.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    letterSpacing: 1.2,
    color: tokens.color.text,
    ...tokens.shadow.xs,
  },
  lockNote: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: tokens.color.successSoft,
    borderWidth: 1,
    borderColor: 'rgba(39,176,125,0.25)',
  },
  lockNoteText: { flex: 1, ...tokens.text.bodySm, color: tokens.color.success, fontFamily: 'Manrope_600SemiBold' },

  bullet: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    ...tokens.shadow.xs,
  },
  bulletDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletTitle: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: tokens.color.text },
  bulletBody: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 2 },

  linkBtn: { fontFamily: 'Manrope_700Bold', color: tokens.color.accent, fontSize: 13, paddingVertical: 6 },

  creatingBox: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  creatingText: { ...tokens.text.bodySm, color: tokens.color.textMuted },

  payingBox: { alignItems: 'center', paddingVertical: 30 },
  payingHalo: {
    position: 'absolute',
    top: 16,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(35,186,251,0.18)',
  },
  payingDisk: {
    width: 80,
    height: 80,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    ...tokens.shadow.glow,
  },
  payingTitle: { ...tokens.text.headingLg, color: tokens.color.text, marginTop: 22 },
  payingBody: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 4 },

  doneBox: { alignItems: 'center', paddingTop: 20 },
  successHalo: {
    position: 'absolute',
    top: 0,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(39,176,125,0.18)',
  },
  successDisk: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.color.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: tokens.color.success,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  doneTitle: { ...tokens.text.displayMd, color: tokens.color.text, marginTop: 20 },
  doneBody: { ...tokens.text.bodyMd, color: tokens.color.textMuted, marginTop: 6, textAlign: 'center' },
  factRow: { flexDirection: 'row', gap: 8, marginTop: 22, alignSelf: 'stretch' },

  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: tokens.color.bg,
  },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.color.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: { ...tokens.text.headingLg, color: tokens.color.text, marginTop: 16 },
  errorBody: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 8, textAlign: 'center' },
  errorBtn: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
  },
  errorBtnText: { fontFamily: 'Manrope_700Bold', color: tokens.color.text },
});

const sumRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { ...tokens.text.bodySm, color: tokens.color.textMuted },
  value: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 14 },
});

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 12,
    alignItems: 'center',
    ...tokens.shadow.xs,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: tokens.color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: tokens.color.text, marginTop: 8 },
  sub: { fontSize: 11, color: tokens.color.textMuted, marginTop: 2 },
});

const ctaStyles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...tokens.shadow.glow,
  },
  btnDisabled: { shadowOpacity: 0, elevation: 0 },
  text: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
