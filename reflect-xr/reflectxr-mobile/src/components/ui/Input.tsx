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
import { typography, spacing, borderRadius, shadow } from '../../theme';
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [isFocused, setIsFocused] = useState(false);
  const borderProgress = useSharedValue(0);

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: error
      ? colors.error
      : borderProgress.value > 0.5
        ? colors.primary
        : colors.border,
    borderWidth: borderProgress.value > 0.5 ? 1.5 : 1,
  }));

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    borderProgress.value = withTiming(1, { duration: 200 });
    textInputProps.onFocus?.(e);
  }, [borderProgress, textInputProps]);

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    borderProgress.value = withTiming(0, { duration: 200 });
    textInputProps.onBlur?.(e);
  }, [borderProgress, textInputProps]);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, isFocused && styles.labelFocused, error && styles.labelError]}>
          {label}
        </Text>
      )}
      <Animated.View style={[styles.inputWrapper, multiline && styles.multilineWrapper, animatedBorder, isFocused && shadow.glowSubtle]}>
        <TextInput
          {...textInputProps}
          multiline={multiline}
          style={[
            styles.input,
            multiline && styles.multilineInput,
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  labelFocused: {
    color: colors.primary,
  },
  labelError: {
    color: colors.error,
  },
  inputWrapper: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
  },
  multilineWrapper: {
    minHeight: 120,
  },
  input: {
    ...typography.body,
    color: colors.text,
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
})
