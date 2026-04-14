/**
 * Input — Refined text input component.
 *
 * Changes from previous version:
 * - Uses 'input' surface role for background color (mode-aware)
 * - Uses edge tokens for border styling (mode-aware)
 * - Removed BlurView glow effect on focus (excessive)
 * - Uses motion tokens for border animation
 * - Focus border uses inputFocus edge token (30% dark, 40% light)
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { typography, spacing, borderRadius } from '../../theme';
import { fade } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export default function Input({
  label,
  error,
  containerStyle,
  multiline,
  ...textInputProps
}: InputProps) {
  const { colors, surfaces } = useTheme();
  const inputSurface = surfaces.colors.input;
  const inputEdge = surfaces.edge('input');
  const focusEdge = surfaces.edge('inputFocus');

  const styles = makeStyles(colors, surfaces);
  const [isFocused, setIsFocused] = useState(false);
  const borderProgress = useSharedValue(0);

  const animatedBorder = useAnimatedStyle(() => {
    if (error) {
      return {
        borderColor: colors.error,
        borderWidth: 1.5,
      };
    }
    return {
      borderColor: borderProgress.value > 0.5
        ? focusEdge.borderColor
        : inputEdge.borderColor,
      borderWidth: borderProgress.value > 0.5
        ? focusEdge.borderWidth
        : inputEdge.borderWidth,
    };
  });

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    borderProgress.value = withTiming(1, { duration: fade.fast });
    textInputProps.onFocus?.(e);
  }, [borderProgress, textInputProps]);

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    borderProgress.value = withTiming(0, { duration: fade.fast });
    textInputProps.onBlur?.(e);
  }, [borderProgress, textInputProps]);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            isFocused && styles.labelFocused,
            error && styles.labelError,
          ]}
        >
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          styles.inputWrapper,
          { backgroundColor: inputSurface },
          multiline && styles.multilineWrapper,
          animatedBorder,
        ]}
      >
        <TextInput
          {...textInputProps}
          multiline={multiline}
          style={[
            styles.input,
            multiline && styles.multilineInput,
          ]}
          placeholderTextColor={surfaces.text.tertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const makeStyles = (colors: any, surfaces: any) => StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: surfaces.text.secondary,
    marginBottom: spacing.sm,
  },
  labelFocused: {
    color: colors.primary,
  },
  labelError: {
    color: colors.error,
  },
  inputWrapper: {
    borderRadius: borderRadius.lg,
  },
  multilineWrapper: {
    minHeight: 120,
  },
  input: {
    ...typography.body,
    color: surfaces.text.primary,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 52,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
