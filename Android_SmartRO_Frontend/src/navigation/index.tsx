import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useAuthStore } from '../store/auth';
import { colors } from '../theme';

import { PhoneScreen } from '../screens/auth/PhoneScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { CatalogScreen } from '../screens/catalog/CatalogScreen';
import { ProductDetailScreen } from '../screens/catalog/ProductDetailScreen';
import { BookingScreen } from '../screens/booking/BookingScreen';
import { MyPlanScreen } from '../screens/plan/MyPlanScreen';
import { TicketsScreen } from '../screens/tickets/TicketsScreen';
import { NewTicketScreen } from '../screens/tickets/NewTicketScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

export type RootStackParamList = {
  Phone: undefined;
  Otp: { phone: string };
  Tabs: undefined;
  Catalog: { cityId: string; cityName: string };
  ProductDetail: { slug: string; cityId: string; cityName: string };
  Booking: { productId: string; planId: string; cityId: string };
  NewTicket: { subscriptionId?: string };
};
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 11, color: focused ? colors.primary : colors.textMuted, fontWeight: focused ? '700' : '500' }}>
      {label}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border, paddingTop: 6, paddingBottom: 8, height: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} /> }} />
      <Tab.Screen name="My Plan" component={MyPlanScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="💧" focused={focused} /> }} />
      <Tab.Screen name="Tickets" component={TicketsScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="🎫" focused={focused} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} /> }} />
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
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '700' } }}>
        {!user ? (
          <>
            <Stack.Screen name="Phone" component={PhoneScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Otp" component={OtpScreen} options={{ title: 'Verify OTP' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Catalog" component={CatalogScreen} options={({ route }) => ({ title: `Purifiers in ${route.params.cityName}` })} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Details' }} />
            <Stack.Screen name="Booking" component={BookingScreen} options={{ title: 'Book Subscription' }} />
            <Stack.Screen name="NewTicket" component={NewTicketScreen} options={{ title: 'Raise a Ticket' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
