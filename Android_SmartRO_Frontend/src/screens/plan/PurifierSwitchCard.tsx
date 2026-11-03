// "Water switch" — turn the purifier's water on/off over the home Wi-Fi.
//
// Talks straight to the purifier (see utils/localPurifier). Works while the
// SmartRO server is down, as long as the access info was cached once.
// The purifier decides: OFF always works, ON only while the plan is paid —
// a refusal is shown as-is with a way to recharge, never as success.
// Opening the card also asks the purifier to check SmartRO now (refreshPurifier).

import React from 'react';
import { ActivityIndicator, AppState, Keyboard, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Power, PowerOff, TriangleAlert, Wifi, WifiOff, Zap } from 'lucide-react-native';
import { tokens } from '@theme/tokens';
import { Button, Input, Pill, Skeleton } from '@ui/index';
import { toast } from '../../utils/messages';
import { formatDate } from '../../utils/format';
import {
  PLAN_INACTIVE_MESSAGE,
  getCachedAccess,
  getStatus,
  normalizeIPv4,
  purifierIp,
  refreshAccess,
  refreshPurifier,
  setManualIp,
  switchWater,
  type LocalAccessCache,
  type LocalResult,
  type PurifierStatus,
} from '../../utils/localPurifier';

const POLL_MS = 3000;
/** After a first miss, check again sooner so a real outage shows up quickly. */
const RETRY_MS = 1500;
/** The purifier can be busy for a second with its own server call: one miss isn't "unreachable". */
const MISSES_BEFORE_UNREACHABLE = 2;

type AccessState =
  | { phase: 'loading' }
  /** SmartRO says no purifier is paired with this account. */
  | { phase: 'none' }
  /** SmartRO can't be reached and nothing is cached on the phone. */
  | { phase: 'unavailable' }
  | { phase: 'ready'; access: LocalAccessCache };

type Link = 'connecting' | 'connected' | 'unreachable' | 'wrong_device' | 'not_provisioned' | 'no_address';

