import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/auth';
import { colors, spacing, type } from '../../theme';
import { Auth } from '../../api/endpoints';
import { apiBaseUrl } from '../../api/client';

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

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={[type.h1, { marginBottom: spacing.md }]}>Profile</Text>
        <Card>
          <Text style={type.h3}>{user?.fullName ?? 'Customer'}</Text>
          <Text style={styles.muted}>{user?.phone}</Text>
          {user?.email ? <Text style={styles.muted}>{user.email}</Text> : null}
        </Card>

        <Card>
          <Text style={type.h3}>Addresses</Text>
          {(profile?.addresses ?? []).length === 0 ? (
            <Text style={[styles.muted, { marginTop: 4 }]}>None on file. Adding addresses comes during booking.</Text>
          ) : (
            (profile?.addresses ?? []).map((a, i) => (
              <View key={i} style={{ marginTop: spacing.sm }}>
                <Text style={{ color: colors.text }}>{a.line1}</Text>
                <Text style={styles.muted}>{a.city?.name} — {a.pincode}</Text>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={type.h3}>About</Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>SmartRO — water purifier rental subscription.</Text>
          <Text style={styles.muted}>API: {apiBaseUrl}</Text>
          <Text style={styles.muted}>Version: 0.1.0 (prototype)</Text>
        </Card>

        <Button title="Sign out" variant="danger" onPress={onLogout} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
});
