import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography, spacing, borderRadius } from '../../theme';
import { getEmotionColor, getEmotionColorWithOpacity } from '../../utils/emotionColors';

interface EmotionTagProps {
  emotion: string;
  intensity?: number;
  size?: 'small' | 'medium';
}

export default function EmotionTag({ emotion, intensity = 0.5, size = 'medium' }: EmotionTagProps) {
  const bgColor = getEmotionColorWithOpacity(emotion, intensity * 0.4 + 0.1);
  const textColor = getEmotionColor(emotion);

  return (
    <View style={[
      styles.tag,
      size === 'small' && styles.tagSmall,
      { backgroundColor: bgColor },
    ]}>
      <Text style={[
        size === 'small' ? styles.textSmall : styles.text,
        { color: textColor },
      ]}>
        {emotion}
      </Text>
      {intensity > 0 && size === 'medium' && (
        <View style={[styles.intensityDot, { backgroundColor: textColor, opacity: intensity }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  tagSmall: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  textSmall: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  intensityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
