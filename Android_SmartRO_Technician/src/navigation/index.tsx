import React from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { JobsScreen } from '../screens/jobs/JobsScreen';
import { JobDetailScreen } from '../screens/jobs/JobDetailScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { useAuthStore } from '../store/auth';
import { colors } from '../theme';

export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
  JobDetail: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border, paddingTop: 6, paddingBottom: 8, height: 60 },
      }}
    >
      <Tab.Screen name="Jobs" component={JobsScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>🔧</Text> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>👤</Text> }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, hydrated, hydrate } = useAuthStore();
  React.useEffect(() => { void hydrate(); }, [hydrate]);
  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>Loading…</Text>
      </View>
    );
  }
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, headerTintColor: colors.text }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job Detail' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
