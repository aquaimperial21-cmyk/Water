import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Home as HomeIcon, Receipt, LifeBuoy, User as UserIcon } from 'lucide-react-native';
import { useAuthStore } from '../store/auth';
import { tokens } from '../theme/tokens';

import { PhoneScreen } from '../screens/auth/PhoneScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { PasswordScreen } from '../screens/auth/PasswordScreen';
import { SetPasswordScreen } from '../screens/profile/SetPasswordScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ProductDetailScreen } from '../screens/catalog/ProductDetailScreen';
import { BookingScreen } from '../screens/booking/BookingScreen';
import { InstallSlotScreen } from '../screens/booking/InstallSlotScreen';
import { MyPlanScreen } from '../screens/plan/MyPlanScreen';
import { DeviceHealthScreen } from '../screens/plan/DeviceHealthScreen';
import { TicketsScreen } from '../screens/tickets/TicketsScreen';
import { NewTicketScreen } from '../screens/tickets/NewTicketScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { HelpScreen } from '../screens/profile/HelpScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { WaitlistScreen } from '../screens/catalog/WaitlistScreen';
import { registerPushToken } from '../utils/push';

export type RootStackParamList = {
  Phone: undefined;
  Otp: { phone: string };
  Password: { phone?: string } | undefined;
  Tabs: undefined;
  ProductDetail: { slug: string };
  Booking: { productId: string; planId: string; cityId: string };
  InstallSlot: { bookingId: string };
  DeviceHealth: undefined;
  Help: undefined;
  Waitlist: { cityName: string };
  NewTicket: { subscriptionId?: string };
  Notifications: undefined;
  MyPlan: undefined;
  SetPassword: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: tokens.color.bg,
    card: tokens.color.surface,
    text: tokens.color.text,
    border: tokens.color.border,
    primary: tokens.color.accent,
    notification: tokens.color.accent,
  },
};

const TAB_ITEMS = [
  { name: 'Home', label: 'Home', Icon: HomeIcon },
  { name: 'MyPlan', label: 'My Plan', Icon: Receipt },
  { name: 'Tickets', label: 'Service', Icon: LifeBuoy },
  { name: 'Profile', label: 'Profile', Icon: UserIcon },
] as const;

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.bar}>
        {state.routes.map((route, idx) => {
          const item = TAB_ITEMS.find((t) => t.name === route.name);
          if (!item) return null;
          const isFocused = state.index === idx;
          const Icon = item.Icon;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name as never);
              }}
              style={[styles.tab, isFocused && { flex: 1.7 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
            >
              <MotiView
                animate={{
                  paddingHorizontal: isFocused ? 14 : 10,
                }}
                transition={{ type: 'spring', damping: 22, stiffness: 240 }}
                style={styles.pill}
              >
                {isFocused ? (
                  <LinearGradient
                    colors={[tokens.color.gradientAccentFrom, tokens.color.gradientAccentTo]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                ) : null}
                <Icon
                  size={18}
                  color={isFocused ? '#FFFFFF' : tokens.color.textMuted}
                  strokeWidth={isFocused ? 2.6 : 2}
                />
                {isFocused ? (
                  <MotiView
                    from={{ opacity: 0, translateX: -4 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'timing', duration: 220 }}
                  >
                    <Text style={styles.activeLabel}>{item.label}</Text>
                  </MotiView>
                ) : null}
              </MotiView>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="MyPlan" component={MyPlanScreen} />
      <Tab.Screen name="Tickets" component={TicketsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, hydrated, hydrate } = useAuthStore();
  React.useEffect(() => { void hydrate(); }, [hydrate]);

  // Register push token whenever the user has just signed in (or relaunched
  // while signed in). The helper is best-effort and silently no-ops if the
  // platform refuses permission or the OS doesn't have a token.
  React.useEffect(() => {
    if (user) void registerPushToken();
  }, [user]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.color.bg }}>
        <ActivityIndicator color={tokens.color.accent} />
      </View>
    );
  }
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.color.bg },
          animation: 'slide_from_right',
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Phone" component={PhoneScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
            <Stack.Screen name="Password" component={PasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={MainTabs} />
            <Stack.Screen
              name="ProductDetail"
              component={ProductDetailScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="Booking" component={BookingScreen} />
            <Stack.Screen name="InstallSlot" component={InstallSlotScreen} />
            <Stack.Screen name="DeviceHealth" component={DeviceHealthScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
            <Stack.Screen name="Waitlist" component={WaitlistScreen} />
            <Stack.Screen name="NewTicket" component={NewTicketScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: tokens.space['5'],
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 4,
    ...tokens.shadow.lg,
  },
  glow: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: -8,
    height: 56,
    borderRadius: 32,
    backgroundColor: tokens.color.accent,
    opacity: 0.18,
  },
  tab: { flex: 1, justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  activeLabel: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12.5,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
});
