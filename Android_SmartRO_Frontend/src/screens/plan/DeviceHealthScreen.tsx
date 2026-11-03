// Smart device dashboard — live TDS / filter-life / usage / leak status.
// Polls /devices/me/health on focus and rolls into a card grid. Histories
// come from /devices/me/readings?kind=TDS|USAGE|FILTER_LIFE.
//
// The screen is intentionally minimal: matches the "Smart Alerts" promise
// that competitors market without claiming features the firmware can't yet
// produce.
//
// The water switch card at the top talks to the purifier over home Wi-Fi and
// works on its own: it shows even while /devices/me/health is loading or failing.

import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Beaker, Droplets, Filter, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react-native';
import { DeviceHealthApi, DeviceHealth, DeviceReading } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { toast } from '../../utils/messages';
import { tokens } from '@theme/tokens';
import { Aurora, Button, EmptyState, Pill, ProgressRing, Skeleton } from '@ui/index';
import { PurifierSwitchCard } from './PurifierSwitchCard';

export function DeviceHealthScreen() {
  const [health, setHealth] = React.useState<DeviceHealth | null | undefined>(undefined);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tds, setTds] = React.useState<DeviceReading[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  // Bumped on pull-to-refresh so the water switch also re-reads its access info.
  const [switchRefresh, setSwitchRefresh] = React.useState(0);
  const healthRef = React.useRef<DeviceHealth | null | undefined>(undefined);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const [h, t] = await Promise.all([
        DeviceHealthApi.me(),
        DeviceHealthApi.readings('TDS', 24).catch(() => []),
      ]);
      healthRef.current = h;
      setHealth(h);
      setTds(t);
      setLoadError(null);
    } catch (e) {
      const message = apiErrorMessage(e);
      setLoadError(message);
      // With nothing on screen yet the error card says it; otherwise keep the old data and tell.
      if (healthRef.current !== undefined) toast.error('Could not load device health', message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onPullRefresh = React.useCallback(() => {
    setSwitchRefresh((n) => n + 1);
    void load();
  }, [load]);

  useFocusEffect(React.useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={styles.root}>
      <Aurora height={360} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={tokens.color.accent} />}
      >
        <Text style={styles.eyebrow}>Smart dashboard</Text>
        <Text style={styles.heading}>Device health</Text>

        <PurifierSwitchCard refreshSignal={switchRefresh} style={{ marginBottom: 16 }} />

        {health === undefined ? (
          loadError ? (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AlertTriangle size={20} color={tokens.color.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Couldn't load device health</Text>
                  <Text style={styles.cardSub}>{loadError}</Text>
                </View>
              </View>
              <Button
                title="Retry"
                size="sm"
                variant="soft"
                onPress={() => void load()}
                loading={refreshing}
                iconLeft={<RefreshCw size={14} color={tokens.color.accentInk} />}
                style={{ marginTop: 12, alignSelf: 'flex-start' }}
              />
            </View>
          ) : (
            <View>
              <Skeleton height={180} radius={28} />
              <View style={{ height: 16 }} />
              <Skeleton height={120} radius={20} />
            </View>
          )
        ) : health === null ? (
          <EmptyState
            title="No device installed yet"
            description="Your purifier needs to be installed before the smart dashboard goes live."
          />
        ) : (
          <HealthCards health={health} tds={tds} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HealthCards({ health, tds }: { health: DeviceHealth; tds: DeviceReading[] }) {
  const tdsBuckets = tdsCategory(health.tdsPpm ?? null);

  return (
    <>
      {/* Online status row */}
      <View style={styles.statusRow}>
        {health.isOnline ? (
          <>
            <Wifi size={18} color={tokens.color.success} />
            <Text style={[styles.statusText, { color: tokens.color.success }]}>Online</Text>
          </>
        ) : (
          <>
            <WifiOff size={18} color={tokens.color.warning} />
            <Text style={[styles.statusText, { color: tokens.color.warning }]}>Offline</Text>
          </>
        )}
        <Text style={styles.serial}>· {health.serial}</Text>
      </View>

      {/* TDS card */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Beaker size={20} color={tokens.color.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Water quality (TDS)</Text>
            <Text style={styles.cardSub}>
              {health.tdsPpm != null
                ? `${health.tdsPpm} ppm · ${tdsBuckets.label}`
                : 'Awaiting first reading'}
            </Text>
          </View>
          {health.tdsPpm != null ? (
            <Pill tone={tdsBuckets.tone} size="sm">
              {tdsBuckets.label}
            </Pill>
          ) : null}
        </View>
        {tds.length > 0 ? (
          <View style={styles.spark}>
            {tds.slice(0, 24).reverse().map((r, i) => {
              const v = Math.max(0, Math.min(500, r.tdsPpm ?? 0));
              const h = Math.max(4, (v / 500) * 60);
              return (
                <View key={r.id ?? i} style={{ flex: 1, height: 64, justifyContent: 'flex-end' }}>
                  <View
                    style={{
                      height: h,
                      backgroundColor: tokens.color.accentSoft,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                    }}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Filter life */}
      <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
        <ProgressRing
          progress={(health.filterLifePct ?? 0) / 100}
          size={84}
          stroke={8}
          label={String(health.filterLifePct ?? 0)}
          caption="%"
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color={tokens.color.accent} />
            <Text style={styles.cardTitle}>Filter life</Text>
          </View>
          <Text style={styles.cardSub}>
            {health.filterLifePct == null
              ? 'Awaiting first reading'
              : health.filterLifePct <= 15
                ? 'Replacement due — a technician will reach out.'
                : health.filterLifePct <= 30
                  ? 'Replacement coming up in the next month.'
                  : 'Healthy — no action needed.'}
          </Text>
        </View>
      </View>

      {/* Usage */}
      <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
        <Droplets size={20} color={tokens.color.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Total usage</Text>
          <Text style={styles.cardSub}>{health.usageLitresTotal.toLocaleString('en-IN')} litres lifetime</Text>
        </View>
      </View>

      {/* Leak alert */}
      {health.leakDetectedAt ? (
        <View style={[styles.card, { backgroundColor: tokens.color.warningSoft }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={20} color={tokens.color.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: tokens.color.warning }]}>Leak detected</Text>
              <Text style={styles.cardSub}>
                Last leak event: {new Date(health.leakDetectedAt).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

function tdsCategory(ppm: number | null): { label: string; tone: 'success' | 'warning' | 'accent' } {
  if (ppm == null) return { label: '—', tone: 'accent' };
  if (ppm <= 50) return { label: 'Pure', tone: 'success' };
  if (ppm <= 150) return { label: 'Healthy', tone: 'success' };
  if (ppm <= 300) return { label: 'Borderline', tone: 'warning' };
  return { label: 'Hard', tone: 'warning' };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  eyebrow: { ...tokens.text.label, color: tokens.color.textMuted, fontSize: 11 },
  heading: { ...tokens.text.displayLg, color: tokens.color.text, marginTop: 4, marginBottom: 16 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14 },
  serial: { ...tokens.text.bodySm, color: tokens.color.textMuted },
  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    ...tokens.shadow.xs,
  },
  cardTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14, color: tokens.color.text },
  cardSub: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 2 },
  spark: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'flex-end',
    height: 64,
  },
});
