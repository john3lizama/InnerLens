import React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { spacing } from '../../theme';
import EmotionTag from '../ui/EmotionTag';

interface EmotionTagListProps {
  tags: Array<{ emotion: string; intensity: number }>;
  size?: 'small' | 'medium';
  scrollable?: boolean;
}

export default function EmotionTagList({
  tags,
  size = 'medium',
  scrollable = false,
}: EmotionTagListProps) {
  const content = tags.map((tag) => (
    <EmotionTag
      key={tag.emotion}
      emotion={tag.emotion}
      intensity={tag.intensity}
      size={size}
    />
  ));

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={styles.wrapContent}>{content}</View>;
}

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  wrapContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