export function PurifierSwitchCard({ refreshSignal = 0, style }: { refreshSignal?: number; style?: ViewStyle }) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [state, setState] = React.useState<AccessState>({ phase: 'loading' });
  const [status, setStatus] = React.useState<PurifierStatus | null>(null);
  const [link, setLink] = React.useState<Link>('connecting');
  const [linkMessage, setLinkMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [planNotice, setPlanNotice] = React.useState<string | null>(null);
  const [ipOpen, setIpOpen] = React.useState(false);
  const [ipText, setIpText] = React.useState('');
  const [ipError, setIpError] = React.useState<string | undefined>(undefined);

  const busyRef = React.useRef(false);
  const missesRef = React.useRef(0);
  // Bumped whenever a command starts/ends or the address changes, so a poll
  // that was already in flight can't overwrite a newer answer.
  const genRef = React.useRef(0);
  // Open the address box once per address when a different device answers, not on every poll.
  const ipPromptedRef = React.useRef(false);

  const access = state.phase === 'ready' ? state.access : null;
  const ip = purifierIp(access);
  const serial = access?.serial ?? null;

  /* ---- access info: cache first (instant, works offline), then SmartRO ---- */
  const loadAccess = React.useCallback(async () => {
    const cached = await getCachedAccess();
    if (cached) setState((s) => (s.phase === 'ready' ? s : { phase: 'ready', access: cached }));
    const r = await refreshAccess();
    if (r.access) {
      setState({ phase: 'ready', access: r.access });
      // The purifier may check SmartRO only once a day: opening this asks it to check now,
      // so the status polled below shows the latest plan. At most once a minute.
      void refreshPurifier({ access: r.access, throttle: true });
    } else if (r.source === 'backend') setState({ phase: 'none' });
    else setState(cached ? { phase: 'ready', access: cached } : { phase: 'unavailable' });
  }, []);

  useFocusEffect(React.useCallback(() => { void loadAccess(); }, [loadAccess]));
  React.useEffect(() => {
    if (refreshSignal > 0) void loadAccess();
  }, [refreshSignal, loadAccess]);

  /* ---- a new address means we know nothing about the purifier yet ---- */
  const hasAccess = !!access;
  React.useEffect(() => {
    genRef.current += 1;
    missesRef.current = 0;
    ipPromptedRef.current = false;
    setStatus(null);
    setLinkMessage(null);
    setLink(ip ? 'connecting' : 'no_address');
    if (hasAccess && !ip) setIpOpen(true);
  }, [ip, serial, hasAccess]);

  const applyPoll = React.useCallback((r: LocalResult<PurifierStatus>) => {
    if (r.ok) {
      missesRef.current = 0;
      setStatus(r.data);
      setLink('connected');
      setLinkMessage(null);
      if (r.data.planAllows) setPlanNotice(null);
      return;
    }
    if (r.code === 'wrong_device' || r.code === 'not_provisioned') {
      // A definite answer from whatever is at this address: show it now.
      missesRef.current = 0;
      setStatus(null);
      setLink(r.code);
      setLinkMessage(r.message);
      if (r.code === 'wrong_device' && !ipPromptedRef.current) {
        ipPromptedRef.current = true;
        setIpOpen(true);
      }
      return;
    }
    missesRef.current += 1;
    if (missesRef.current >= MISSES_BEFORE_UNREACHABLE) {
      setStatus(null);
      setLink('unreachable');
      setLinkMessage(null);
    }
  }, []);

  /* ---- poll GET /api/status every 3 s, only while this screen is focused ---- */
  useFocusEffect(
    React.useCallback(() => {
      if (!ip || !serial) return undefined;
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tick = async () => {
        let delay = POLL_MS;
        if (!busyRef.current && AppState.currentState === 'active') {
          const gen = genRef.current;
          const r = await getStatus(ip, serial);
          if (stopped) return;
          if (gen === genRef.current) {
            applyPoll(r);
            if (!r.ok && missesRef.current === 1) delay = RETRY_MS;
          }
        }
        if (!stopped) timer = setTimeout(tick, delay);
      };
      void tick();
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
      };
    }, [ip, serial, applyPoll]),
  );

  /* ---- the switch ---- */
  const onToggle = async () => {
    if (busyRef.current || !access || !status) return;
    const on = !status.valveOpen;
    busyRef.current = true;
    setBusy(true);
    genRef.current += 1;
    try {
      const { result, access: next } = await switchWater(access, on);
      genRef.current += 1;
      if (!next) setState({ phase: 'none' });
      else if (next !== access) setState({ phase: 'ready', access: next });

      if (result.ok) {
        missesRef.current = 0;
        setStatus(result.data);
        setLink('connected');
        if (result.data.valveOpen === on) {
          setPlanNotice(null);
          toast.success(on ? 'Water turned on' : 'Water turned off');
        } else {
          toast.warning("The water didn't change", 'Check the purifier and try again.');
        }
        return;
      }
      switch (result.code) {
        case 'plan_inactive':
          setPlanNotice(result.message || PLAN_INACTIVE_MESSAGE);
          toast.warning('Plan not active', result.message || PLAN_INACTIVE_MESSAGE);
          break;
        case 'wrong_device':
        case 'not_provisioned':
          applyPoll(result);
          toast.error("Couldn't switch the water", result.message);
          break;
        case 'unreachable':
          // The command may still have landed; the next status check will tell.
          toast.error("Can't reach the purifier", result.message);
          break;
        default:
          toast.error("Couldn't switch the water", result.message);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /* ---- manual address ---- */
  const openIp = () => {
    setIpText(access?.manualIp ?? ip ?? '');
    setIpError(undefined);
    setIpOpen((v) => !v);
  };
  const onSaveIp = async () => {
    const norm = normalizeIPv4(ipText);
    if (!norm) {
      setIpError('Enter an address like 192.168.1.50');
      return;
    }
    Keyboard.dismiss();
    const next = await setManualIp(norm);
    if (next) setState({ phase: 'ready', access: next });
    setIpError(undefined);
    setIpOpen(false);
  };
  const onForgetIp = async () => {
    const next = await setManualIp(null);
    if (next) setState({ phase: 'ready', access: next });
    setIpText('');
    setIpError(undefined);
  };

  const goRecharge = () => navigation.navigate('Tabs', { screen: 'MyPlan' });

  /* ---- render ---- */
  if (state.phase === 'loading') {
    return <Skeleton height={168} radius={24} style={StyleSheet.flatten([styles.skeleton, style])} />;
  }
  if (state.phase === 'none') return null;
  if (state.phase === 'unavailable') {
    return (
      <View style={[styles.card, style]}>
        <Header title="Water switch" sub="Can't set up the water switch right now. Check your internet and pull down to refresh." />
      </View>
    );
  }

  const connected = link === 'connected' && !!status;
  const waterOn = connected ? status!.valveOpen : null;
  const noKey = !state.access.localKey;
  const canToggle = connected && !noKey && !busy;
  const planBlocked =
    planNotice ?? (connected && !status!.planAllows && status!.planStatus !== 'UNKNOWN'
      ? status!.message ?? PLAN_INACTIVE_MESSAGE
      : null);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headRow}>
        <View style={[styles.iconWrap, { backgroundColor: waterOn ? tokens.color.accentSoft : tokens.color.surfaceMuted }]}>
          {waterOn ? (
            <Power size={20} color={tokens.color.accent} strokeWidth={2.4} />
          ) : (
            <PowerOff size={20} color={tokens.color.textMuted} strokeWidth={2.4} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Water switch</Text>
          <Text style={styles.cardSub}>
            {waterOn === null
              ? link === 'connecting' ? 'Checking your purifier…' : 'Water status unknown'
              : waterOn ? 'Water is on' : 'Water is off'}
          </Text>
        </View>
        {waterOn === null ? null : (
          <Pill tone={waterOn ? 'success' : 'neutral'} size="sm" dot>
            {waterOn ? 'ON' : 'OFF'}
          </Pill>
        )}
      </View>

      <Button
        title={waterOn ? 'Turn water off' : 'Turn water on'}
        variant={waterOn ? 'outline' : 'primary'}
        size="lg"
        fullWidth
        loading={busy}
        disabled={!canToggle}
        onPress={() => void onToggle()}
        iconLeft={
          waterOn ? (
            <PowerOff size={16} color={tokens.color.text} />
          ) : (
            <Power size={16} color="#FFFFFF" />
          )
        }
        style={{ marginTop: 14 }}
      />

      {connected ? <PlanLine status={status!} /> : null}

      {noKey ? (
        <Text style={[styles.note, { color: tokens.color.warning }]}>
          The water switch isn't set up for this purifier yet. Please contact support.
        </Text>
      ) : null}

      {planBlocked ? (
        <View style={styles.notice}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TriangleAlert size={18} color={tokens.color.warning} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeText}>{planBlocked}</Text>
              {connected ? (
                <Text style={styles.noticeSub}>
                  {status!.cloudOk
                    ? 'Just recharged? It can take a few minutes to reach your purifier.'
                    : "Your purifier can't reach SmartRO right now, so a new recharge may take a while to show."}
                </Text>
              ) : null}
            </View>
          </View>
          <Button
            title="Recharge"
            variant="soft"
            size="sm"
            onPress={goRecharge}
            iconLeft={<Zap size={14} color={tokens.color.accentInk} />}
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
          />
        </View>
      ) : null}

      <ConnectionRow link={link} message={linkMessage} />

      <Pressable onPress={openIp} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 10 }}>
        <Text style={styles.link}>
          {state.access.manualIp ? `Purifier IP: ${state.access.manualIp} · Change` : 'Enter purifier IP'}
        </Text>
      </Pressable>

      {ipOpen ? (
        <View style={{ marginTop: 10 }}>
          <Input
            label="Purifier IP address"
            value={ipText}
            onChangeText={(t) => {
              setIpText(t);
              if (ipError) setIpError(undefined);
            }}
            placeholder="192.168.1.50"
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void onSaveIp()}
            error={ipError}
            hint="Find it in your Wi-Fi router's app, under connected devices."
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button title="Save" variant="soft" size="sm" onPress={() => void onSaveIp()} />
            {state.access.manualIp ? (
              <Button title="Forget this address" variant="ghost" size="sm" onPress={() => void onForgetIp()} />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={styles.headRow}>
      <View style={[styles.iconWrap, { backgroundColor: tokens.color.surfaceMuted }]}>
        <WifiOff size={20} color={tokens.color.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
    </View>
  );
}

function PlanLine({ status }: { status: PurifierStatus }) {
  let line: string;
  if (status.planAllows) {
    const label = status.planStatus === 'GRACE' ? 'Plan in grace period' : 'Plan active';
    line = status.planUntil ? `${label} · until ${formatDate(status.planUntil)}` : label;
  } else if (status.planStatus === 'UNKNOWN') {
    line = "Your purifier hasn't checked your plan yet.";
  } else {
    line = 'Plan not active';
  }
  // When the plan is blocked, the purifier's message is shown in the notice below instead.
  const extra = status.planAllows ? status.message : null;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.planLine}>{line}</Text>
      {extra ? <Text style={styles.note}>{extra}</Text> : null}
    </View>
  );
}

function ConnectionRow({ link, message }: { link: Link; message: string | null }) {
  if (link === 'connected') {
    return (
      <View style={styles.connRow}>
        <Wifi size={16} color={tokens.color.success} />
        <Text style={[styles.connText, { color: tokens.color.success }]}>Connected over Wi-Fi</Text>
      </View>
    );
  }
  if (link === 'connecting') {
    return (
      <View style={styles.connRow}>
        <ActivityIndicator size="small" color={tokens.color.accent} />
        <Text style={[styles.connText, { color: tokens.color.textMuted }]}>Looking for your purifier on Wi-Fi…</Text>
      </View>
    );
  }
  const text =
    link === 'no_address'
      ? "We don't know your purifier's address yet. Enter it below."
      : link === 'unreachable' || !message
        ? "Can't reach the purifier — make sure your phone is on the same Wi-Fi as the purifier"
        : message;
  return (
    <View style={styles.connRow}>
      <WifiOff size={16} color={tokens.color.warning} style={{ marginTop: 2 }} />
      <Text style={[styles.connText, { color: tokens.color.warning }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same card look as the rest of the device-health screen.
  card: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    ...tokens.shadow.xs,
  },
  skeleton: { marginBottom: 4 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14, color: tokens.color.text },
  cardSub: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 2 },
  planLine: { ...tokens.text.bodySm, color: tokens.color.inkSoft },
  note: { ...tokens.text.caption, color: tokens.color.textMuted, marginTop: 6 },
  notice: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: tokens.color.warningSoft,
  },
  noticeText: { fontFamily: 'Manrope_700Bold', fontSize: 14, lineHeight: 20, color: tokens.color.text },
  noticeSub: { ...tokens.text.caption, color: tokens.color.inkSoft, marginTop: 4 },
  connRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 },
  connText: { flex: 1, fontFamily: 'Manrope_700Bold', fontSize: 13, lineHeight: 18 },
  link: { ...tokens.text.caption, fontFamily: 'Manrope_700Bold', color: tokens.color.accentPressed },
});
