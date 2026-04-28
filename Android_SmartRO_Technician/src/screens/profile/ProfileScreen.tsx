import React from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, Screen } from '../../components/UI';
import { useAuthStore } from '../../store/auth';
import { Tech } from '../../api/endpoints';
import { colors, spacing, type } from '../../theme';
import { apiBaseUrl } from '../../api/client';

export function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [tech, setTech] = React.useState<{ employeeCode: string; zone: string; isActive: boolean } | null>(null);

  React.useEffect(() => {
    Tech.me().then(setTech).catch(() => {});
  }, []);

  function onLogout() {
    Alert.alert('Sign out', 'Sign out of SmartRO Technician?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={[type.h1, { marginBottom: spacing.md }]}>Profile</Text>
        <Card>
          <Text style={type.h3}>{user?.fullName ?? 'Technician'}</Text>
          <Text style={styles.muted}>{user?.email}</Text>
          {tech ? (
            <>
              <Text style={[styles.muted, { marginTop: spacing.sm }]}>Employee code: {tech.employeeCode}</Text>
              <Text style={styles.muted}>Zone: {tech.zone}</Text>
              <Text style={styles.muted}>Status: {tech.isActive ? 'Active' : 'Inactive'}</Text>
            </>
          ) : null}
        </Card>
        <Card>
          <Text style={type.h3}>About</Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>SmartRO Technician — field-service app.</Text>
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
