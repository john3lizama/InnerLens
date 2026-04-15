/**
 * MainTabs — Native bottom tab navigator with Liquid Glass on iOS 26+.
 *
 * Uses React Navigation v8's createBottomTabNavigator which renders via:
 * - UITabBarController on iOS (automatic Liquid Glass on iOS 26+)
 * - BottomNavigationView on Android (Material Design)
 *
 * Icons use SF Symbols (iOS) and Material Symbols (Android) for native look.
 */

import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useMindMate } from '../context/MindMateContext';
import type {
  MainTabParamList,
  HomeStackParamList,
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
import ChatHistoryScreen from '../screens/chat/ChatHistoryScreen';
import ChatImageReveal from '../screens/chat/ChatImageReveal';
import JournalListScreen from '../screens/journal/JournalListScreen';
import JournalDetailScreen from '../screens/journal/JournalDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import AlexaScreen from '../screens/alexa/AlexaScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStackNav = createNativeStackNavigator<HomeStackParamList>();
const CreateStackNav = createNativeStackNavigator<CreateStackParamList>();
const JournalStackNav = createNativeStackNavigator<JournalStackParamList>();
const ChatStackNav = createNativeStackNavigator<ChatStackParamList>();

function HomeNavigator() {
  const { colors } = useTheme();
  return (
    <HomeStackNav.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <HomeStackNav.Screen name="HomeMain" component={HomeScreen} />
      <HomeStackNav.Screen name="AlexaGallery" component={AlexaScreen} />
      <HomeStackNav.Screen name="AlexaImageReveal" component={ChatImageReveal} />
    </HomeStackNav.Navigator>
  );
}

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
      <ChatStackNav.Screen name="ChatHistory" component={ChatHistoryScreen} />
      <ChatStackNav.Screen name="ChatImageReveal" component={ChatImageReveal} />
    </ChatStackNav.Navigator>
  );
}

export default function MainTabs() {
  const { colors } = useTheme();
  const { hasUnread, clearUnread } = useMindMate();

  // Determine MindMate SF Symbol based on focus + unread state
  const getMindMateIcon = (focused: boolean): string => {
    if (focused) return 'message.fill';
    return hasUnread ? 'message.badge' : 'message';
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
      }}
      screenListeners={{
        tabPress: (e) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Clear unread badge when MindMate tab is tapped
          if (e.target?.startsWith('MindMate')) {
            clearUnread();
          }
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) =>
            Platform.OS === 'ios'
              ? { type: 'sfSymbol' as const, name: focused ? 'house.fill' : 'house' }
              : { type: 'materialSymbol' as const, name: 'home' },
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateNavigator}
        options={{
          title: 'Reflect',
          tabBarIcon: ({ focused }) =>
            Platform.OS === 'ios'
              ? { type: 'sfSymbol' as const, name: focused ? 'circle.hexagonpath.fill' : 'circle.hexagonpath' }
              : { type: 'materialSymbol' as const, name: 'add_circle' },
        }}
      />
      <Tab.Screen
        name="MindMate"
        component={ChatNavigator}
        options={{
          title: 'MindMate',
          tabBarIcon: ({ focused }) =>
            Platform.OS === 'ios'
              ? { type: 'sfSymbol' as const, name: getMindMateIcon(focused) }
              : { type: 'materialSymbol' as const, name: 'chat' },
        }}
      />
      <Tab.Screen
        name="Journal"
        component={JournalNavigator}
        options={{
          title: 'Journal',
          tabBarIcon: ({ focused }) =>
            Platform.OS === 'ios'
              ? { type: 'sfSymbol' as const, name: focused ? 'book.fill' : 'book' }
              : { type: 'materialSymbol' as const, name: 'book' },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) =>
            Platform.OS === 'ios'
              ? { type: 'sfSymbol' as const, name: focused ? 'person.crop.circle.fill' : 'person.crop.circle' }
              : { type: 'materialSymbol' as const, name: 'person' },
        }}
      />
    </Tab.Navigator>
  );
}
