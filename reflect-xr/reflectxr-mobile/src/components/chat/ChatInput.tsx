/**
 * ChatInput — Refined.
 *
 * Changes:
 * - Removed BlurView glow effect on focus
 * - Uses surface tokens for mode-aware styling
 * - Placeholder: "Say whatever you'd like…"
 * - Uses motion tokens for press animation and haptics
 * - Simplified visual treatment — input surface role background
 */

import React, { useState, useCallback } from 'react';
import { StyleSheet, View, TextInput, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { typography, spacing, borderRadius } from '../../theme';
import { spring as springTokens, haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const { surfaces, isDark } = useTheme();
  const styles = makeStyles(surfaces);
  const [text, setText] = useState('');
  const sendScale = useSharedValue(1);

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    haptic.light();
    sendScale.value = withSpring(0.85, {
      damping: springTokens.press.damping,
      stiffness: springTokens.press.stiffness,
    });
    setTimeout(() => {
      sendScale.value = withSpring(1, {
        damping: springTokens.press.damping,
        stiffness: springTokens.press.stiffness,
      });
    }, 100);
    onSend(trimmed);
    setText('');
  }, [text, disabled, onSend, sendScale]);

  const canSend = text.trim().length > 0 && !disabled;

  const inputBar = (
    <View style={styles.inputRow}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Say whatever you'd like…"
        placeholderTextColor={surfaces.text.tertiary}
        multiline
        maxLength={1000}
        editable={!disabled}
      />
      <AnimatedPressable
        onPress={handleSend}
        disabled={!canSend}
        style={[styles.sendButton, !canSend && styles.sendDisabled, sendAnimatedStyle]}
      >
        <Ionicons
          name="arrow-up"
          size={20}
          color={canSend ? '#FFFFFF' : surfaces.text.tertiary}
        />
      </AnimatedPressable>
    </View>
  );

  // iOS: use BlurView for translucent bar; Android: solid background
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.container}>
        {inputBar}
      </BlurView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: surfaces.colors.canvas }]}>
      {inputBar}
    </View>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: surfaces.edge('input').borderColor || 'transparent',
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: surfaces.colors.input,
    borderRadius: borderRadius.xxl,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: surfaces.text.primary,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendDisabled: {
    backgroundColor: surfaces.colors.ground,
  },
});
