import React from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { confirmAction, notify } from '../../utils/confirm';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  CreditCard,
  FileText,
  Gift,
  HelpCircle,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Server,
  ShieldCheck,
  User,
  ChevronRight,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import { Auth, Referrals, ReferralInfo } from '../../api/endpoints';
import { apiBaseUrl, apiErrorMessage } from '../../api/client';
import { tokens } from '@theme/tokens';
import { Aurora, ListGroup, ListRow, Pill } from '@ui/index';
import type { RootStackParamList } from '../../navigation';

export function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = React.useState<{
    addresses?: { line1: string; city?: { name: string }; pincode: string }[];
  } | null>(null);
  const [referral, setReferral] = React.useState<ReferralInfo | null>(null);

  React.useEffect(() => {
    Auth.me().then(setProfile).catch(() => {});
    Referrals.me().then(setReferral).catch(() => {});
  }, []);

  async function shareReferral() {
    if (!referral?.referralCode) return;
    const reward = Math.round(referral.rewardPaisePerReferral / 100);
    const msg = `Switch to SmartRO purifier rental and we both get ₹${reward} off. Use my code: ${referral.referralCode}\nDownload: https://smartro.in/app`;
    try {
      await Share.share({ message: msg });
    } catch (e) {
      notify('Could not share', apiErrorMessage(e));
    }
  }

  const initials = (user?.fullName ?? user?.phone ?? 'U')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const primaryAddress = profile?.addresses?.[0];
  const addressLine = primaryAddress
    ? `${primaryAddress.line1}, ${primaryAddress.city?.name ?? ''} ${primaryAddress.pincode}`
    : 'Add a delivery address';

  async function confirmSignOut() {
    const ok = await confirmAction({
      title: 'Sign out?',
      message: 'You can sign back in any time with your phone.',
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (ok) await signOut();
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Aurora height={420} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Account</Text>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Identity card */}
        <View style={styles.identity}>
          <View style={styles.identityRow}>
            <View>
              <View style={styles.avatar}>
                <LinearGradient
                  colors={[tokens.color.gradientDeepFrom, tokens.color.gradientDeepTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.verifyDot}>
                <ShieldCheck size={11} color="#FFFFFF" strokeWidth={3} />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>
                {user?.fullName ?? 'ImperialAqua customer'}
              </Text>
              <Text style={styles.muted}>+91 {user?.phone?.replace('+91', '')}</Text>
              {user?.email ? <Text style={styles.muted} numberOfLines={1}>{user.email}</Text> : null}
            </View>
          </View>
          <View style={styles.chipsRow}>
            <Pill tone="success" dot>KYC verified</Pill>
            <Pill tone="accent">Premium · 8 mo</Pill>
          </View>
        </View>

        {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.groupLabel}>Saved addresses</Text>
          <ListGroup>
            <ListRow
              leading={<MapPin size={16} color={tokens.color.accentInk} />}
              title="Home"
              subtitle={addressLine}
              trailing={<Pill tone="accent" size="sm">Default</Pill>}
              onPress={() => {}}
            />
            <ListRow
              leading={<MapPin size={16} color={tokens.color.accentInk} />}
              title="Add another address"
              onPress={() => {}}
            />
          </ListGroup>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.groupLabel}>Account</Text>
          <ListGroup>
            <ListRow leading={<User size={16} color={tokens.color.accentInk} />} title="Personal details" subtitle="Name, email, DOB" onPress={() => {}} />
            <ListRow leading={<Bell size={16} color={tokens.color.accentInk} />} title="Notifications" subtitle="Service, billing, offers" onPress={() => {}} />
            <ListRow leading={<CreditCard size={16} color={tokens.color.accentInk} />} title="Payment methods" subtitle="UPI · Visa •• 4421" onPress={() => {}} />
            <ListRow leading={<Lock size={16} color={tokens.color.accentInk} />} title="Security" subtitle="PIN, 2-step verification" onPress={() => {}} />
          </ListGroup>
        </View>

        {/* Referrals */}
        <View style={styles.section}>
          <Text style={styles.groupLabel}>Refer & earn</Text>
          <ListGroup>
            <ListRow
              leading={<Gift size={16} color={tokens.color.accentInk} />}
              title={referral?.referralCode ?? '—'}
              subtitle={
                referral
                  ? `${referral.referrals} signups · ₹${Math.round(referral.rewardPaiseAvailable / 100)} earned`
                  : 'Loading…'
              }
              trailing={<Pill tone="accent" size="sm">Share</Pill>}
              onPress={shareReferral}
            />
          </ListGroup>
        </View>

        {/* Help */}
        <View style={styles.section}>
          <Text style={styles.groupLabel}>Help & support</Text>
          <ListGroup>
            <ListRow
              leading={<MessageCircle size={16} color={tokens.color.accentInk} />}
              title="Chat with us"
              subtitle="Avg reply in 3 minutes"
              onPress={() => nav.navigate('Help')}
            />
            <ListRow
              leading={<HelpCircle size={16} color={tokens.color.accentInk} />}
              title="Help center"
              onPress={() => nav.navigate('Help')}
            />
            <ListRow leading={<FileText size={16} color={tokens.color.accentInk} />} title="Legal" subtitle="Terms, Privacy, Refunds" onPress={() => {}} />
          </ListGroup>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.groupLabel}>About</Text>
          <ListGroup>
            <ListRow
              leading={<Server size={16} color={tokens.color.accentInk} />}
              title="API server"
              trailing={<Text style={styles.aboutMeta} numberOfLines={1}>{prettyHost(apiBaseUrl)}</Text>}
              showChevron={false}
            />
            <ListRow
              leading={<ChevronRight size={16} color={tokens.color.accentInk} />}
              title="App version"
              trailing={<Text style={styles.aboutMeta}>2.4.1 (build 482)</Text>}
              showChevron={false}
            />
          </ListGroup>
        </View>

        {/* Sign out */}
        <Pressable
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.95 }]}
        >
          <LogOut size={16} color={tokens.color.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.tagline}>ImperialAqua — clean water, on tap.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function prettyHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },

  header: { paddingTop: 12 },
  eyebrow: { ...tokens.text.label, color: tokens.color.textSubtle },
  title: { ...tokens.text.displayMd, color: tokens.color.text, marginTop: 2 },

  identity: {
    marginTop: 20,
    backgroundColor: tokens.color.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 18,
    ...tokens.shadow.sm,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadow.glow,
  },
  avatarText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 22 },
  verifyDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.color.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.color.surface,
  },
  name: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18, color: tokens.color.text },
  muted: { ...tokens.text.bodySm, color: tokens.color.textMuted, marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },

  section: { marginTop: 24 },
  groupLabel: { ...tokens.text.label, color: tokens.color.textSubtle, marginBottom: 8, paddingLeft: 4 },

  aboutMeta: { fontSize: 12, color: tokens.color.textMuted, fontFamily: 'Manrope_700Bold' },

  signOut: {
    marginTop: 32,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
    backgroundColor: tokens.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOutText: { fontFamily: 'Manrope_800ExtraBold', color: tokens.color.danger, fontSize: 14 },

  tagline: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 12,
    color: tokens.color.textMuted,
  },
});
