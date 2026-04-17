/**
 * StreakBadge — Small pressable pill showing flame icon + streak count.
 *
 * Used in both HomeScreen header and ProfileScreen title row.
 *
 * Three visual states (by tint):
 *   • active  — streak > 0 AND today's slot is filled  → warm coral flame
 *   • frozen  — streak > 0 AND today's slot NOT filled → icy blue flame
 *               (signals "your streak is paused; reflect today to thaw it")
 *   • idle    — streak === 0                           → muted purple flame
 *
 * Renders nothing while data is still loading (prevents flash of 0).
 */

import React from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, borderRadius } from '../../theme';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';

// Ice-blue used for the "frozen" state. Kept inline (like the existing idle
// purple) rather than threaded through the theme — this is a single-use
// semantic color and matches the muted saturation of accent/secondary.
const FROZEN_TINT = '#8AB8E8';
const IDLE_TINT = '#6C63FF';

interface StreakBadgeProps {
  streak: number;
  /**
   * Whether the user has already reflected/chatted today. When false AND
   * the user is on a streak, we render the flame in the "frozen" tint to
   * signal that today's slot still needs filling to keep the streak alive.
   * Defaults to true so existing callers that haven't been updated keep
   * showing the normal active tint.
   */
  isTodayActive?: boolean;
  onPress: () => void;
}

export default function StreakBadge({
  streak,
  isTodayActive = true,
  onPress,
}: StreakBadgeProps) {
  const { colors } = useTheme();
  const hasStreak = streak > 0;
  const isFrozen = hasStreak && !isTodayActive;

  // Three tints, resolved in priority order:
  //   frozen > active > idle
  // so a streak that hasn't been renewed today reads as "frozen" rather
  // than "active", cueing the user to reflect before day's end.
  const tint = isFrozen
    ? FROZEN_TINT
    : hasStreak
    ? colors.accent
    : IDLE_TINT;

  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={[styles.pill, { backgroundColor: `${tint}15` }]}
    >
      <Ionicons name="flame" size={22} color={tint} />
      {hasStreak && (
        <Text style={[styles.count, { color: tint }]}>{streak}</Text>
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
