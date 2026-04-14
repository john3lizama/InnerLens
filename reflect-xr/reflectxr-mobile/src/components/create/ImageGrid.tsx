/**
 * ImageGrid — Refined selection states.
 *
 * Changes:
 * - Removed green check badge (selection shown via border + opacity only)
 * - Selected: 1.5px primary border, full opacity
 * - Unselected when one is selected: dimmed to 0.6 opacity
 * - Removed glow shadow on selected (restraint over decoration)
 * - Report badge remains for safety
 * - Uses motion tokens for press animation
 * - Slightly larger images (spacing.md padding instead of spacing.lg)
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable, Dimensions, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing, borderRadius } from '../../theme';
import { spring as springTokens, fade, enterConfig } from '../../theme/motion';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const IMAGE_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - GRID_GAP) / 2;

interface ImageGridProps {
  images: Array<{ id: string; image_url: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function GridItem({
  id,
  imageUrl,
  isSelected,
  hasSelection,
  onSelect,
}: {
  id: string;
  imageUrl: string;
  isSelected: boolean;
  hasSelection: boolean;
  onSelect: (id: string) => void;
}) {
  const { surfaces } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    haptic.light();
    scale.value = withSpring(0.95, {
      damping: springTokens.press.damping,
      stiffness: springTokens.press.stiffness,
    });
    setTimeout(() => {
      scale.value = withSpring(isSelected ? 1 : 1.01, {
        damping: springTokens.select.damping,
        stiffness: springTokens.select.stiffness,
      });
    }, 100);
    onSelect(id);
  }, [id, onSelect, scale, isSelected]);

  const handleReport = useCallback(() => {
    haptic.light();
    Alert.alert(
      'Report Image',
      'Why are you reporting this image?',
      [
        { text: 'Inappropriate Content', onPress: () => Alert.alert('Report Submitted', 'Thank you. We will review this image.') },
        { text: 'Low Quality', onPress: () => Alert.alert('Report Submitted', 'Thank you for your feedback.') },
        { text: 'Other', onPress: () => Alert.alert('Report Submitted', 'Thank you. We will review this image.') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  // Dim unselected images when one is selected
  const isDimmed = hasSelection && !isSelected;

  return (
    <AnimatedPressable onPress={handlePress} style={animatedStyle}>
      <View
        style={[
          styles.imageContainer,
          isSelected && {
            borderColor: '#6C63FF',
            borderWidth: 1.5,
          },
          isDimmed && { opacity: 0.6 },
        ]}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <Pressable onPress={handleReport} style={styles.reportBadge} hitSlop={8}>
          <MaterialCommunityIcons name="message-alert-outline" size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>
    </AnimatedPressable>
  );
}

export default function ImageGrid({ images, selectedId, onSelect }: ImageGridProps) {
  const hasSelection = selectedId !== null;

  return (
    <View style={styles.grid}>
      {images.map((img, index) => (
        <Animated.View
          key={img.id}
          entering={FadeIn.duration(fade.reverent).delay(index * 150)}
        >
          <GridItem
            id={img.id}
            imageUrl={img.image_url}
            isSelected={selectedId === img.id}
            hasSelection={hasSelection}
            onSelect={onSelect}
          />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  reportBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
