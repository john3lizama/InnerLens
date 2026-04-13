import React, { useCallback } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const resolvedAccentColor = accentColor || colors.primary;
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

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
    >
      <View style={[styles.card, {
        borderLeftColor: resolvedAccentColor,
        shadowColor: resolvedAccentColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      }]}>
        <View style={[styles.iconHalo, { backgroundColor: resolvedAccentColor + '15' }]}>
          <Ionicons name={icon as any} size={24} color={resolvedAccentColor} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </View>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderLeftWidth: 4,
    ...shadow.md,
  },
  iconHalo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  arrow: {
    marginLeft: spacing.sm,
  },
  arrowText: {
    fontSize: 24,
    color: colors.textTertiary,
    fontWeight: '300',
  },
})
