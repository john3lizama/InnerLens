/**
 * ModalSheet — Standardized bottom sheet for ReflectXR.
 *
 * Uses the 'raised' surface role with spring presentation animation.
 * Replaces the inline modal pattern currently in Dropdown.tsx.
 *
 * Usage:
 *   <ModalSheet visible={showSheet} onClose={handleClose} title="Choose">
 *     <FlatList ... />
 *   </ModalSheet>
 */

import React, { useCallback, useEffect } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, borderRadius } from '../../theme';
import { spring as springTokens, fade } from '../../theme/motion';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ModalSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title displayed at top of sheet */
  title?: string;
  /** Maximum height as fraction of screen. Default: 0.6 */
  maxHeightFraction?: number;
}

export default function ModalSheet({
  visible,
  onClose,
  children,
  title,
  maxHeightFraction = 0.6,
}: ModalSheetProps) {
  const { surfaces } = useTheme();
  const translateY = useSharedValue(300);
  const backdropOpacity = useSharedValue(0);
  const raisedSurface = surfaces.resolve('raised');

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, springTokens.sheet);
      backdropOpacity.value = withTiming(1, { duration: fade.normal });
    } else {
      translateY.value = withSpring(300, springTokens.sheet);
      backdropOpacity.value = withTiming(0, { duration: fade.fast });
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleClose = useCallback(() => {
    translateY.value = withSpring(300, springTokens.sheet);
    backdropOpacity.value = withTiming(0, { duration: fade.fast });
    setTimeout(() => onClose(), 300);
  }, [translateY, backdropOpacity, onClose]);

  return (
    <Modal visible={visible} transparent animationType="none">
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          { backgroundColor: surfaces.overlay.backdrop },
          backdropStyle,
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: raisedSurface.backgroundColor,
            borderTopColor: raisedSurface.borderColor || 'transparent',
            borderTopWidth: raisedSurface.borderWidth || 0,
            maxHeight: SCREEN_HEIGHT * maxHeightFraction,
            shadowColor: raisedSurface.shadowColor,
            shadowOffset: raisedSurface.shadowOffset,
            shadowOpacity: raisedSurface.shadowOpacity,
            shadowRadius: raisedSurface.shadowRadius,
            elevation: raisedSurface.elevation,
          },
          sheetStyle,
        ]}
      >
        {/* Handle */}
        <View
          style={[
            styles.handle,
            { backgroundColor: surfaces.text.tertiary },
          ]}
        />

        {/* Title */}
        {title && (
          <Text style={[styles.title, { color: surfaces.text.primary }]}>
            {title}
          </Text>
        )}

        {/* Content */}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm + 2,
    marginBottom: spacing.md,
    opacity: 0.3,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
