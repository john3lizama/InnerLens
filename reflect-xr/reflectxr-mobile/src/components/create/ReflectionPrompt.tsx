/**
 * ReflectionPrompt — Simplified.
 *
 * Changes:
 * - Removed bordered card wrapper and accent bar
 * - Just quiet secondary text — the context makes the role clear
 * - Feels like an invitation, not a labeled card
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface ReflectionPromptProps {
  prompt: string;
}

export default function ReflectionPrompt({ prompt }: ReflectionPromptProps) {
  const { surfaces } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: surfaces.text.secondary }]}>
        {prompt}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  prompt: {
    ...typography.bodySmall,
    fontStyle: 'italic',
    lineHeight: 22,
  },
});
