import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Catalog, City, Subscriptions, Subscription } from '../../api/endpoints';
import { colors, spacing, type } from '../../theme';
import { useAuthStore } from '../../store/auth';
import { Badge } from '../../components/Badge';
import type { RootStackParamList } from '../../navigation';
import { daysFromNow, formatDate, paiseToInr } from '../../utils/format';
import { Button } from '../../components/Button';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const [cities, setCities] = React.useState<City[]>([]);
  const [subs, setSubs] = React.useState<Subscription[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [cs, ss] = await Promise.all([Catalog.cities(), Subscriptions.mine().catch(() => [])]);
      setCities(cs);
      setSubs(ss);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const activeSub = subs.find((s) => s.status === 'ACTIVE');

  return (
    <Screen padded={false}>
      <View style={styles.hero}>
        <Text style={styles.greeting}>Hi, {user?.fullName?.split(' ')[0] ?? 'there'} 👋</Text>
        <Text style={styles.welcome}>Find your perfect water purifier</Text>
      </View>
      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {activeSub ? (
            <Card style={styles.subCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={type.h3}>Your active plan</Text>
                <Badge tone="success" label="ACTIVE" />
              </View>
              <Text style={[type.body, { marginTop: 4 }]}>{activeSub.product?.name}</Text>
              <Text style={styles.muted}>
                Renews on {formatDate(activeSub.expiresAt)} ({daysFromNow(activeSub.expiresAt)} days left)
              </Text>
            </Card>
          ) : null}

          <Text style={[type.h3, { marginTop: spacing.sm, marginBottom: spacing.md }]}>Choose your city</Text>
          {cities.map((c) => (
            <Card key={c.id} onPress={() => navigation.navigate('Catalog', { cityId: c.id, cityName: c.name })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={type.h3}>{c.name}</Text>
                  <Text style={styles.muted}>{c.state}</Text>
                </View>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Browse →</Text>
              </View>
            </Card>
          ))}

          <View style={{ height: spacing.lg }} />
          <Card>
            <Text style={type.h3}>How it works</Text>
            <Text style={[styles.muted, { marginTop: 6 }]}>1. Pick a purifier and plan</Text>
            <Text style={styles.muted}>2. Quick KYC + e-sign</Text>
            <Text style={styles.muted}>3. Pay deposit + first month</Text>
            <Text style={styles.muted}>4. Free install in 48 hours</Text>
            <Text style={[styles.muted, { marginBottom: spacing.md }]}>5. Maintenance + filters covered for free</Text>
            <Button title="Refresh" variant="ghost" size="md" onPress={refresh} />
          </Card>
          <Text style={styles.testHint}>From {paiseToInr(44900)} / month — free install, no upfront cost.</Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, padding: spacing.xl, paddingTop: spacing.xl + 8 },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  welcome: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  content: { padding: spacing.lg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  subCard: { borderColor: colors.primary, borderWidth: 1.5 },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  testHint: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.md },
});
