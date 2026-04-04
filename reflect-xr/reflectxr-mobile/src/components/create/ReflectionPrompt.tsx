import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface ReflectionPromptProps {
  prompt: string;
}

export default function ReflectionPrompt({ prompt }: ReflectionPromptProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.accent} />
      <View style={styles.content}>
        <Text style={styles.label}>Reflect</Text>
        <Text style={styles.prompt}>{prompt}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  accent: {
    width: 4,
    backgroundColor: colors.secondary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: colors.secondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  prompt: {
    ...typography.body,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 26,
  },
});
