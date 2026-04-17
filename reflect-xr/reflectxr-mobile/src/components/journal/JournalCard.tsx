/**
 * JournalCard — Redesigned as image-forward.
 *
 * Changes:
 * - Image is the primary element (full width, not a small thumbnail)
 * - Removed LinearGradient overlay
 * - Uses PressableSurface with ground role
 * - Date as subtle metadata, first line of reflection as preview
 * - 1-2 emotion tags, small
 * - Uses motion tokens for press animation and haptics
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import PressableSurface from '../ui/PressableSurface';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import EmotionTag from '../ui/EmotionTag';
import { formatRelativeDate } from '../../utils/formatDate';

interface JournalCardProps {
  id: string;
  content: string;
  emotionTags: Array<{ emotion: string; intensity: number }>;
  imageUrl?: string;
  createdAt: string;
  onPress: (id: string) => void;
}

export default function JournalCard({
  id,
  content,
  emotionTags,
  imageUrl,
  createdAt,
  onPress,
}: JournalCardProps) {
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  return (
    <PressableSurface
      role="ground"
      onPress={() => onPress(id)}
      hapticType="selection"
      radius="xl"
      style={styles.card}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      ) : null}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.text} numberOfLines={2}>
            {content}
          </Text>
          <Text style={styles.date}>{formatRelativeDate(createdAt)}</Text>
        </View>
        {emotionTags.length > 0 && (
          <View style={styles.tags}>
            {emotionTags.slice(0, 2).map((tag) => (
              <EmotionTag
                key={tag.emotion}
                emotion={tag.emotion}
                intensity={tag.intensity}
                size="small"
              />
            ))}
          </View>
        )}
      </View>
    </PressableSurface>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 160,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  date: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: surfaces.text.tertiary,
    marginTop: 2,
  },
  text: {
    ...typography.bodySmall,
    color: surfaces.text.primary,
    flex: 1,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
});
