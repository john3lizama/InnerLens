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
  PlaygroundStackParamList,
  ProfileStackParamList,
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
import FavoritesScreen from '../screens/journal/FavoritesScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import PrivacyScreen from '../screens/profile/PrivacyScreen';
import AlexaScreen from '../screens/alexa/AlexaScreen';
import PlaygroundHubScreen from '../screens/playground/PlaygroundHubScreen';
import AlexaSetupScreen from '../screens/playground/AlexaSetupScreen';
import ReflectionEnvironmentScreen from '../screens/playground/ReflectionEnvironmentScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStackNav = createNativeStackNavigator<HomeStackParamList>();
const CreateStackNav = createNativeStackNavigator<CreateStackParamList>();
const JournalStackNav = createNativeStackNavigator<JournalStackParamList>();
const PlaygroundStackNav = createNativeStackNavigator<PlaygroundStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();

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
      <JournalStackNav.Screen name="Favorites" component={FavoritesScreen} />
    </JournalStackNav.Navigator>
  );
}

/**
 * PlaygroundNavigator — landing on PlaygroundHubScreen, with each feature
 * card pushing into its own flow. Replaces the old ChatNavigator (which
 * was just the MindMate chat). MindMate chat is now one of four features
 * accessed via the hub.
 */
function PlaygroundNavigator() {
  const { colors } = useTheme();
  return (
    <PlaygroundStackNav.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <PlaygroundStackNav.Screen name="PlaygroundHub" component={PlaygroundHubScreen} />
      {/* MindMate chat */}
      <PlaygroundStackNav.Screen name="Chat" component={ChatScreen} />
      <PlaygroundStackNav.Screen name="ChatHistory" component={ChatHistoryScreen} />
      <PlaygroundStackNav.Screen name="ChatImageReveal" component={ChatImageReveal} />
      {/* Alexa Beta */}
      <PlaygroundStackNav.Screen name="AlexaSetup" component={AlexaSetupScreen} />
      <PlaygroundStackNav.Screen name="AlexaGallery" component={AlexaScreen} />
      <PlaygroundStackNav.Screen name="AlexaImageReveal" component={ChatImageReveal} />
      {/* TBD */}
      <PlaygroundStackNav.Screen name="ReflectionEnvironment" component={ReflectionEnvironmentScreen} />
    </PlaygroundStackNav.Navigator>
  );
}

function ProfileNavigator() {
  const { colors } = useTheme();
  return (
    <ProfileStackNav.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ProfileStackNav.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStackNav.Screen name="Privacy" component={PrivacyScreen} />
    </ProfileStackNav.Navigator>
  );
}

export default function MainTabs() {
  const { colors } = useTheme();
  const { hasUnread, clearUnread } = useMindMate();

  // Determine Playground SF Symbol based on focus state.
  // The unread state still applies to MindMate chat, but the badge logic
  // (clearUnread on tap) lives in the tabPress listener below — landing
  // on the hub counts as acknowledging the entry point.
  const getPlaygroundIcon = (focused: boolean): string => {
    if (focused) return 'square.grid.2x2.fill';
    return 'square.grid.2x2';
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
          // Clear unread MindMate badge when the Playground tab is tapped.
          if (e.target?.startsWith('Playground')) {
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
        name="Playground"
        component={PlaygroundNavigator}
        options={{
          title: 'Playground',
          tabBarIcon: ({ focused }) =>
            Platform.OS === 'ios'
              ? { type: 'sfSymbol' as const, name: getPlaygroundIcon(focused) }
              : { type: 'materialSymbol' as const, name: 'apps' },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
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
