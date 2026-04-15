/**
 * StreakModal — Popup showing streak details when the fire badge is tapped.
 *
 * Layout:
 * 1. Large flame icon in a themed circle
 * 2. "X Day Streak!" title (or "Start Your Streak!" if 0)
 * 3. 5-day row with day letters and check/empty indicators
 * 4. Motivational text (varies by streak state)
 * 5. Longest streak line (if different from current)
 * 6. "Done" close button
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import type { StreakData } from '../../services/journalService';

interface StreakModalProps {
  visible: boolean;
  onClose: () => void;
  streakData: StreakData | null;
}

function getMotivationalText(streakData: StreakData): string {
  if (streakData.current_streak === 0) {
    return 'Start a reflection or conversation to begin your streak.';
  }
  if (streakData.is_today_active) {
    return "You're on a roll! Come back tomorrow to keep your streak going.";
  }
  return 'Reflect or chat today to keep your streak alive!';
}

export default function StreakModal({ visible, onClose, streakData }: StreakModalProps) {
  const { surfaces, colors } = useTheme();

  if (!streakData) return null;

  const hasStreak = streakData.current_streak > 0;
  // Reverse so oldest day is on the left, today on the right
  const recentDays = [...streakData.recent_days].reverse();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: surfaces.colors.raised }]}
          onPress={() => {}}
        >
          {/* Flame icon */}
          <View style={styles.iconSection}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}15` }]}>
              <Ionicons name="flame" size={48} color={colors.accent} />
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: surfaces.text.primary }]}>
            {hasStreak
              ? `${streakData.current_streak} Day Streak!`
              : 'Start Your Streak!'}
          </Text>

          {/* 5-day row */}
          <View style={styles.daysRow}>
            {recentDays.map((day) => (
              <View key={day.date} style={styles.dayItem}>
                <Text style={[styles.dayLetter, { color: surfaces.text.secondary }]}>
                  {day.day_letter}
                </Text>
                <Ionicons
                  name={day.active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={28}
                  color={day.active ? colors.secondary : surfaces.text.secondary}
                />
              </View>
            ))}
          </View>

          {/* Motivational text */}
          <Text style={[styles.motivation, { color: surfaces.text.secondary }]}>
            {getMotivationalText(streakData)}
          </Text>

          {/* Longest streak (if different) */}
          {streakData.longest_streak > streakData.current_streak && (
            <Text style={[styles.longest, { color: surfaces.text.tertiary }]}>
              Longest streak: {streakData.longest_streak} days
            </Text>
          )}

          {/* Done button */}
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '85%',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  iconSection: {
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  dayItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayLetter: {
    ...typography.caption,
    fontWeight: '600',
  },
  motivation: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  longest: {
    ...typography.caption,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  actions: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  doneBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  doneText: {
    ...typography.body,
    fontWeight: '600',
  },
});
