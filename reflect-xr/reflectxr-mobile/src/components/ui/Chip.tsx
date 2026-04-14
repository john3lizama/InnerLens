/**
 * Chip — Unified selector pill for ReflectXR.
 *
 * Replaces the StyleChip in StylePicker and Dropdown option rows
 * with a single, consistent, tactile selector component.
 *
 * Usage:
 *   <Chip label="Watercolor" selected={isSelected} onPress={handleSelect} />
 */

import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, borderRadius } from '../../theme';
import { spring as springTokens } from '../../theme/motion';
import { haptic } from '../../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Size variant */
  size?: 'default' | 'small';
  disabled?: boolean;
}

export default function Chip({
  label,
  selected,
  onPress,
  style,
  size = 'default',
  disabled = false,
}: ChipProps) {
  const { surfaces, isDark } = useTheme();
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
    if (disabled) return;
    haptic.selection();
    onPress();
  }, [disabled, onPress]);

  // Resolve styles based on selection state and mode
  const groundColor = surfaces.colors.ground;
  const selectedEdge = surfaces.edge('selected');
  const selectedTint = surfaces.overlay.selectedTint;
  const inputEdge = surfaces.edge('input');

  const isSmall = size === 'small';

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        animatedStyle,
        styles.base,
        isSmall ? styles.baseSmall : styles.baseDefault,
        {
          backgroundColor: selected ? selectedTint : groundColor,
          borderWidth: selected ? selectedEdge.borderWidth : inputEdge.borderWidth,
          borderColor: selected ? selectedEdge.borderColor : inputEdge.borderColor,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          isSmall ? styles.labelSmall : styles.labelDefault,
          {
            color: selected
              ? '#6C63FF'
              : surfaces.text.secondary,
          },
          selected && styles.labelSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseDefault: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  baseSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  labelDefault: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  labelSelected: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
});
