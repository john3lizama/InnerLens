import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { MindMateProvider } from './src/context/MindMateContext';
import AppNavigator from './src/navigation/AppNavigator';
import { setupForegroundHandler } from './src/services/notificationService';

// Install the notification handler ONCE at module load — before React
// mounts anything — so incoming pushes don't get dropped in the brief
// window between first render and the usePushNotifications hook
// subscribing from inside the nav tree. Idempotent per-process.
setupForegroundHandler();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <MindMateProvider>
              <StatusBar style="auto" />
              <AppNavigator />
            </MindMateProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
