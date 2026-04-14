/**
 * TypingIndicator — Refined.
 *
 * Changes:
 * - Slowed bounce animation from 300ms to 400ms (more contemplative)
 * - Uses surface tokens for mode-aware styling
 * - Ground surface background instead of raw card color
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function TypingIndicator() {
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const bounce = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-6, { duration: 400, easing: Easing.out(Easing.ease) }),
            withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) })
          ),
          -1,
          false
        )
      );
    dot1.value = bounce(0);
    dot2.value = bounce(200);
    dot3.value = bounce(400);
  }, [dot1, dot2, dot3]);

  const style1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const style2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const style3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, style1]} />
        <Animated.View style={[styles.dot, style2]} />
        <Animated.View style={[styles.dot, style3]} />
      </View>
    </View>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    marginBottom: 20,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: surfaces.colors.ground,
    borderRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: surfaces.text.tertiary,
  },
});
