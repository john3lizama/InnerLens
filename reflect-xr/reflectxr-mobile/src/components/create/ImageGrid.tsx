import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable, Dimensions, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { spacing, borderRadius, shadow } from '../../theme';
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
  onSelect,
}: {
  id: string;
  imageUrl: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    scale.value = withSpring(0.95, { damping: 12, stiffness: 200 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    }, 100);
    onSelect(id);
  }, [id, onSelect, scale]);

  const handleReport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  return (
    <AnimatedPressable onPress={handlePress} style={animatedStyle}>
      <View
        style={[
          styles.imageContainer,
          isSelected && styles.imageSelected,
        ]}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        {isSelected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
          </View>
        )}
        <Pressable onPress={handleReport} style={styles.reportBadge} hitSlop={8}>
          <Ionicons name="flag-outline" size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>
    </AnimatedPressable>
  );
}

export default function ImageGrid({ images, selectedId, onSelect }: ImageGridProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.grid}>
      {images.map((img, index) => (
        <Animated.View key={img.id} entering={FadeInUp.duration(350).delay(index * 100)}>
          <GridItem
            id={img.id}
            imageUrl={img.image_url}
            isSelected={selectedId === img.id}
            onSelect={onSelect}
          />
        </Animated.View>
      ))}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
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
    borderWidth: 3,
    borderColor: 'transparent',
    ...shadow.sm,
  },
  imageSelected: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
    padding: 2,
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
})
