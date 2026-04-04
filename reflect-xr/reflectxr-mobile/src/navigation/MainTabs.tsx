import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, typography, spacing } from '../theme';
import {
  MainTabParamList,
  CreateStackParamList,
  JournalStackParamList,
  ChatStackParamList,
} from './types';

import HomeScreen from '../screens/home/HomeScreen';
import ConceptsScreen from '../screens/create/ConceptsScreen';
import PromptDesignScreen from '../screens/create/PromptDesignScreen';
import PromptEditScreen from '../screens/create/PromptEditScreen';
import ResponseScreen from '../screens/create/ResponseScreen';
import ReflectScreen from '../screens/create/ReflectScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import ChatImageReveal from '../screens/chat/ChatImageReveal';
import JournalListScreen from '../screens/journal/JournalListScreen';
import JournalDetailScreen from '../screens/journal/JournalDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const CreateStackNav = createNativeStackNavigator<CreateStackParamList>();
const JournalStackNav = createNativeStackNavigator<JournalStackParamList>();
const ChatStackNav = createNativeStackNavigator<ChatStackParamList>();

function CreateNavigator() {
  const { colors } = useTheme();
  return (
    <CreateStackNav.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <CreateStackNav.Screen name="Concepts" component={ConceptsScreen} />
      <CreateStackNav.Screen name="PromptDesign" component={PromptDesignScreen} />
      <CreateStackNav.Screen name="PromptEdit" component={PromptEditScreen} />
      <CreateStackNav.Screen name="Response" component={ResponseScreen} />
      <CreateStackNav.Screen name="Reflect" component={ReflectScreen} />
    </CreateStackNav.Navigator>
  );
}

function JournalNavigator() {
  const { colors } = useTheme();
  return (
    <JournalStackNav.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <JournalStackNav.Screen name="JournalList" component={JournalListScreen} />
      <JournalStackNav.Screen name="JournalDetail" component={JournalDetailScreen} />
    </JournalStackNav.Navigator>
  );
}

function ChatNavigator() {
  const { colors } = useTheme();
  return (
    <ChatStackNav.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ChatStackNav.Screen name="Chat" component={ChatScreen} />
      <ChatStackNav.Screen name="ChatImageReveal" component={ChatImageReveal} />
    </ChatStackNav.Navigator>
  );
}

type IoniconsName = keyof typeof Ionicons.glyphMap;

const TAB_CONFIG: Record<string, { active: IoniconsName; inactive: IoniconsName; label: string }> = {
  Home: { active: 'home', inactive: 'home-outline', label: 'Home' },
  Create: { active: 'add-circle', inactive: 'add-circle-outline', label: 'Create' },
  MindMate: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline', label: 'MindMate' },
  Journal: { active: 'book', inactive: 'book-outline', label: 'Journal' },
  Profile: { active: 'person', inactive: 'person-outline', label: 'Profile' },
};

export default function MainTabs() {
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          const config = TAB_CONFIG[route.name];
          const iconName = focused ? config.active : config.inactive;
          return (
            <View style={{ alignItems: 'center' }}>
              <Ionicons
                name={iconName}
                size={22}
                color={focused ? colors.primary : colors.textTertiary}
              />
              {focused && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: colors.primary,
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          );
        },
        tabBarLabel: ({ focused }) => {
          const config = TAB_CONFIG[route.name];
          return (
            <Text
              style={[
                styles.tabLabel,
                { color: focused ? colors.primary : colors.textTertiary },
              ]}
            >
              {config.label}
            </Text>
          );
        },
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: Platform.OS === 'android' ? colors.tabBar : 'transparent',
            borderTopColor: colors.tabBarBorder,
          },
        ],
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        tabBarItemStyle: styles.tabItem,
      })}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Create" component={CreateNavigator} />
      <Tab.Screen name="MindMate" component={ChatNavigator} />
      <Tab.Screen name="Journal" component={JournalNavigator} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 88 : 68,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
  },
  tabItem: {
    gap: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
