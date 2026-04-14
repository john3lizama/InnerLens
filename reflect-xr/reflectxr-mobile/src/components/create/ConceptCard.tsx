/**
 * ConceptCard — Redesigned for editorial identity.
 *
 * Changes:
 * - Uses PressableSurface (elevated role) instead of manual card styling
 * - Description now shows the reflection prompt (what the user will reflect on)
 * - More breathing room, cleaner hierarchy
 * - Uses motion tokens for press animation
 * - Removed arrow chevron (the card itself is the affordance)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableSurface from '../ui/PressableSurface';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface ConceptCardProps {
  title: string;
  description: string;
  icon: string;
  accentColor?: string;
  onPress: () => void;
}

export default function ConceptCard({
  title,
  description,
  icon,
  accentColor,
  onPress,
}: ConceptCardProps) {
  const { surfaces } = useTheme();
  const resolvedAccent = accentColor || '#6C63FF';

  return (
    <PressableSurface
      role="elevated"
      onPress={onPress}
      hapticType="selection"
      padded
      style={styles.card}
    >
      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: resolvedAccent }]} />

      {/* Icon */}
      <View style={[styles.iconHalo, { backgroundColor: resolvedAccent + '12' }]}>
        <Ionicons name={icon as any} size={22} color={resolvedAccent} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: surfaces.text.primary }]}>
          {title}
        </Text>
        <Text
          style={[styles.description, { color: surfaces.text.secondary }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  iconHalo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
    lineHeight: 20,
  },
});
