import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { confirmAction, notify } from '../../utils/confirm';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Beaker,
  Calendar,
  ChevronRight,
  Lock,
  Pause,
  Wrench,
  Zap,
  Check,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Invoice, Invoices, Subscription, Subscriptions, Ticket, Tickets, Payments } from '../../api/endpoints';
import { Linking } from 'react-native';
import { tokens } from '@theme/tokens';
import { Aurora, EmptyState, Pill, ProgressRing, Skeleton, WaterDrop } from '@ui/index';
import { daysFromNow, formatDate, paiseToInr } from '../../utils/format';
import { apiErrorMessage } from '../../api/client';
import type { RootStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type TimelineItem = {
  id: string;
  date: string;
  title: string;
  meta: string;
  state: 'done' | 'upcoming' | 'inProgress';
};

const TICKET_TITLE: Record<string, string> = {
  FILTER: 'Filter / water-quality check',
  INSTALL: 'Installation',
  SERVICE: 'Service visit',
  REPAIR: 'Repair',
  BILLING: 'Billing query',
  DELIVERY: 'Delivery',
  OTHER: 'Support request',
};

/** Real service history: the customer's own tickets, newest first. */
function ticketsToTimeline(tickets: Ticket[]): TimelineItem[] {
  return tickets.slice(0, 6).map((t) => ({
    id: t.id,
    date: t.createdAt,
    title: TICKET_TITLE[t.category] ?? 'Service request',
    meta: t.status.replace(/_/g, ' ').toLowerCase(),
    state: t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'done' : 'inProgress',
  }));
}

export function MyPlanScreen() {
  const navigation = useNavigation<Nav>();
  const [subs, setSubs] = React.useState<Subscription[] | null>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [timeline, setTimeline] = React.useState<TimelineItem[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setSubs(await Subscriptions.mine());
    } catch (e) {
      notify('Error', apiErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
    // Bills and history are secondary: a failure here hides those sections
    // rather than blocking the plan itself.
    Invoices.mine().then(setInvoices).catch(() => setInvoices([]));
    Tickets.mine().then((t) => setTimeline(ticketsToTimeline(t))).catch(() => setTimeline([]));
  }, []);

  useFocusEffect(React.useCallback(() => { void load(); }, [load]));
  React.useEffect(() => { void load(); }, [load]);

  const sub = subs?.find((s) => s.status === 'ACTIVE') ?? subs?.[0];

  // Oldest to newest, last six — the chart reads left to right.
  const bills = React.useMemo(
    () =>
      [...invoices]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-6)
        .map((inv) => ({
          id: inv.id,
          amount: inv.amountPaise,
          month: new Date(inv.createdAt).toLocaleDateString('en-IN', { month: 'short' }),
        })),
    [invoices]
  );

  const onRecharge = React.useCallback(async () => {
    if (!sub) return;
    const ok = await confirmAction({
      title: 'Recharge plan',
      message: 'Renew your subscription for another cycle?',
      confirmLabel: 'Recharge',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await Subscriptions.recharge(sub.id);
      await load();
      notify('Renewed', 'Your subscription has been recharged.');
    } catch (e) {
      notify('Recharge failed', apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [sub, load]);

  const onQuickFilter = React.useCallback(async () => {
    if (!sub) return;
    setBusy(true);
    try {
      await Tickets.create({
        subscriptionId: sub.id,
        category: 'FILTER',
        description: 'Quick filter / water-quality check requested from My Plan.',
      });
      notify('Ticket raised', 'A technician will reach out shortly.');
    } catch (e) {
      notify('Could not raise ticket', apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [sub]);

  const onPause = React.useCallback(async () => {
    if (!sub) return;
    const isPaused = sub.status === 'PAUSED';
    const ok = await confirmAction({
      title: isPaused ? 'Resume subscription' : 'Pause subscription',
      message: isPaused
        ? 'Resume water flow and billing for this plan?'
        : 'Pause the device. You can resume any time — billing is frozen while paused.',
      confirmLabel: isPaused ? 'Resume' : 'Pause',
    });
    if (!ok) return;
    setBusy(true);
    try {
      if (isPaused) await Subscriptions.resume(sub.id);
      else await Subscriptions.pause(sub.id);
      await load();
    } catch (e) {
      notify(isPaused ? 'Resume failed' : 'Pause failed', apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [sub, load]);

  const onCancel = React.useCallback(async () => {
    if (!sub) return;
    const now = new Date();
    const inTrial = sub.trialEndsAt ? now < new Date(sub.trialEndsAt) : false;
    const afterLockIn = now >= new Date(sub.lockInUntil);
    if (!inTrial && !afterLockIn) {
      notify(
        'Locked-in',
        `This plan is locked-in until ${new Date(sub.lockInUntil).toDateString()}. Contact support for exceptions.`,
      );
      return;
    }
    const blurb = inTrial
      ? '7-day trial: full refund of deposit + first month rent.'
      : 'Post lock-in: deposit refunded within 5–7 working days after quality inspection.';
    const ok = await confirmAction({
      title: 'Cancel subscription',
      message: `${blurb}\n\nProceed?`,
      confirmLabel: 'Cancel plan',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await Subscriptions.cancel(sub.id, inTrial ? 'TRIAL_CANCEL' : 'POST_LOCKIN_CANCEL');
      await load();
      notify(
        'Cancellation submitted',
        `Refund of ₹${Math.round(r.refundPaise / 100)} will be processed in 5–7 working days.`,
      );
    } catch (e) {
      notify('Cancellation failed', apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [sub, load]);

  const onAutopay = React.useCallback(async () => {
    if (!sub) return;
    if (sub.autopayStatus === 'ACTIVE') {
      const ok = await confirmAction({
        title: 'Cancel autopay',
        message: 'Stop automatic monthly debits? You can re-enable autopay any time.',
        confirmLabel: 'Cancel autopay',
        destructive: true,
      });
      if (!ok) return;
      setBusy(true);
      try {
        await Payments.autopay.cancel(sub.id);
        await load();
        notify('Autopay cancelled', 'Monthly debits stopped. Recharge manually next cycle.');
      } catch (e) {
        notify('Could not cancel autopay', apiErrorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const r = await Payments.autopay.create(sub.id);
      await load();
      if (r.shortUrl) {
        // Open Razorpay-hosted authorisation page to set up the e-mandate.
        await Linking.openURL(r.shortUrl);
      } else {
        notify('Autopay setup', 'Authorisation link not available. Try again.');
      }
    } catch (e) {
      notify('Could not setup autopay', apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [sub, load]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Aurora height={420} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={tokens.color.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Subscription</Text>
          <Text style={styles.heading}>My Plan</Text>
        </View>

        {!subs ? (
          <View style={{ marginTop: 24 }}>
            <Skeleton height={220} radius={28} />
          </View>
        ) : !sub ? (
          <View style={{ marginTop: 60 }}>
            <EmptyState
              title="No active plan"
              description="Browse purifiers and pick the rental cycle that fits."
            />
          </View>
        ) : (
          <>
            <StatusCard
              sub={sub}
              busy={busy}
              onRecharge={onRecharge}
              onPause={onPause}
              onAutopay={onAutopay}
              onCancel={onCancel}
              onSmartHealth={() => navigation.navigate('DeviceHealth')}
            />
          </>
        )}

        {/* Timeline — only what actually happened on this account */}
        {timeline.length > 0 && (
        <View style={{ marginTop: 32 }}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrowMuted}>Service history</Text>
              <Text style={styles.sectionTitle}>Timeline</Text>
            </View>
          </View>

          <View style={styles.timelineWrap}>
            <View style={styles.timelineLine} />
            {timeline.map((t) => (
              <View key={t.id} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    t.state === 'done' && {
                      backgroundColor: tokens.color.success,
                      borderColor: tokens.color.success,
                    },
                    t.state === 'inProgress' && {
                      backgroundColor: tokens.color.accent,
                      borderColor: tokens.color.accent,
                    },
                    t.state === 'upcoming' && {
                      backgroundColor: tokens.color.surface,
                      borderColor: tokens.color.accent,
                    },
                  ]}
                >
                  {t.state === 'done' ? (
                    <Check size={10} color="#FFFFFF" strokeWidth={3} />
                  ) : t.state === 'upcoming' ? (
                    <View style={styles.timelineDotInner} />
                  ) : null}
                </View>
                <View style={styles.timelineCard}>
                  <View style={styles.timelineHead}>
                    <Text style={styles.timelineTitle}>{t.title}</Text>
                    {t.state === 'upcoming' ? (
                      <Pill tone="accent" size="sm">Upcoming</Pill>
                    ) : null}
                  </View>
                  <View style={styles.timelineMetaRow}>
                    <Text style={styles.timelineMeta}>{t.meta}</Text>
                    <Text style={styles.timelineDate}>{formatDate(t.date)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
        )}

        {/* Bills — real invoices only; hidden until the account has one */}
        {bills.length > 0 && (
        <View style={styles.billsCard}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrowMuted}>Recent</Text>
              <Text style={styles.sectionTitle}>Bill history</Text>
            </View>
          </View>

          <View style={styles.billsRow}>
            {bills.map((b) => {
              const max = Math.max(...bills.map((x) => x.amount));
              const h = max > 0 ? (b.amount / max) * 100 : 0;
              return (
                <View key={b.id} style={styles.billCol}>
                  <Text style={styles.billAmount}>{paiseToInr(b.amount)}</Text>
                  <View style={styles.billBarTrack}>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                      <LinearGradient
                        colors={[tokens.color.accentGlow, tokens.color.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={[styles.billBarFill, { height: `${h}%` }]}
                      />
                    </View>
                  </View>
                  <Text style={styles.billMonth}>{b.month}</Text>
                </View>
              );
            })}
          </View>
        </View>
        )}

        {/* Side door — water test */}
        <Pressable
          onPress={onQuickFilter}
          disabled={!sub || busy}
          style={({ pressed }) => [styles.sideDoor, pressed && { opacity: 0.95 }]}
        >
          <View style={styles.sideDoorIcon}>
            <Beaker size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sideDoorTitle}>Free water-quality test</Text>
            <Text style={styles.sideDoorSub}>We come to you. No charge, ever.</Text>
          </View>
          <ChevronRight size={18} color={tokens.color.accentInk} />
        </Pressable>

        <Pressable onPress={onCancel} style={styles.cancelLink}>
          <Text style={styles.cancelText}>Cancel subscription</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusCard({
  sub,
  busy,
  onRecharge,
  onPause,
  onAutopay,
  onCancel,
  onSmartHealth,
}: {
  sub: Subscription;
  busy: boolean;
  onRecharge: () => void;
  onPause: () => void;
  onAutopay: () => void;
  onCancel: () => void;
  onSmartHealth: () => void;
}) {
  const startMs = new Date(sub.startedAt).getTime();
  const endMs = new Date(sub.expiresAt).getTime();
  const now = Date.now();
  const total = Math.max(1, endMs - startMs);
  const remaining = Math.max(0, endMs - now);
  const pct = Math.max(0, Math.min(1, remaining / total));
  const daysLeft = Math.max(0, daysFromNow(sub.expiresAt));
  const totalDays = Math.round(total / 86400000);
  const productName = sub.product?.name ?? 'Smart RO Plan';
  const tagline = sub.product?.technology ?? 'Premium subscription';
  const paired = Boolean(sub.device?.serial);
  const serial = sub.device?.serial ?? `SUB-${sub.id.slice(-6).toUpperCase()}`;
  const monthly = sub.booking?.firstPaymentPaise ?? 69900;
  const lastSeenMs = sub.device?.lastHeartbeatAt
    ? new Date(sub.device.lastHeartbeatAt).getTime()
    : 0;
  const isOnline = lastSeenMs > 0 && Date.now() - lastSeenMs < 90 * 60 * 1000;
  const lastSeen = lastSeenMs
    ? `${Math.max(1, Math.round((Date.now() - lastSeenMs) / 60000))}m ago`
    : 'never';

  return (
    <View style={styles.statusCard}>
      <View style={styles.statusHead}>
        <Pill tone="success" dot>Active</Pill>
        <Text style={styles.serialText}>{serial}</Text>
      </View>

      <View style={styles.statusBody}>
        <ProgressRing
          progress={pct}
          size={132}
          stroke={11}
          label={String(daysLeft)}
          caption="DAYS LEFT"
          pulse={false}
        />
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 16 }}>
          <Text style={styles.statusTagline}>{tagline}</Text>
          <Text style={styles.statusName} numberOfLines={2}>{productName}</Text>
          <View style={{ marginTop: 10 }}>
            <Text style={styles.statusPrice}>
              {paiseToInr(monthly)}
              <Text style={styles.statusPriceSuffix}>/mo</Text>
            </Text>
            <Text style={styles.statusCycle}>of {totalDays}-day cycle</Text>
          </View>
        </View>
      </View>

      <View style={styles.metaPanel}>
        <MetaRow icon={<Zap size={14} color={tokens.color.accent} />} label="Renews" value={formatDate(sub.expiresAt)} />
        <MetaRow icon={<Lock size={14} color={tokens.color.accent} />} label="Lock-in until" value={formatDate(sub.lockInUntil)} />
        <MetaRow icon={<Wrench size={14} color={tokens.color.accent} />} label="Next service" value="May 04, 2026" />
      </View>

      {/* Device flow status — surfaces ESP32 pairing + heartbeat */}
      <View style={[styles.metaPanel, { marginTop: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.statusTagline, { color: tokens.color.textMuted }]}>
              {paired ? 'Paired device' : 'Device pairing'}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontFamily: 'Manrope_800ExtraBold', color: tokens.color.text, fontSize: 16, marginTop: 2 }}
            >
              {paired
                ? `${serial} · ${isOnline ? 'Flowing' : lastSeenMs ? 'Offline' : 'Awaiting first connect'}`
                : 'Awaiting hardware install'}
            </Text>
            <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
              {paired
                ? `Last heartbeat · ${lastSeen}`
                : 'We will pair your purifier at installation.'}
            </Text>
          </View>
          <Pill tone={!paired ? 'accent' : isOnline ? 'success' : 'warning'} dot>
            {!paired ? 'Pending' : isOnline ? 'Online' : 'Offline'}
          </Pill>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onRecharge}
          disabled={busy}
          style={({ pressed }) => [
            styles.actionPrimary,
            pressed && { opacity: 0.95 },
            busy && { opacity: 0.6 },
          ]}
        >
          <LinearGradient
            colors={[tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Zap size={14} color="#FFFFFF" />
          <Text style={styles.actionPrimaryText}>{busy ? 'Working…' : 'Recharge'}</Text>
        </Pressable>
        <Pressable
          onPress={onPause}
          style={({ pressed }) => [styles.actionSecondary, pressed && { opacity: 0.95 }]}
        >
          <Pause size={14} color={tokens.color.text} />
          <Text style={styles.actionSecondaryText}>
            {sub.status === 'PAUSED' ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.actionRow, { marginTop: 10 }]}>
        <Pressable
          onPress={onAutopay}
          disabled={busy}
          style={({ pressed }) => [styles.actionSecondary, pressed && { opacity: 0.95 }]}
        >
          <Zap size={14} color={tokens.color.text} />
          <Text style={styles.actionSecondaryText}>
            {sub.autopayStatus === 'ACTIVE' ? 'Autopay on' : 'Setup autopay'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onSmartHealth}
          style={({ pressed }) => [styles.actionSecondary, pressed && { opacity: 0.95 }]}
        >
          <Beaker size={14} color={tokens.color.text} />
          <Text style={styles.actionSecondaryText}>Smart health</Text>
        </Pressable>
      </View>

      {/* Trial banner shows only inside the 7-day window */}
      {sub.trialEndsAt && new Date() < new Date(sub.trialEndsAt) ? (
        <View style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 16,
          backgroundColor: tokens.color.accentTint,
          borderWidth: 1,
          borderColor: tokens.color.accentSoft,
        }}>
          <Text style={{ fontFamily: 'Manrope_800ExtraBold', color: tokens.color.accentInk, fontSize: 13 }}>
            🎉 7-day trial active
          </Text>
          <Text style={{ fontSize: 12, color: tokens.color.accentInk, marginTop: 2 }}>
            Cancel by {new Date(sub.trialEndsAt).toDateString()} for a 100% refund — deposit + first month.
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={onCancel}
        style={({ pressed }) => [{
          marginTop: 10,
          paddingVertical: 10,
          alignItems: 'center',
          opacity: pressed ? 0.6 : 1,
        }]}
      >
        <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 12, color: tokens.color.textMuted, textDecorationLine: 'underline' }}>
          Cancel subscription
        </Text>
      </Pressable>
    </View>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={metaStyles.row}>
      <View style={metaStyles.left}>
        {icon}
        <Text style={metaStyles.label}>{label}</Text>
      </View>
      <Text style={metaStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },

  header: { paddingTop: 12 },
  eyebrow: { ...tokens.text.label, color: tokens.color.textSubtle },
  heading: { ...tokens.text.displayMd, color: tokens.color.text, marginTop: 2 },

  /* Status card — mt-5 rounded-3xl shadow-elevated */
  statusCard: {
    marginTop: 20,
    backgroundColor: tokens.color.surface,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 20,
    ...tokens.shadow.lg,
  },
  statusHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serialText: { fontFamily: 'Manrope_700Bold', fontSize: 12, color: tokens.color.textMuted, letterSpacing: 0.6 },
  statusBody: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  statusTagline: {
    ...tokens.text.label,
    color: tokens.color.accent,
    fontSize: 10,
  },
  statusName: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18, color: tokens.color.text, marginTop: 4, lineHeight: 22 },
  statusPrice: { fontFamily: 'Manrope_700Bold', fontSize: 16, color: tokens.color.text },
  statusPriceSuffix: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: tokens.color.textMuted },
  statusCycle: { fontSize: 12, color: tokens.color.textMuted, marginTop: 2 },

  metaPanel: {
    marginTop: 20,
    backgroundColor: tokens.color.surfaceWarm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 12,
    gap: 4,
  },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...tokens.shadow.glow,
  },
  actionPrimaryText: { fontFamily: 'Manrope_800ExtraBold', color: '#FFFFFF', fontSize: 14 },
  actionSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionSecondaryText: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 14 },

  /* Section heads */
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end' },
  eyebrowMuted: { ...tokens.text.label, color: tokens.color.textSubtle },
  sectionTitle: { ...tokens.text.headingLg, color: tokens.color.text, marginTop: 2 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { fontFamily: 'Manrope_700Bold', color: tokens.color.accent, fontSize: 13 },

  /* Timeline */
  timelineWrap: { marginTop: 14, paddingLeft: 28 },
  timelineLine: {
    position: 'absolute',
    left: 11,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: tokens.color.border,
  },
  timelineItem: { marginBottom: 14 },
  timelineDot: {
    position: 'absolute',
    left: -28,
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.color.accent,
  },
  timelineCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    ...tokens.shadow.xs,
  },
  timelineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineTitle: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: tokens.color.text, flex: 1 },
  timelineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timelineMeta: { fontSize: 11, color: tokens.color.textMuted, flex: 1 },
  timelineDate: { fontSize: 11, color: tokens.color.textMuted, fontFamily: 'Manrope_700Bold' },

  /* Bills */
  billsCard: {
    marginTop: 32,
    backgroundColor: tokens.color.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 18,
    ...tokens.shadow.sm,
  },
  billsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
    marginTop: 12,
  },
  billCol: { flex: 1, alignItems: 'center', gap: 6 },
  billAmount: { fontFamily: 'Manrope_700Bold', fontSize: 9.5, color: tokens.color.textMuted },
  billBarTrack: {
    width: '70%',
    height: '70%',
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  billBarFill: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  billMonth: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: tokens.color.textMuted },

  /* Side door */
  sideDoor: {
    marginTop: 24,
    backgroundColor: tokens.color.accentTint,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.color.accentSoft,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sideDoorIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: tokens.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.glow,
  },
  sideDoorTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14, color: tokens.color.accentInk },
  sideDoorSub: { fontSize: 11, color: 'rgba(10,74,107,0.7)', marginTop: 2 },

  cancelLink: { marginTop: 32, alignItems: 'center' },
  cancelText: {
    fontSize: 12,
    color: tokens.color.textMuted,
    textDecorationLine: 'underline',
  },
});

const metaStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...tokens.text.bodySm, color: tokens.color.textMuted },
  value: { fontFamily: 'Manrope_700Bold', color: tokens.color.text, fontSize: 13 },
});
