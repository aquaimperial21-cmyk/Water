import React from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { confirmAction, showDialog, toast } from '../../utils/messages';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
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
  RefreshCw,
  Smartphone,
  MapPin,
  MessageCircle,
  Server,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import { openLegal } from '../../utils/legal';
import { Auth, Kyc, Referrals, ReferralInfo } from '../../api/endpoints';
import { apiBaseUrl, apiErrorMessage } from '../../api/client';
import { formatDate } from '../../utils/format';
import { tokens } from '@theme/tokens';
import { Aurora, ListGroup, ListRow, Pill } from '@ui/index';
import type { RootStackParamList } from '../../navigation';

export function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = React.useState<{
    addresses?: { line1: string; city?: { name: string }; pincode: string }[];
    hasPassword?: boolean;
  } | null>(null);
  const [referral, setReferral] = React.useState<ReferralInfo | null>(null);
  // Real KYC state — the badge used to be hardcoded, so every account looked
  // verified whether or not it had ever submitted anything.
  const [kycStatus, setKycStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    Auth.me().then(setProfile).catch(() => {});
    Referrals.me().then(setReferral).catch(() => {});
    Kyc.mine()
      .then((rec) => setKycStatus((rec as { status?: string } | null)?.status ?? null))
      .catch(() => {});
  }, []);

  const kycVerified = kycStatus === 'VERIFIED';
  const kycPill: { tone: 'success' | 'accent' | 'danger'; label: string } | null =
    kycVerified
      ? { tone: 'success', label: 'KYC verified' }
      : kycStatus === 'PENDING' || kycStatus === 'IN_REVIEW'
        ? { tone: 'accent', label: 'KYC in review' }
        : kycStatus === 'REJECTED'
          ? { tone: 'danger', label: 'KYC rejected' }
          : null;

  async function shareReferral() {
    if (!referral?.referralCode) return;
    const reward = Math.round(referral.rewardPaisePerReferral / 100);
    const msg = `Switch to SmartRO purifier rental and we both get ₹${reward} off. Use my code: ${referral.referralCode}\nDownload: https://smartro.in/app`;
    try {
      await Share.share({ message: msg });
    } catch (e) {
      toast.error('Could not share', apiErrorMessage(e));
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

  // A ref, not just state: a second tap lands before the re-render that
  // would show the first one is already in flight.
  const deletingRef = React.useRef(false);
  const [deleting, setDeleting] = React.useState(false);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);

  // New screens and fixes arrive as over-the-air updates (EAS Update): the app
  // downloads them on launch by itself and uses them from the next start.
  // This button fetches one now and restarts into it.
  async function checkForUpdate() {
    if (checkingUpdate) return;
    if (!Updates.isEnabled) {
      toast.info('Updates are not available in this build');
      return;
    }
    setCheckingUpdate(true);
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        toast.success('You have the latest version');
        return;
      }
      await Updates.fetchUpdateAsync();
      const restart = await confirmAction({
        title: 'Update ready',
        message: 'Restart the app now to use the new version?',
        confirmLabel: 'Restart',
        cancelLabel: 'Later',
      });
      if (restart) await Updates.reloadAsync();
      else toast.info('The update will be used next time you open the app');
    } catch {
      toast.error('Could not check for updates', 'Check your internet connection and try again.');
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function confirmDeleteAccount() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    try {
      const ok = await confirmAction({
        title: 'Delete your account?',
        message:
          'This erases your name, phone number, email, saved addresses, KYC details and notifications, and signs you out on every device. It cannot be undone.\n\n' +
          'Payment records and invoices are kept, as Indian tax law requires.\n\n' +
          'If your purifier plan is still running, cancel it first from My Plan — we collect the purifier and refund your deposit.',
        confirmLabel: 'Delete account',
        destructive: true,
      });
      if (!ok) return;
      setDeleting(true);
      await Auth.deleteAccount();
      await signOut();
      toast.success('Account deleted', 'Your personal details have been erased.');
    } catch (e) {
      if ((e as { response?: { status?: number } })?.response?.status === 409) {
        // Running plan or a refund still on its way: the server says which.
        await showDialog({ title: "Your account can't be deleted yet", message: apiErrorMessage(e) });
      } else {
        toast.error('Could not delete your account', apiErrorMessage(e));
      }
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
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
              {kycVerified ? (
                <View style={styles.verifyDot}>
                  <ShieldCheck size={11} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>
                {user?.fullName ?? 'ImperialAqua customer'}
              </Text>
              <Text style={styles.muted}>+91 {user?.phone?.replace('+91', '')}</Text>
              {user?.email ? <Text style={styles.muted} numberOfLines={1}>{user.email}</Text> : null}
            </View>
          </View>
          {/* Only badges backed by real data — a hardcoded "KYC verified" and a
              made-up tenure told every new account a flattering lie. */}
          {kycPill ? (
            <View style={styles.chipsRow}>
              <Pill tone={kycPill.tone} dot>{kycPill.label}</Pill>
            </View>
          ) : null}
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
            <ListRow leading={<CreditCard size={16} color={tokens.color.accentInk} />} title="Payment methods" subtitle="UPI and cards" onPress={() => {}} />
            <ListRow
              leading={<Lock size={16} color={tokens.color.accentInk} />}
              title={profile?.hasPassword ? 'Change password' : 'Set a password'}
              subtitle={profile?.hasPassword ? 'Sign in without an OTP' : 'Skip the OTP next time you sign in'}
              onPress={() => nav.navigate('SetPassword')}
            />
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
            {/* These rows did nothing before; the pages now exist on the website. */}
            <ListRow leading={<FileText size={16} color={tokens.color.accentInk} />} title="Terms & Conditions" onPress={() => void openLegal('terms')} />
            <ListRow leading={<FileText size={16} color={tokens.color.accentInk} />} title="Privacy Policy" onPress={() => void openLegal('privacy')} />
            <ListRow leading={<FileText size={16} color={tokens.color.accentInk} />} title="Cancellation & Refunds" onPress={() => void openLegal('refund')} />
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
              leading={<Smartphone size={16} color={tokens.color.accentInk} />}
              title="App version"
              subtitle={installedCodeLabel()}
              trailing={<Text style={styles.aboutMeta}>{Constants.expoConfig?.version ?? '—'}</Text>}
              showChevron={false}
            />
            <ListRow
              leading={<RefreshCw size={16} color={tokens.color.accentInk} />}
              title={checkingUpdate ? 'Checking for updates…' : 'Check for updates'}
              onPress={checkForUpdate}
            />
          </ListGroup>
        </View>

        {/* Delete account — Google Play requires it in the app */}
        <View style={styles.section}>
          <ListGroup>
            <ListRow
              leading={<Trash2 size={16} color={tokens.color.danger} />}
              title="Delete account"
              subtitle={deleting ? 'Deleting…' : 'Erase your profile and personal data'}
              destructive
              onPress={confirmDeleteAccount}
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

/** Which code is running: what came with the APK, or a downloaded update. */
function installedCodeLabel(): string {
  if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.createdAt) return 'As installed';
  return `Updated ${formatDate(Updates.createdAt)}`;
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
