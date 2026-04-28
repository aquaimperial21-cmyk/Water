import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge } from '../../components/Badge';
import { Bubbles } from '../../components/Bubbles';
import { Ticket, Tickets } from '../../api/endpoints';
import { colors, radius, spacing, type, shadow } from '../../theme';
import { formatDateTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TicketsScreen() {
  const navigation = useNavigation<Nav>();
  const [tickets, setTickets] = React.useState<Ticket[] | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setTickets(await Tickets.mine());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { void load(); }, [load]));

  if (!tickets) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBright }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceBright }}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Tickets</Text>
        <Pressable onPress={() => navigation.navigate('NewTicket', {})} style={styles.fab} hitSlop={8}>
          <MaterialIcons name="add" size={20} color={colors.onPrimary} />
          <Text style={styles.fabText}>New</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats strip */}
        {tickets.length > 0 ? (
          <View style={styles.statsRow}>
            {[
              { label: 'Total', value: tickets.length, icon: 'list-alt' as const },
              { label: 'Open', value: tickets.filter((t) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length, icon: 'pending' as const },
              { label: 'Resolved', value: tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length, icon: 'check-circle' as const },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                <MaterialIcons name={s.icon} size={20} color={colors.primary} />
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg }}>
        {tickets.length === 0 ? (
          <LinearGradient
            colors={[colors.primaryFixed, colors.surfaceContainerLowest]}
            style={styles.empty}
          >
            <Bubbles
              bubbles={[
                { size: 160, top: -40, right: -30, color: colors.primary, opacity: 0.08 },
                { size: 80, bottom: -10, left: 0, color: colors.primary, opacity: 0.06 },
              ]}
            />
            <View style={styles.emptyIcon}>
              <MaterialIcons name="confirmation-number" size={32} color={colors.primary} />
            </View>
            <Text style={[type.titleLg, { color: colors.onSurface, marginTop: spacing.md }]}>All clear!</Text>
            <Text style={[type.bodyMd, { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 6 }]}>
              You haven't raised any service requests yet. Tap "+ New" to create one.
            </Text>
          </LinearGradient>
        ) : (
          tickets.map((t) => {
            const tone = statusTone(t.status);
            const ptone = priorityTone(t.priority);
            const cat = categoryDef(t.category);
            return (
              <Pressable
                key={t.id}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
                onPress={() => {/* future detail nav */}}
              >
                <View style={styles.catBadge}>
                  <MaterialIcons name={cat.icon as any} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.cardHead}>
                    <Text style={[type.titleMd, { color: colors.onSurface, fontSize: 15 }]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                    <Badge tone={tone} label={t.status.replace('_', ' ')} />
                  </View>
                  <Text style={styles.desc} numberOfLines={2}>{t.description}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.priorityPill, { backgroundColor: ptone.bg }]}>
                      <View style={[styles.priorityDot, { backgroundColor: ptone.dot }]} />
                      <Text style={[styles.priorityText, { color: ptone.text }]}>{t.priority}</Text>
                    </View>
                    <Text style={styles.metaTime}>{formatDateTime(t.createdAt)}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        </View>
      </ScrollView>
    </View>
  );
}

function statusTone(s: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  if (s === 'RESOLVED' || s === 'CLOSED') return 'success';
  if (s === 'OPEN' || s === 'REOPENED') return 'warning';
  if (s === 'IN_PROGRESS' || s === 'ASSIGNED') return 'info';
  return 'neutral';
}

function priorityTone(p: string) {
  if (p === 'HIGH') return { bg: colors.errorContainer, dot: colors.error, text: colors.onErrorContainer };
  if (p === 'MEDIUM') return { bg: '#fff0c2', dot: colors.warning, text: '#7a5a00' };
  return { bg: colors.surfaceContainerHigh, dot: colors.outline, text: colors.onSurfaceVariant };
}

function categoryDef(c: string) {
  switch (c) {
    case 'INSTALL': return { label: 'Installation', icon: 'plumbing' };
    case 'REPAIR': return { label: 'Repair', icon: 'build' };
    case 'FILTER': return { label: 'Filter Service', icon: 'filter-alt' };
    case 'PICKUP': return { label: 'Pickup', icon: 'local-shipping' };
    default: return { label: 'Service', icon: 'support-agent' };
  }
}

const styles = StyleSheet.create({
  topBar: {
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(193,198,215,0.4)',
  },
  topTitle: { ...type.headlineMd, color: colors.onSurface, fontSize: 22 },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    ...shadow.sm,
  },
  fabText: { ...type.labelMd, color: colors.onPrimary, fontSize: 12 },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
    ...shadow.sm,
  },
  statValue: { ...type.headlineLg, color: colors.onSurface, fontSize: 24, marginTop: 6 },
  statLabel: { ...type.labelSm, color: colors.onSurfaceVariant, fontSize: 10 },
  empty: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    ...shadow.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
    ...shadow.sm,
  },
  catBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,89,187,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  desc: { ...type.bodyMd, color: colors.onSurfaceVariant, fontSize: 13, marginTop: 4 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  priorityDot: { width: 5, height: 5, borderRadius: 3 },
  priorityText: { ...type.labelSm, fontSize: 9 },
  metaTime: { ...type.caption, color: colors.outline, fontSize: 11, flex: 1, textAlign: 'right' },
});
