/**
 * StreakBadge — Small pressable pill showing flame icon + streak count.
 *
 * Used in both HomeScreen header and ProfileScreen title row.
 * When streak is 0, shows a dimmed flame with no number.
 * Renders nothing while data is still loading (prevents flash of 0).
 */

import React from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, borderRadius } from '../../theme';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';

interface StreakBadgeProps {
  streak: number;
  onPress: () => void;
}

export default function StreakBadge({ streak, onPress }: StreakBadgeProps) {
  const { surfaces, colors } = useTheme();
  const hasStreak = streak > 0;

  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={[
        styles.pill,
        {
          backgroundColor: hasStreak
            ? `${colors.accent}15`
            : 'transparent',
        },
      ]}
    >
      <Ionicons
        name="flame"
        size={22}
        color={hasStreak ? colors.accent : surfaces.text.tertiary}
      />
      {hasStreak && (
        <Text
          style={[
            styles.count,
            { color: hasStreak ? colors.accent : surfaces.text.tertiary },
          ]}
        >
          {streak}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  count: {
    fontSize: 16,
    fontWeight: '700',
  },
});
