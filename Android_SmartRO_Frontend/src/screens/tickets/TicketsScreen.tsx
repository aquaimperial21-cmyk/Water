import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  ChevronRight,
  Droplets,
  Filter as FilterIcon,
  MoreHorizontal,
  Plus,
  Volume2,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ticket, Tickets } from '../../api/endpoints';
import { tokens } from '@theme/tokens';
import { Aurora, EmptyState, Pill, Skeleton } from '@ui/index';
import type { PillTone } from '@ui/index';
import type { RootStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FilterKey = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'CLOSED', label: 'Closed' },
];

const STATUS_TONE: Record<string, PillTone> = {
  OPEN: 'warning',
  REOPENED: 'warning',
  IN_PROGRESS: 'accent',
  ASSIGNED: 'accent',
  RESOLVED: 'success',
  CLOSED: 'success',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  REOPENED: 'Reopened',
  IN_PROGRESS: 'In progress',
  ASSIGNED: 'Assigned',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const PRIORITY_TONE: Record<string, PillTone> = {
  LOW: 'neutral',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

const CATEGORY_ICON: Record<string, any> = {
  REPAIR: Droplets,
  FILTER: FilterIcon,
  NOISE: Volume2,
  OTHER: MoreHorizontal,
};

function relTime(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function TicketsScreen() {
  const navigation = useNavigation<Nav>();
  const [tickets, setTickets] = React.useState<Ticket[] | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterKey>('ALL');

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setTickets(await Tickets.mine());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { void load(); }, [load]));

  const visible = React.useMemo(() => {
    if (!tickets) return [];
    if (filter === 'ALL') return tickets;
    if (filter === 'OPEN') return tickets.filter((t) => ['OPEN', 'REOPENED'].includes(t.status));
    if (filter === 'IN_PROGRESS') return tickets.filter((t) => ['IN_PROGRESS', 'ASSIGNED'].includes(t.status));
    return tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status));
  }, [tickets, filter]);

  const stats = React.useMemo(() => {
    const list = tickets ?? [];
    return {
      open: list.filter((t) => ['OPEN', 'REOPENED'].includes(t.status)).length,
      progress: list.filter((t) => ['IN_PROGRESS', 'ASSIGNED'].includes(t.status)).length,
      closed: list.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length,
    };
  }, [tickets]);

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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Service</Text>
            <Text style={styles.title}>Tickets</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('NewTicket', {})}
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.95 }]}
          >
            <LinearGradient
              colors={[tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Plus size={14} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={styles.newBtnText}>New ticket</Text>
          </Pressable>
        </View>

        {/* Stats strip */}
        <View style={styles.statsRow}>
          <StatCell label="Open" count={stats.open} tone="warning" />
          <StatCell label="In progress" count={stats.progress} tone="accent" />
          <StatCell label="Resolved" count={stats.closed} tone="success" />
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ marginTop: 16, gap: 8, paddingRight: 8 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* List */}
        <View style={{ marginTop: 18, gap: 12 }}>
          {!tickets ? (
            <>
              <Skeleton height={120} radius={20} />
              <Skeleton height={120} radius={20} />
            </>
          ) : visible.length === 0 ? (
            <View style={{ marginTop: 12 }}>
              <EmptyState
                variant="check"
                title="All clear"
                description="No tickets in this view. Your purifier is humming along."
              />
              <View style={{ gap: 12, marginTop: 16 }}>
                <SuggestionCard
                  title="Schedule a routine check-up"
                  sub="Free quarterly visit, fits your timing"
                />
                <SuggestionCard title="Browse FAQs" sub="Quick answers to common questions" />
              </View>
            </View>
          ) : (
            visible.map((t, i) => (
              <MotiView
                key={t.id}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 320, delay: i * 60 }}
              >
                <TicketCard ticket={t} />
              </MotiView>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'warning' | 'accent' | 'success';
}) {
  const dotColor =
    tone === 'warning'
      ? tokens.color.warn
      : tone === 'accent'
      ? tokens.color.accent
      : tokens.color.success;
  return (
    <View style={styles.statCell}>
      <View style={styles.statHead}>
        <View style={[styles.statDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statCount}>{count}</Text>
    </View>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const Icon = CATEGORY_ICON[ticket.category] ?? MoreHorizontal;
  const statusTone = STATUS_TONE[ticket.status] ?? 'neutral';
  const priorityTone = PRIORITY_TONE[ticket.priority] ?? 'neutral';
  const isHigh = ticket.priority === 'HIGH';

  return (
    <View style={styles.ticketCard}>
      <View style={styles.ticketRow}>
        <View
          style={[
            styles.ticketIconBox,
            isHigh
              ? { backgroundColor: tokens.color.dangerSoft }
              : { backgroundColor: tokens.color.accentSoft },
          ]}
        >
          {isHigh ? (
            <AlertTriangle size={18} color={tokens.color.danger} />
          ) : (
            <Icon size={18} color={tokens.color.accentInk} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.ticketTopRow}>
            <Text style={styles.ticketId}>{ticket.id.slice(-7).toUpperCase()}</Text>
            <Pill tone={statusTone} size="sm" dot>
              {STATUS_LABEL[ticket.status] ?? ticket.status}
            </Pill>
          </View>
          <Text style={styles.ticketTitle} numberOfLines={1}>
            {ticket.category} · {ticket.description.slice(0, 60)}
          </Text>
          <Text style={styles.ticketDesc} numberOfLines={2}>
            {ticket.description}
          </Text>
          <View style={styles.ticketBottomRow}>
            <Pill tone={priorityTone} size="sm">{ticket.priority}</Pill>
            <Text style={styles.ticketTime}>{relTime(ticket.createdAt)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function SuggestionCard({ title, sub }: { title: string; sub: string }) {
  return (
    <Pressable style={styles.suggestion}>
      <View style={{ flex: 1 }}>
        <Text style={styles.suggestionTitle}>{title}</Text>
        <Text style={styles.suggestionSub}>{sub}</Text>
      </View>
      <ChevronRight size={16} color={tokens.color.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  eyebrow: { ...tokens.text.label, color: tokens.color.textSubtle },
  title: { ...tokens.text.displayMd, color: tokens.color.text, marginTop: 2 },
  newBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...tokens.shadow.glow,
  },
  newBtnText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 13 },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  statCell: {
    flex: 1,
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    ...tokens.shadow.xs,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: tokens.color.textMuted,
  },
  statCount: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 26,
    color: tokens.color.text,
    marginTop: 4,
  },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tokens.color.surfaceWarm,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  filterChipActive: {
    backgroundColor: tokens.color.text,
    borderColor: tokens.color.text,
  },
  filterChipText: { fontFamily: 'Manrope_700Bold', fontSize: 12, color: tokens.color.inkSoft },
  filterChipTextActive: { color: tokens.color.bg },

  ticketCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    ...tokens.shadow.xs,
  },
  ticketRow: { flexDirection: 'row', gap: 12 },
  ticketIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketId: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: tokens.color.textMuted },
  ticketTitle: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: tokens.color.text, marginTop: 4 },
  ticketDesc: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 4 },
  ticketBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  ticketTime: { fontSize: 11, color: tokens.color.textMuted, fontFamily: 'Manrope_700Bold' },

  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    ...tokens.shadow.xs,
  },
  suggestionTitle: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: tokens.color.text },
  suggestionSub: { fontSize: 11, color: tokens.color.textMuted, marginTop: 2 },
});
