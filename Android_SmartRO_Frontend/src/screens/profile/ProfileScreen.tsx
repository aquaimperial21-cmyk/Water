import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth';
import { Auth } from '../../api/endpoints';
import { apiBaseUrl } from '../../api/client';
import { Bubbles } from '../../components/Bubbles';
import { colors, radius, spacing, type, shadow } from '../../theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const [profile, setProfile] = React.useState<{ addresses?: { line1: string; city?: { name: string }; pincode: string }[] } | null>(null);

  React.useEffect(() => {
    Auth.me().then(setProfile).catch(() => {});
  }, []);

  function onLogout() {
    Alert.alert('Sign out', 'Sign out of SmartRO?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  const initials = (user?.fullName ?? user?.phone ?? 'U')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceBright }}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <View style={styles.identityWrap}>
          <LinearGradient
            colors={[colors.primaryFixed, colors.surfaceContainerLowest]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.identity}
          >
            <Bubbles
              bubbles={[
                { size: 180, top: -60, right: -40, color: colors.primary, opacity: 0.06 },
                { size: 90, bottom: -30, left: -10, color: colors.primary, opacity: 0.05 },
              ]}
            />
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.avatarStatus}>
                <MaterialIcons name="verified" size={14} color={colors.onPrimary} />
              </View>
            </View>
            <Text style={[type.headlineMd, { color: colors.onSurface, marginTop: spacing.md }]}>
              {user?.fullName ?? 'Customer'}
            </Text>
            <Text style={[type.bodyMd, { color: colors.onSurfaceVariant, marginTop: 2 }]}>
              {user?.phone}
            </Text>
            {user?.email ? (
              <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>{user.email}</Text>
            ) : null}
            <View style={styles.identityChips}>
              <View style={styles.identityChip}>
                <MaterialIcons name="verified-user" size={12} color={colors.primary} />
                <Text style={styles.identityChipText}>KYC verified</Text>
              </View>
              <View style={styles.identityChip}>
                <MaterialIcons name="star" size={12} color={colors.star} />
                <Text style={styles.identityChipText}>Premium member</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Section: Addresses */}
        <Section title="Saved addresses">
          {(profile?.addresses ?? []).length === 0 ? (
            <View style={styles.row}>
              <View style={styles.rowIcon}><MaterialIcons name="location-on" size={20} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyMdSemi, { color: colors.onSurface }]}>No addresses yet</Text>
                <Text style={[type.caption, { color: colors.onSurfaceVariant }]}>Added during booking flow</Text>
              </View>
            </View>
          ) : (
            (profile?.addresses ?? []).map((a, i) => (
              <View key={i} style={styles.row}>
                <View style={styles.rowIcon}><MaterialIcons name="location-on" size={20} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyMdSemi, { color: colors.onSurface }]}>{a.line1}</Text>
                  <Text style={[type.caption, { color: colors.onSurfaceVariant }]}>{a.city?.name} — {a.pincode}</Text>
                </View>
              </View>
            ))
          )}
        </Section>

        {/* Section: Account */}
        <Section title="Account">
          <Row icon="person-outline" label="Edit profile" />
          <Row icon="notifications-none" label="Notifications" />
          <Row icon="lock-outline" label="Security & Privacy" />
          <Row icon="payment" label="Payment methods" />
        </Section>

        {/* Section: Support */}
        <Section title="Support">
          <Row icon="help-outline" label="Help center" />
          <Row icon="chat-bubble-outline" label="Contact support" />
          <Row icon="star-outline" label="Rate the app" />
        </Section>

        {/* Section: About */}
        <Section title="About">
          <View style={styles.row}>
            <View style={styles.rowIcon}><MaterialIcons name="info-outline" size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyMdSemi, { color: colors.onSurface }]}>SmartRO</Text>
              <Text style={[type.caption, { color: colors.onSurfaceVariant }]}>Water purifier rental subscription</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.rowIcon}><MaterialIcons name="cloud-queue" size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyMdSemi, { color: colors.onSurface }]}>API server</Text>
              <Text style={[type.caption, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{apiBaseUrl}</Text>
            </View>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowIcon}><MaterialIcons name="numbers" size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyMdSemi, { color: colors.onSurface }]}>Version</Text>
              <Text style={[type.caption, { color: colors.onSurfaceVariant }]}>0.2.0 (prototype)</Text>
            </View>
          </View>
        </Section>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Pressable onPress={onLogout} style={styles.signOutBtn}>
            <MaterialIcons name="logout" size={18} color={colors.error} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceContainerLow }]}>
      <View style={styles.rowIcon}>
        <MaterialIcons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[type.bodyMdSemi, { color: colors.onSurface, flex: 1 }]}>{label}</Text>
      <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
    </Pressable>
  );
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

  identityWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  identity: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
    overflow: 'hidden',
    ...shadow.sm,
  },
  avatarRing: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
    ...shadow.sm,
  },
  avatarText: { ...type.headlineLg, color: colors.primary, fontSize: 28 },
  avatarStatus: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ffffff',
  },
  identityChips: { flexDirection: 'row', gap: 8, marginTop: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  identityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  identityChipText: { ...type.labelSm, color: colors.onSurface, fontSize: 10 },

  sectionTitle: { ...type.labelMd, color: colors.onSurfaceVariant, marginBottom: spacing.sm, fontSize: 12 },
  sectionBody: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.4)',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,89,187,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.errorContainer,
    borderRadius: radius.lg,
  },
  signOutText: { ...type.labelMd, color: colors.error, fontSize: 14 },
});
