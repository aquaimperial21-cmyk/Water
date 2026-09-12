import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BellOff, Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Notifications, Notification as NotifT } from '../../api/endpoints';
import { tokens } from '@theme/tokens';
import { Aurora, EmptyState, Pill } from '@ui/index';

function relTime(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function channelTone(ch: string): 'accent' | 'success' | 'warning' | 'neutral' {
  if (ch === 'WHATSAPP') return 'success';
  if (ch === 'SMS') return 'accent';
  if (ch === 'INAPP') return 'neutral';
  return 'neutral';
}

export function NotificationsScreen() {
  const navigation = useNavigation();
  const [items, setItems] = React.useState<NotifT[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const r = await Notifications.mine();
      setItems(r.items);
      setUnread(r.unreadCount);
    } catch {}
  }, []);

  React.useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function markRead(id: string) {
    try {
      await Notifications.read(id);
      setItems((arr) => arr.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {}
  }

  async function markAll() {
    try {
      await Notifications.readAll();
      setItems((arr) => arr.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch {}
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Aurora height={420} />
      <View style={styles.topRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <ArrowLeft size={18} color={tokens.color.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Inbox</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
        {unread > 0 ? (
          <Pressable onPress={markAll} style={styles.markAll}>
            <Check size={14} color={tokens.color.accent} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={tokens.color.accent}
          />
        }
      >
        {loading ? (
          <Text style={{ color: tokens.color.textMuted, textAlign: 'center', marginTop: 60 }}>
            Loading…
          </Text>
        ) : items.length === 0 ? (
          <View style={{ marginTop: 40 }}>
            <EmptyState
              title="All caught up"
              description="When we send you a recharge reminder or an offer, it'll show up here."
              illustration={<BellOff size={36} color={tokens.color.accent} />}
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {items.map((n) => {
              const isUnread = !n.readAt;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => isUnread && markRead(n.id)}
                  style={[styles.card, isUnread && styles.cardUnread]}
                >
                  <View style={styles.cardHead}>
                    <Pill tone={channelTone(n.channel)} size="sm" dot>
                      {n.channel}
                    </Pill>
                    <Text style={styles.time}>{relTime(n.createdAt)}</Text>
                  </View>
                  <Text style={[styles.cardTitle, isUnread && { color: tokens.color.text }]}>
                    {n.title}
                  </Text>
                  <Text style={styles.cardBody} numberOfLines={4}>{n.body}</Text>
                  {isUnread ? <View style={styles.unreadDot} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
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
  eyebrow: { ...tokens.text.label, color: tokens.color.textMuted, fontSize: 10 },
  title: { ...tokens.text.displayMd, color: tokens.color.text, marginTop: 2 },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: tokens.color.accentSoft,
  },
  markAllText: { fontFamily: 'Manrope_700Bold', color: tokens.color.accent, fontSize: 12 },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 16,
    ...tokens.shadow.xs,
    position: 'relative',
  },
  cardUnread: { borderColor: tokens.color.accent, backgroundColor: tokens.color.accentTint },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 11, color: tokens.color.textMuted, fontFamily: 'Manrope_700Bold' },
  cardTitle: { fontFamily: 'Manrope_800ExtraBold', color: tokens.color.text, marginTop: 8, fontSize: 15 },
  cardBody: { ...tokens.text.bodySm, color: tokens.color.inkSoft, marginTop: 4 },
  unreadDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.accent,
  },
});
