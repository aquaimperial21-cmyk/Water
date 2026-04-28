import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../store/auth';
import { colors, spacing, type as t } from '../theme';

import { PhoneScreen } from '../screens/auth/PhoneScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
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
  ProductDetail: { slug: string };
  Booking: { productId: string; planId: string; cityId: string };
  NewTicket: { subscriptionId?: string };
};
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function TabPill({ icon, label, focused }: { icon: IconName; label: string; focused: boolean }) {
  return (
    <View style={[tabStyles.pill, focused && tabStyles.pillActive]}>
      <MaterialIcons
        name={icon}
        size={focused ? 22 : 20}
        color={focused ? colors.primary : colors.outline}
      />
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.outline,
        tabBarShowLabel: false,
        tabBarStyle: tabStyles.bar,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabPill icon="home" label="Home" focused={focused} /> }}
      />
      <Tab.Screen
        name="MyPlan"
        component={MyPlanScreen}
        options={{ tabBarIcon: ({ focused }) => <TabPill icon="layers" label="My Plan" focused={focused} /> }}
      />
      <Tab.Screen
        name="Tickets"
        component={TicketsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabPill icon="confirmation-number" label="Tickets" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabPill icon="person" label="Profile" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, hydrated, hydrate } = useAuthStore();
  React.useEffect(() => { void hydrate(); }, [hydrate]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceBright }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surfaceBright },
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Phone" component={PhoneScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={MainTabs} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="Booking" component={BookingScreen} />
            <Stack.Screen name="NewTicket" component={NewTicketScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 16,
    marginHorizontal: spacing.md,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(193,198,215,0.5)',
    shadowColor: '#003366',
    shadowOpacity: 0.10,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    paddingHorizontal: spacing.sm,
    paddingTop: 6,
    paddingBottom: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 50,
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: 'rgba(0,89,187,0.10)' },
  label: { ...t.labelSm, fontSize: 10, color: colors.outline },
  labelActive: { color: colors.primary },
});
