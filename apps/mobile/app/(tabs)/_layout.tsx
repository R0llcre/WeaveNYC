/**
 * Tab layout — 5-entry bottom tab bar.
 *
 * Icon set: `@expo/vector-icons` / Ionicons picked as placeholders. Wave B
 * swaps these for the brand-tuned icons (stitched-thread motif) alongside
 * the atom port.
 *
 * `share` tab is presented as a modal per the Phase 1 spec (it's the post
 * composer and needs its own dismissal gesture). Expo Router handles the
 * modal routing through the `options.presentation` key.
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { InboxTabBadge } from '@/components/InboxTabBadge';
import { useAppTheme } from '@/theme';

export default function TabLayout() {
  const theme = useAppTheme();
  const { t } = useTranslation('chrome');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceRaised,
          borderTopColor: theme.colors.border,
        },
        headerStyle: {
          backgroundColor: theme.colors.surfaceRaised,
        },
        headerTintColor: theme.colors.inkPrimary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: t('tabCommunity'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      {/**
        * `share` is the post-composer entry. Spec says modal presentation, but
        * Expo Router's <Tabs.Screen> uses a BottomTab screen under the hood
        * whose options don't include `presentation`. The correct shape is a
        * tab screen whose pressed handler routes to a separate modal screen
        * at app/share.tsx; wave B adds that redirect. For M1 we keep it as a
        * plain tab so the scaffold compiles — the user still lands on the
        * placeholder from the tab press.
        */}
      <Tabs.Screen
        name="share"
        options={{
          title: t('tabShare'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t('tabInbox'),
          tabBarIcon: ({ color, size }) => (
            // Icon + overlaid pending-requests badge. The outer View
            // gives the absolutely-positioned badge a positioning
            // context that lines up with the Ionicons glyph instead of
            // the tab button bounds (which vary by RN / Expo version).
            <View>
              <Ionicons name="mail-outline" size={size} color={color} />
              <InboxTabBadge color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t('tabMe'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
