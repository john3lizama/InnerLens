import React, { useState, useCallback } from 'react';
import { StyleSheet, View, TextInput, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const sendScale = useSharedValue(1);

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendScale.value = withSpring(0.85, { damping: 10, stiffness: 300 });
    setTimeout(() => {
      sendScale.value = withSpring(1, { damping: 10, stiffness: 300 });
    }, 100);
    onSend(trimmed);
    setText('');
  }, [text, disabled, onSend, sendScale]);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={[styles.container, isFocused && shadow.glowSubtle]}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Share what's on your mind..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={1000}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <AnimatedPressable
          onPress={handleSend}
          disabled={!canSend}
          style={[styles.sendButton, !canSend && styles.sendDisabled, sendAnimatedStyle]}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={canSend ? colors.textInverse : colors.textTertiary}
          />
        </AnimatedPressable>
      </View>
    </BlurView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xxl,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    ...shadow.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendDisabled: {
    backgroundColor: colors.surface,
  },
});
