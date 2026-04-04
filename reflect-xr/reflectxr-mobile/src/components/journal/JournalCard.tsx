import React, { useCallback } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import EmotionTag from '../ui/EmotionTag';
import { formatRelativeDate } from '../../utils/formatDate';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  return (
    <AnimatedPressable
      onPress={() => { Haptics.selectionAsync(); onPress(id); }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
    >
      <View style={styles.card}>
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)']}
              style={styles.imageOverlay}
            />
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.date}>{formatRelativeDate(createdAt)}</Text>
          <Text style={styles.text} numberOfLines={2}>
            {content}
          </Text>
          {emotionTags.length > 0 && (
            <View style={styles.tags}>
              {emotionTags.slice(0, 3).map((tag) => (
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
      </View>
    </AnimatedPressable>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.md,
  },
  imageContainer: {
    position: 'relative' as const,
  },
  thumbnail: {
    width: 100,
    height: 120,
  },
  imageOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  date: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  text: {
    ...typography.bodySmall,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
