/**
 * Button — Refined primary action component.
 *
 * Changes from previous version:
 * - Primary variant: solid color instead of gradient (more restrained, more premium)
 * - Removed glow shadow from primary variant
 * - Uses motion tokens instead of hardcoded spring configs
 * - Uses haptic tokens for consistent feedback
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { typography, spacing, borderRadius } from '../../theme';
import { spring as springTokens } from '../../theme/motion';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  hapticWeight?: 'light' | 'medium';
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  fullWidth = false,
  hapticWeight = 'light',
}: ButtonProps) {
  const { colors, surfaces } = useTheme();
  const styles = makeStyles(colors, surfaces);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(springTokens.press.scale, {
      damping: springTokens.press.damping,
      stiffness: springTokens.press.stiffness,
    });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, {
      damping: springTokens.press.damping,
      stiffness: springTokens.press.stiffness,
    });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    hapticWeight === 'medium' ? haptic.medium() : haptic.light();
    onPress();
  }, [disabled, loading, onPress, hapticWeight]);

  const isDisabled = disabled || loading;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : colors.primary}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === 'primary' && styles.textPrimary,
            variant === 'secondary' && styles.textSecondary,
            variant === 'ghost' && styles.textGhost,
          ]}
        >
          {title}
        </Text>
      )}
    </>
  );

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        animatedStyle,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <View
        style={[
          styles.base,
          variant === 'primary' && styles.primaryBase,
          variant === 'secondary' && styles.secondaryBase,
          variant === 'ghost' && styles.ghostBase,
          isDisabled && styles.disabledBase,
          fullWidth && styles.fullWidth,
        ]}
      >
        {content}
      </View>
    </AnimatedPressable>
  );
}

const makeStyles = (colors: any, surfaces: any) => StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  fullWidth: {
    width: '100%',
  },
  primaryBase: {
    backgroundColor: colors.primary,
  },
  secondaryBase: {
    backgroundColor: surfaces.colors.ground,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghostBase: {
    backgroundColor: 'transparent',
  },
  disabledBase: {
    opacity: 0.4,
  },
  text: {
    ...typography.button,
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: colors.primary,
  },
  textGhost: {
    color: colors.primary,
  },
});
