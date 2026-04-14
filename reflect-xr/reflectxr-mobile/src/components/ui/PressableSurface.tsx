/**
 * PressableSurface — Surface with press interaction and haptic feedback.
 *
 * Combines the role-based visual system of Surface with tactile press
 * animation and haptic feedback. Use this for any tappable card or container.
 *
 * Usage:
 *   <PressableSurface role="elevated" onPress={handleTap} haptic="selection">
 *     <Text>Tappable card content</Text>
 *   </PressableSurface>
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { borderRadius as radiusTokens, spring as springTokens } from '../../theme';
import { haptic } from '../../theme/motion';
import type { SurfaceRole } from '../../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableSurfaceProps {
  /** Visual role determines background, border, and shadow automatically */
  role: SurfaceRole;
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Apply standard padding (24px) */
  padded?: boolean;
  /** Border radius token key. Default: 'xl' (20px) */
  radius?: keyof typeof radiusTokens;
  /** Haptic feedback type on press */
  hapticType?: 'selection' | 'light' | 'medium' | 'none';
  /** Override press scale (default: 0.97 from motion.press) */
  pressScale?: number;
  disabled?: boolean;
}

export default function PressableSurface({
  role,
  children,
  onPress,
  style,
  padded = false,
  radius = 'xl',
  hapticType = 'selection',
  pressScale,
  disabled = false,
}: PressableSurfaceProps) {
  const { surfaces } = useTheme();
  const resolved = surfaces.resolve(role);
  const scale = useSharedValue(1);
  const targetScale = pressScale ?? springTokens.press.scale;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(targetScale, {
      damping: springTokens.press.damping,
      stiffness: springTokens.press.stiffness,
    });
  }, [scale, targetScale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, {
      damping: springTokens.press.damping,
      stiffness: springTokens.press.stiffness,
    });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    haptic[hapticType]();
    onPress();
  }, [disabled, hapticType, onPress]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        animatedStyle,
        {
          backgroundColor: resolved.backgroundColor,
          borderRadius: radiusTokens[radius],
          ...(resolved.borderWidth !== undefined && {
            borderWidth: resolved.borderWidth,
            borderColor: resolved.borderColor,
          }),
          ...(resolved.shadowColor !== undefined && {
            shadowColor: resolved.shadowColor,
            shadowOffset: resolved.shadowOffset,
            shadowOpacity: resolved.shadowOpacity,
            shadowRadius: resolved.shadowRadius,
            elevation: resolved.elevation,
          }),
        },
        padded && styles.padded,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: 24,
  },
  disabled: {
    opacity: 0.4,
  },
});
