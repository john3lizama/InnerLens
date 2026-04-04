import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing } from '../../theme';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  showText?: boolean;
}

const MESSAGES = [
  'Translating your thoughts into form…',
  'Shaping your inner world…',
  'Bringing your emotions to light…',
];

export default function LoadingSpinner({ size = 48, color, showText = true }: LoadingSpinnerProps) {
  const { colors } = useTheme();
  const [messageIndex, setMessageIndex] = useState(0);

  // Breathing scale
  const orbScale = useSharedValue(0.85);
  // Glow ring opacity
  const glowOpacity = useSharedValue(0.3);
  // Text opacity
  const textOpacity = useSharedValue(1);

  useEffect(() => {
    // Breathing animation (2s cycle)
    orbScale.value = withRepeat(
      withTiming(1.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    // Glow pulse (2s cycle, offset from orb)
    glowOpacity.value = withRepeat(
      withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [orbScale, glowOpacity]);

  // Rotate messages every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      textOpacity.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(1, { duration: 300 })
      );
      // Update message after fade out
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [textOpacity]);

  const orbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const gradientColors = color
    ? [color, color] as const
    : [...colors.gradient.primary] as const;

  return (
    <View style={styles.container}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size * 1.6,
            height: size * 1.6,
            borderRadius: (size * 1.6) / 2,
            backgroundColor: colors.primary + '18',
          },
          glowAnimatedStyle,
        ]}
      />
      {/* Main orb */}
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
          },
          orbAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={[...gradientColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size }}
        />
      </Animated.View>
      {/* Rotating text */}
      {showText && (
        <Animated.Text
          style={[
            styles.message,
            { color: colors.textSecondary },
            textAnimatedStyle,
          ]}
        >
          {MESSAGES[messageIndex]}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  message: {
    ...typography.bodySmall,
    fontStyle: 'italic',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
