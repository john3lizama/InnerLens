/**
 * SafeAreaWrapper — Safe area container with surface-token-aware backgrounds.
 *
 * Changes from previous version:
 * - Uses surface token gradients (hero, ambient) per mode
 * - Canvas color from surface tokens, not hardcoded colors
 */

import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  gradient?: boolean;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export default function SafeAreaWrapper({
  children,
  gradient = false,
  style,
  edges = ['top'],
}: SafeAreaWrapperProps) {
  const { surfaces } = useTheme();

  const content = (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      {children}
    </SafeAreaView>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={surfaces.gradient.hero}
        style={styles.gradient}
      >
        {content}
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={surfaces.gradient.ambient}
      style={styles.gradient}
    >
      {content}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
});
